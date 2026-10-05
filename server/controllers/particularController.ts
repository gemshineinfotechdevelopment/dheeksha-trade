import type { Request, Response, NextFunction } from 'express';
import { Particular } from '../models/Particular';
import { AccountLedger } from '../models/AccountLedger';
import { escapeRegex, recalculateCustomerBalance } from '../utils/ledgerUtils';
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import {
  consumeBillAgainstPerforma,
  reverseBillConsumption,
  getParticularNetTotal,
} from '../services/performaConsumptionService';

export const getParticulars = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName } = req.query;
    const filter: any = {};
    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      filter.customerName = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    const particulars = await Particular.find(filter).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({ success: true, count: particulars.length, data: particulars });
  } catch (error) {
    next(error);
  }
};

export const getParticularById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const particular = await Particular.findById(req.params.id);
    if (!particular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }
    res.status(200).json({ success: true, data: particular });
  } catch (error) {
    next(error);
  }
};

export const getNextBillNo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allParticulars = await Particular.find({}, 'billNo');
    let maxNum = 0;
    for (const p of allParticulars) {
      if (p.billNo) {
        const match = p.billNo.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextBillNo = (maxNum + 1).toString().padStart(4, '0');
    res.status(200).json({ success: true, data: { nextBillNo } });
  } catch (error) {
    next(error);
  }
};

export const createParticular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      customerName,
      caseCount,
      companyName,
      discount,
      transport,
      packing,
      billNo,
      tax,
      amount,
      total,
      date,
      products,
    } = req.body;

    let finalBillNo = billNo ? String(billNo).trim() : '';
    if (!finalBillNo) {
      const allParticulars = await Particular.find({}, 'billNo');
      let maxNum = 0;
      for (const p of allParticulars) {
        if (p.billNo) {
          const match = p.billNo.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      finalBillNo = (maxNum + 1).toString().padStart(4, '0');
    }

    const particular = await Particular.create({
      customerName: customerName || 'General',
      caseCount: caseCount || '0',
      companyName: companyName ? String(companyName).trim() : '',
      discount: discount || '0',
      transport: transport || '-',
      packing: packing || '0',
      billNo: finalBillNo,
      tax: tax || '0',
      amount: amount || total || '0.00',
      total: total || amount || '0.00',
      date: date || new Date().toISOString().split('T')[0],
      products: products || [],
    });

    // Automatically log to Account Ledger using Net Total
    const billTotalNum = getParticularNetTotal(particular);
    if (billTotalNum > 0) {
      await AccountLedger.create({
        particularId: String(particular._id),
        billNo: particular.billNo,
        customerName: particular.customerName,
        date: particular.date,
        companyName: particular.companyName,
        debit: billTotalNum.toFixed(2),
        credit: '0.00',
        balance: '0.00',
        type: 'BILL',
      });

      await recalculateCustomerBalance(particular.customerName);
    }

    // Automatically trigger Performa allocation consumption with Net Total
    const performaConsumption = await consumeBillAgainstPerforma(
      String(particular._id),
      particular.billNo,
      particular.customerName,
      particular.date,
      particular.products || [],
      billTotalNum
    );

    res.status(201).json({
      success: true,
      data: particular,
      performaConsumption,
    });
  } catch (error) {
    next(error);
  }
};

export const updateParticular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await Particular.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    const oldCustomerName = existing.customerName;

    const {
      customerName,
      caseCount,
      companyName,
      discount,
      transport,
      packing,
      billNo,
      tax,
      amount,
      total,
      date,
      products,
    } = req.body;

    const updatedParticular = await Particular.findByIdAndUpdate(
      id,
      {
        ...(customerName !== undefined && { customerName }),
        ...(caseCount !== undefined && { caseCount }),
        ...(companyName !== undefined && { companyName }),
        ...(discount !== undefined && { discount }),
        ...(transport !== undefined && { transport }),
        ...(packing !== undefined && { packing }),
        ...(billNo !== undefined && { billNo: String(billNo).trim() }),
        ...(tax !== undefined && { tax }),
        ...(amount !== undefined && { amount }),
        ...(total !== undefined && { total }),
        ...(date !== undefined && { date }),
        ...(products !== undefined && { products }),
      },
      { new: true, runValidators: true }
    );

    if (!updatedParticular) {
      res.status(404).json({ success: false, error: 'Failed to update particular bill' });
      return;
    }

    // Update AccountLedger entry with Net Total
    const billTotalNum = getParticularNetTotal(updatedParticular);
    
    // Find or update AccountLedger
    const ledgerEntry = await AccountLedger.findOne({
      $or: [
        { particularId: String(id) },
        { particularId: String(existing._id) },
        ...(existing.billNo ? [{ billNo: String(existing.billNo).trim() }] : []),
      ],
    });

    if (ledgerEntry) {
      ledgerEntry.customerName = updatedParticular.customerName;
      ledgerEntry.companyName = updatedParticular.companyName;
      ledgerEntry.date = updatedParticular.date;
      ledgerEntry.billNo = updatedParticular.billNo;
      ledgerEntry.debit = billTotalNum.toFixed(2);
      await ledgerEntry.save();
    } else if (billTotalNum > 0) {
      await AccountLedger.create({
        particularId: String(updatedParticular._id),
        billNo: updatedParticular.billNo,
        customerName: updatedParticular.customerName,
        date: updatedParticular.date,
        companyName: updatedParticular.companyName,
        debit: billTotalNum.toFixed(2),
        credit: '0.00',
        balance: '0.00',
        type: 'BILL',
      });
    }

    // Recalculate balances
    if (oldCustomerName && oldCustomerName !== updatedParticular.customerName) {
      await recalculateCustomerBalance(oldCustomerName);
    }
    await recalculateCustomerBalance(updatedParticular.customerName);

    // Reverse old Performa consumption and re-apply for updated items using Net Total
    await reverseBillConsumption(String(id));
    const performaConsumption = await consumeBillAgainstPerforma(
      String(updatedParticular._id),
      updatedParticular.billNo,
      updatedParticular.customerName,
      updatedParticular.date,
      updatedParticular.products || [],
      billTotalNum
    );

    res.status(200).json({
      success: true,
      data: updatedParticular,
      performaConsumption,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteParticular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const particular = await Particular.findById(req.params.id);
    if (!particular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    const customerName = particular.customerName;

    // 1. Delete associated Cloudinary asset if present
    if (particular.pdfPublicId && isCloudinaryConfigured()) {
      await deleteFromCloudinary(particular.pdfPublicId);
    }

    // 2. Reverse Performa consumption atomically before deleting
    await reverseBillConsumption(String(req.params.id));

    // 3. Delete Particular Document
    await Particular.findByIdAndDelete(req.params.id);

    // 3. Cascade Delete: Delete matching AccountLedger entry comprehensively
    const orConditions: any[] = [
      { particularId: String(req.params.id) },
      { particularId: String(particular._id) },
    ];
    if (particular.billNo && String(particular.billNo).trim() !== '') {
      orConditions.push({ billNo: String(particular.billNo).trim() });
    }
    if (particular.customerName && particular.date) {
      const matchCond: any = {
        customerName: { $regex: new RegExp(`^${escapeRegex(particular.customerName.trim())}$`, 'i') },
        date: particular.date,
        type: 'BILL',
      };
      if (particular.companyName && particular.companyName.trim() !== '') {
        matchCond.companyName = { $regex: new RegExp(`^${escapeRegex(particular.companyName.trim())}$`, 'i') };
      }
      orConditions.push(matchCond);
    }

    await AccountLedger.deleteMany({ $or: orConditions });

    // 4. Recalculate balance for this customer
    await recalculateCustomerBalance(customerName);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const uploadParticularPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { pdfData, pdfName } = req.body;

    if (!pdfData) {
      res.status(400).json({ success: false, error: 'Document data is required' });
      return;
    }

    const existingParticular = await Particular.findById(id);
    if (!existingParticular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    let savedUrl = pdfData;
    let publicId = '';

    if (isCloudinaryConfigured()) {
      try {
        if (existingParticular.pdfPublicId) {
          await deleteFromCloudinary(existingParticular.pdfPublicId);
        }

        const cloudRes = await uploadToCloudinary(
          pdfData,
          'dheeksha_trade/bills',
          pdfName || `Bill-${existingParticular.billNo || 'receipt'}`
        );

        savedUrl = cloudRes.secure_url;
        publicId = cloudRes.public_id;
        console.log(`[Cloudinary Success] Uploaded: ${savedUrl}`);
      } catch (cloudErr) {
        console.warn('[Cloudinary Warning] Falling back to direct database storage:', cloudErr);
        savedUrl = pdfData;
      }
    } else {
      console.log('[Storage] Storing document directly in database (Cloudinary not configured)');
    }

    existingParticular.pdfData = savedUrl;
    existingParticular.pdfName = pdfName || 'transport-receipt';
    existingParticular.pdfPublicId = publicId;
    await existingParticular.save();

    res.status(200).json({
      success: true,
      message: 'Transport receipt uploaded successfully',
      data: existingParticular,
    });
  } catch (error: any) {
    console.error('[Upload Error]:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to upload document',
    });
  }
};

export const deleteParticularPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const particular = await Particular.findById(id);

    if (!particular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    // Delete from Cloudinary if public_id exists
    if (particular.pdfPublicId && isCloudinaryConfigured()) {
      await deleteFromCloudinary(particular.pdfPublicId);
      console.log(`[Cloudinary Delete] Removed asset: ${particular.pdfPublicId}`);
    }

    particular.pdfData = '';
    particular.pdfName = '';
    particular.pdfPublicId = '';
    await particular.save();

    res.status(200).json({ success: true, message: 'PDF deleted successfully', data: particular });
  } catch (error) {
    next(error);
  }
};
