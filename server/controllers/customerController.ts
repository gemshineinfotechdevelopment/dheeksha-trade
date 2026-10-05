import type { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/Customer';
import { AccountLedger } from '../models/AccountLedger';
import { Performa } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Particular } from '../models/Particular';
import { escapeRegex } from '../utils/ledgerUtils';
import { getParticularNetTotal } from '../services/performaConsumptionService';

export const getCustomers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Backfill missing idCode for existing records if any
    const missingIdCustomers = await Customer.find({
      $or: [{ idCode: { $exists: false } }, { idCode: null }, { idCode: '' }],
    });

    if (missingIdCustomers.length > 0) {
      const allCustomers = await Customer.find().sort({ createdAt: 1 });
      let currentMax = 0;
      allCustomers.forEach((c) => {
        if (c.idCode) {
          const match = c.idCode.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > currentMax) currentMax = num;
          }
        }
      });

      for (let i = 0; i < allCustomers.length; i++) {
        const c = allCustomers[i];
        if (!c.idCode) {
          currentMax += 1;
          c.idCode = `#${currentMax.toString().padStart(4, '0')}`;
          await c.save();
        }
      }
    }

    const customers = await Customer.find().sort({ createdAt: 1 }).lean();
    const allLedgerEntries = await AccountLedger.find({}).lean();
    const allAudits = await PerformaAudit.find({}).lean();
    const allPerformas = await Performa.find({}).lean();
    const allParticulars = await Particular.find({}).lean();

    // Map Particulars Net Total by ID, billNo, and customerName
    const particularById = new Map<string, any>();
    const particularByBillNo = new Map<string, any>();
    const particularsByCustomer = new Map<string, any[]>();
    for (const p of allParticulars) {
      const net = getParticularNetTotal(p);
      const enhanced = { ...p, netTotal: net };
      particularById.set(String(p._id), enhanced);
      if (p.billNo) particularByBillNo.set(String(p.billNo).trim().toLowerCase(), enhanced);
      const cKey = (p.customerName || '').trim().toLowerCase();
      if (!particularsByCustomer.has(cKey)) particularsByCustomer.set(cKey, []);
      particularsByCustomer.get(cKey)!.push(enhanced);
    }

    // Map Master Performa per customer (by customerId or lowercase name)
    const performaMap = new Map<string, any>();
    for (const p of allPerformas) {
      const custIdKey = p.customerId ? String(p.customerId) : '';
      const custNameKey = (p.customerSnapshot?.name || '').trim().toLowerCase();

      if (custIdKey && !performaMap.has(custIdKey)) {
        performaMap.set(custIdKey, p);
      }
      if (custNameKey && !performaMap.has(custNameKey)) {
        performaMap.set(custNameKey, p);
      }
    }

    // Group ledger by customer name (normalized lowercase)
    const statsMap = new Map<string, { totalDebit: number; totalCredit: number; lastDate: string }>();

    for (const entry of allLedgerEntries) {
      const key = (entry.customerName || '').trim().toLowerCase();
      if (!key) continue;

      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;

      const existing = statsMap.get(key) || { totalDebit: 0, totalCredit: 0, lastDate: '' };
      existing.totalDebit += deb;
      existing.totalCredit += cred;
      if (entry.date && (!existing.lastDate || entry.date > existing.lastDate)) {
        existing.lastDate = entry.date;
      }
      statsMap.set(key, existing);
    }

    // Group Performa audits for advance summary
    const advanceMap = new Map<string, { received: number; used: number }>();
    for (const a of allAudits) {
      const key = (a.customerName || '').trim().toLowerCase();
      if (!key) continue;

      const curr = advanceMap.get(key) || { received: 0, used: 0 };
      const amt = Number(a.amount) || 0;
      if (a.type === 'ADVANCE_RECEIVED' || a.type === 'PERFORMA_ADVANCE') {
        curr.received += amt;
      } else if (a.type === 'PERFORMA_CONSUMED') {
        const pDoc = (a.particularId && particularById.get(String(a.particularId))) ||
          (a.billNo && particularByBillNo.get(String(a.billNo).trim().toLowerCase()));
        curr.used += pDoc ? pDoc.netTotal : amt;
      } else if (a.type === 'PERFORMA_REVERSED') {
        const pDoc = (a.particularId && particularById.get(String(a.particularId))) ||
          (a.billNo && particularByBillNo.get(String(a.billNo).trim().toLowerCase()));
        curr.used = Math.max(0, curr.used - (pDoc ? pDoc.netTotal : amt));
      }
      advanceMap.set(key, curr);
    }

    const enrichedCustomers = customers.map((c: any) => {
      const key = (c.name || '').trim().toLowerCase();
      const idKey = String(c._id);
      const masterPerforma = performaMap.get(idKey) || performaMap.get(key) || null;

      const stats = statsMap.get(key) || { totalDebit: 0, totalCredit: 0, lastDate: '' };
      const advStats = advanceMap.get(key) || { received: 0, used: 0 };

      const totalDebit = Number(stats.totalDebit.toFixed(2));
      const totalCredit = Number(stats.totalCredit.toFixed(2));
      const pendingDue = Number(Math.max(0, totalDebit - totalCredit).toFixed(2));
      const netBalance = Number((totalCredit - totalDebit).toFixed(2));

      let totalAdvanceReceived = 0;
      let totalAdvanceUsed = 0;
      let availableAdvance = 0;

      if (masterPerforma) {
        totalAdvanceReceived = Number((masterPerforma.advanceAmount || 0).toFixed(2));
        totalAdvanceUsed = Number((masterPerforma.advanceUsedAmount || 0).toFixed(2));
        availableAdvance = Number((masterPerforma.remainingAdvanceAmount || 0).toFixed(2));
      } else {
        totalAdvanceReceived = Number(advStats.received.toFixed(2)) || totalCredit;
        totalAdvanceUsed = Number(advStats.used.toFixed(2)) || totalDebit;
        availableAdvance = Number(Math.max(0, totalAdvanceReceived - totalAdvanceUsed).toFixed(2));
      }

      let status: 'PENDING' | 'SETTLED' | 'ADVANCE' = 'SETTLED';
      if (pendingDue > 0) {
        status = 'PENDING';
      } else if (netBalance > 0 || availableAdvance > 0) {
        status = 'ADVANCE';
      }

      return {
        ...c,
        totalDebit,
        totalCredit,
        pendingDue,
        netBalance,
        totalAdvanceReceived,
        totalAdvanceUsed,
        availableAdvance,
        availableAmount: availableAdvance,
        status,
        masterPerformaNumber: masterPerforma?.performaNumber || null,
        masterPerformaId: masterPerforma?._id ? String(masterPerforma._id) : null,
        lastTransactionDate: stats.lastDate || null,
      };
    });

    res.status(200).json({ success: true, count: enrichedCustomers.length, data: enrichedCustomers });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, mobile, address, gst, idCode } = req.body;

    let finalIdCode = idCode ? String(idCode).trim() : '';
    if (!finalIdCode) {
      const allCustomers = await Customer.find().sort({ createdAt: 1 });
      let currentMax = 0;
      allCustomers.forEach((c) => {
        if (c.idCode) {
          const match = c.idCode.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > currentMax) currentMax = num;
          }
        }
      });
      finalIdCode = `#${(currentMax + 1).toString().padStart(4, '0')}`;
    }

    const customer = await Customer.create({
      name,
      mobile,
      address,
      gst,
      idCode: finalIdCode,
    });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oldCustomer = await Customer.findById(req.params.id);
    if (!oldCustomer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    const oldName = oldCustomer.name;
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (customer && req.body.name && req.body.name.trim() !== oldName.trim()) {
      const newName = req.body.name.trim();
      const escapedOldName = escapeRegex(oldName.trim());
      const { Particular } = await import('../models/Particular');
      const { AccountLedger } = await import('../models/AccountLedger');
      await Particular.updateMany(
        { customerName: { $regex: new RegExp(`^${escapedOldName}$`, 'i') } },
        { customerName: newName }
      );
      await AccountLedger.updateMany(
        { customerName: { $regex: new RegExp(`^${escapedOldName}$`, 'i') } },
        { customerName: newName }
      );
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    const customerName = customer.name;
    const escapedName = escapeRegex(customerName.trim());

    // 1. Delete customer
    await Customer.findByIdAndDelete(req.params.id);

    // 2. Cascade Delete: Delete all Particulars for this customer
    const { Particular } = await import('../models/Particular');
    await Particular.deleteMany({
      customerName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });

    // 3. Cascade Delete: Delete all AccountLedger entries for this customer
    const { AccountLedger } = await import('../models/AccountLedger');
    await AccountLedger.deleteMany({
      customerName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
