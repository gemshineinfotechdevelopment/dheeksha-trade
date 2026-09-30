import type { Request, Response, NextFunction } from 'express';
import { AccountLedger } from '../models/AccountLedger';
import { Performa } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { escapeRegex, recalculateCustomerBalance } from '../utils/ledgerUtils';
import { addCustomerCreditToMasterPerforma, getCustomerMasterPerforma } from '../services/performaConsumptionService';

export const getAccountDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName } = req.query;
    const filter: any = {};
    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      filter.customerName = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    const accounts = await AccountLedger.find(filter).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({ success: true, count: accounts.length, data: accounts });
  } catch (error) {
    next(error);
  }
};

export const addCredit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName, customerId, companyName, creditAmount, date, paymentMode, reference, notes, createdBy } = req.body;

    const result = await addCustomerCreditToMasterPerforma({
      customerId,
      customerName: customerName || 'General',
      companyName: companyName || 'General',
      creditAmount,
      date,
      paymentMode: paymentMode || 'Bank',
      reference,
      notes,
      createdBy: createdBy || 'Admin',
    });

    res.status(201).json({
      success: true,
      message: 'Credit added successfully and synced to Master Performa',
      data: result.ledgerEntry,
      masterPerforma: result.masterPerforma,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error('[Add Credit Error]:', error);
    res.status(400).json({ success: false, error: error?.message || 'Failed to add credit' });
  }
};

export const deleteAccountEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const entry = await AccountLedger.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Account ledger entry not found' });
      return;
    }

    const customerName = entry.customerName;
    const creditAmt = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;

    // If this entry was created from a particular bill, delete the corresponding particular bill as well
    const { Particular } = await import('../models/Particular');
    if (entry.particularId) {
      await Particular.findByIdAndDelete(entry.particularId);
    } else if (entry.billNo && entry.billNo.trim() !== '' && entry.type === 'BILL') {
      await Particular.findOneAndDelete({ billNo: entry.billNo.trim() });
    } else if (entry.type === 'BILL') {
      await Particular.findOneAndDelete({
        customerName: { $regex: new RegExp(`^${escapeRegex(entry.customerName.trim())}$`, 'i') },
        companyName: { $regex: new RegExp(`^${escapeRegex(entry.companyName.trim())}$`, 'i') },
        date: entry.date,
      });
    }

    // If deleting a CREDIT or ADVANCE entry, adjust master performa advance if linked
    if ((entry.type === 'CREDIT' || entry.type === 'ADVANCE') && creditAmt > 0) {
      const masterPerforma = await getCustomerMasterPerforma(customerName);
      if (masterPerforma) {
        masterPerforma.advanceAmount = Math.max(0, Number((masterPerforma.advanceAmount - creditAmt).toFixed(2)));
        masterPerforma.remainingAdvanceAmount = Math.max(
          0,
          Number((masterPerforma.remainingAdvanceAmount - creditAmt).toFixed(2))
        );
        await masterPerforma.save();
      }

      // Delete corresponding audit if any
      await PerformaAudit.findOneAndDelete({
        customerName: { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') },
        amount: creditAmt,
        date: entry.date,
        type: 'ADVANCE_RECEIVED',
      });
    }

    await AccountLedger.findByIdAndDelete(req.params.id);

    // Recalculate running balances for this customer
    await recalculateCustomerBalance(customerName);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
