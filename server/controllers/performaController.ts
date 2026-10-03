import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Performa, type IPerformaProductItem } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Customer } from '../models/Customer';
import { AccountLedger } from '../models/AccountLedger';
import { escapeRegex, recalculateCustomerBalance } from '../utils/ledgerUtils';
import {
  getCustomerPerformaSummary,
  getCustomerMasterPerforma,
  addCustomerCreditToMasterPerforma,
} from '../services/performaConsumptionService';

export const getPerformas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName, customerId, companyName, status, search, startDate, endDate, sortBy, sortOrder } = req.query;
    const filter: any = {};

    if (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) {
      filter.customerId = new mongoose.Types.ObjectId(String(customerId));
    } else if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      filter['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    if (companyName && typeof companyName === 'string' && companyName.trim() !== '' && companyName.toLowerCase() !== 'all') {
      const compRegex = new RegExp(escapeRegex(companyName.trim()), 'i');
      filter.$or = [
        { companyName: compRegex },
        { 'customerSnapshot.companyName': compRegex },
        { 'products.productSnapshot.companyName': compRegex },
      ];
    }

    if (status && typeof status === 'string' && status.trim() !== '' && status.toUpperCase() !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = String(startDate);
      if (endDate) filter.date.$lte = String(endDate);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      const searchConditions = [
        { performaNumber: searchRegex },
        { companyName: searchRegex },
        { 'customerSnapshot.name': searchRegex },
        { 'customerSnapshot.phone': searchRegex },
        { 'customerSnapshot.companyName': searchRegex },
        { 'products.productSnapshot.productName': searchRegex },
        { 'products.productSnapshot.productCode': searchRegex },
        { 'products.productSnapshot.companyName': searchRegex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const sortObj: any = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'date') sortObj.date = order;
    else if (sortBy === 'company' || sortBy === 'companyName') sortObj.companyName = order;
    else if (sortBy === 'customer' || sortBy === 'customerName') sortObj['customerSnapshot.name'] = order;
    else if (sortBy === 'advance' || sortBy === 'advanceAmount') sortObj.advanceAmount = order;
    else if (sortBy === 'remainingAdvance') sortObj.remainingAdvanceAmount = order;
    else if (sortBy === 'performaNumber') sortObj.performaNumber = order;
    else if (sortBy === 'cases' || sortBy === 'totalRequiredCases') sortObj.totalRequiredCases = order;
    else {
      sortObj.date = -1;
      sortObj.createdAt = -1;
    }
    if (!sortObj.createdAt) sortObj.createdAt = -1;

    const performas = await Performa.find(filter).sort(sortObj).lean();

    // Fetch all audits to calculate initial advance, additional credits, and consumed amounts per performa
    const allAudits = await PerformaAudit.find({}).lean();
    const auditMap = new Map<string, { initialAdvance: number; additionalCredits: number; consumedAmount: number }>();

    for (const a of allAudits) {
      const pId = a.performaId ? String(a.performaId) : '';
      if (!pId) continue;
      const existing = auditMap.get(pId) || { initialAdvance: 0, additionalCredits: 0, consumedAmount: 0 };
      const amt = Number(a.amount) || 0;
      if (a.type === 'ADVANCE_RECEIVED') {
        if (a.reference?.includes('Initial Advance') || a.notes?.includes('Initial')) {
          existing.initialAdvance = amt;
        } else {
          existing.additionalCredits += amt;
        }
      } else if (a.type === 'PERFORMA_CONSUMED') {
        existing.consumedAmount += amt;
      } else if (a.type === 'PERFORMA_REVERSED') {
        existing.consumedAmount = Math.max(0, existing.consumedAmount - amt);
      }
      auditMap.set(pId, existing);
    }

    let totalAdvance = 0;
    let totalUsedAdvance = 0;
    let totalRemainingAdvance = 0;
    let totalRequiredCases = 0;
    let totalUsedCases = 0;
    let totalRemainingCases = 0;

    const enrichedPerformas = performas.map((p) => {
      const pId = String(p._id);
      const auditData = auditMap.get(pId);
      const initialAdvance = auditData?.initialAdvance || p.advanceAmount || 0;
      const additionalCredits = auditData?.additionalCredits || 0;
      const totalAvailableAmount = Number((p.advanceAmount || 0).toFixed(2));
      const usedAmount = Number(
        (p.advanceUsedAmount !== undefined && p.advanceUsedAmount > 0
          ? p.advanceUsedAmount
          : auditData?.consumedAmount || 0
        ).toFixed(2)
      );
      const remainingAmount = Number(
        (p.remainingAdvanceAmount !== undefined
          ? p.remainingAdvanceAmount
          : Math.max(0, totalAvailableAmount - usedAmount)
        ).toFixed(2)
      );

      totalAdvance += totalAvailableAmount;
      totalUsedAdvance += usedAmount;
      totalRemainingAdvance += remainingAmount;
      totalRequiredCases += p.totalRequiredCases || 0;
      totalUsedCases += p.totalUsedCases || 0;
      totalRemainingCases += p.totalRemainingCases || 0;

      return {
        ...p,
        initialAdvance: Number(initialAdvance.toFixed(2)),
        additionalCredits: Number(additionalCredits.toFixed(2)),
        totalAvailableAmount,
        usedAmount,
        remainingAmount,
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedPerformas.length,
      data: enrichedPerformas,
      summary: {
        totalPerformas: enrichedPerformas.length,
        totalAdvance: Number(totalAdvance.toFixed(2)),
        totalUsedAdvance: Number(totalUsedAdvance.toFixed(2)),
        totalRemainingAdvance: Number(totalRemainingAdvance.toFixed(2)),
        totalRequiredCases,
        totalUsedCases,
        totalRemainingCases,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getNextPerformaNumber = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allPerformas = await Performa.find({}, 'performaNumber');
    let maxNum = 0;
    for (const p of allPerformas) {
      if (p.performaNumber) {
        const match = p.performaNumber.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextPerformaNumber = `PF-${(maxNum + 1).toString().padStart(6, '0')}`;
    res.status(200).json({ success: true, data: { nextPerformaNumber } });
  } catch (error) {
    next(error);
  }
};

export const getPerformaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const performa = await Performa.findById(req.params.id);
    if (!performa) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    const summary = await getCustomerPerformaSummary(String(performa.customerId || performa.customerSnapshot.name));
    const audits = await PerformaAudit.find({
      $or: [{ performaId: performa._id }, { customerId: performa.customerId }],
    }).sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ...performa.toObject(),
        financialSummary: summary,
        auditHistory: audits,
        transactionHistory: summary.transactionHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createPerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      customerId,
      customerSnapshot,
      advanceAmount = 0,
      paymentMode = 'Bank',
      products = [],
      date,
      notes = '',
      createdBy = 'Admin',
      performaNumber,
      discount = '0',
      packing = '0',
      tax = '0',
    } = req.body;

    if (!customerSnapshot || !customerSnapshot.name) {
      res.status(400).json({ success: false, error: 'Customer information is required' });
      return;
    }

    // Resolve or verify customer
    let validCustomerId = customerId;
    if (!validCustomerId || !mongoose.Types.ObjectId.isValid(validCustomerId)) {
      const existingCust = await Customer.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(customerSnapshot.name.trim())}$`, 'i') },
      });
      if (existingCust) {
        validCustomerId = existingCust._id;
      } else {
        const newCust = await Customer.create({
          name: customerSnapshot.name.trim(),
          mobile: customerSnapshot.phone || '-',
          address: customerSnapshot.address || '-',
          gst: customerSnapshot.gst || '-',
        });
        validCustomerId = newCust._id;
      }
    }


    // Generate unique Performa Number if not provided
    let finalPerformaNumber = performaNumber ? String(performaNumber).trim().toUpperCase() : '';
    if (!finalPerformaNumber) {
      const allPerformas = await Performa.find({}, 'performaNumber');
      let maxNum = 0;
      for (const p of allPerformas) {
        if (p.performaNumber) {
          const match = p.performaNumber.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      finalPerformaNumber = `PF-${(maxNum + 1).toString().padStart(6, '0')}`;
    }

    // Process and validate product items
    let totalRequiredCases = 0;
    let subtotalAmount = 0;

    const sanitizedProducts: IPerformaProductItem[] = products.map((item: any) => {
      const reqCases = parseFloat(item.requiredCases) || 0;
      const rate = parseFloat(item.rate) || 0;
      const pktPerUnit = parseFloat(item.pktPerUnit) || 1;
      const allocated = Number(
        (item.allocatedAmount !== undefined
          ? parseFloat(item.allocatedAmount)
          : reqCases * rate * pktPerUnit
        ).toFixed(2)
      );

      totalRequiredCases += reqCases;
      subtotalAmount += allocated;

      return {
        productId: item.productId && mongoose.Types.ObjectId.isValid(item.productId) ? item.productId : undefined,
        productSnapshot: {
          productCode: item.productSnapshot?.productCode || item.productCode || '',
          productName: item.productSnapshot?.productName || item.productName || item.particular || 'Product',
          companyName: item.productSnapshot?.companyName || item.companyName || '',
          category: item.productSnapshot?.category || item.category || '',
        },
        requiredCases: reqCases,
        usedCases: 0,
        remainingCases: reqCases,
        caseOut: 0,
        rate: rate,
        pktPerUnit: pktPerUnit,
        allocatedAmount: allocated,
        usedAmount: 0,
        remainingAmount: allocated,
      };
    });

    // Calculate Discount, Packing Charge (% on discounted amount), Tax (Amount)
    const cleanDisc = String(discount || '0').trim();
    const discNum = parseFloat(cleanDisc) || 0;
    let discountAmt = 0;
    if (discNum > 0) {
      if (cleanDisc.endsWith('%') || discNum <= 100) {
        discountAmt = (subtotalAmount * discNum) / 100;
      } else {
        discountAmt = discNum;
      }
    }
    discountAmt = Number(discountAmt.toFixed(2));

    const baseAfterDiscount = Math.max(0, subtotalAmount - discountAmt);

    const cleanPack = String(packing || '0').trim();
    const packNum = parseFloat(cleanPack) || 0;
    let packingAmt = 0;
    if (packNum > 0) {
      if (cleanPack.endsWith('%') || packNum <= 100) {
        packingAmt = (baseAfterDiscount * packNum) / 100;
      } else {
        packingAmt = packNum;
      }
    }
    packingAmt = Number(packingAmt.toFixed(2));

    const cleanTax = String(tax || '0').trim().replace(/[^0-9.]/g, '');
    const taxAmt = Number((parseFloat(cleanTax) || 0).toFixed(2));

    const finalAllocatedTotal = Math.max(0, Number((subtotalAmount - discountAmt + packingAmt + taxAmt).toFixed(2)));

    const parsedAdvance = parseFloat(String(advanceAmount).replace(/,/g, '')) || 0;
    const performaDate = date || new Date().toISOString().split('T')[0];

    // Derive unique companies from product items (excluding 'General')
    const uniqueCompanies = Array.from(
      new Set(
        sanitizedProducts
          .map((p) => p.productSnapshot?.companyName?.trim())
          .filter((c): c is string => typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'general')
      )
    );
    const combinedCompanyName =
      uniqueCompanies.length > 0
        ? uniqueCompanies.join(', ')
        : (req.body.companyName && req.body.companyName.toLowerCase() !== 'general'
            ? req.body.companyName
            : customerSnapshot.companyName && customerSnapshot.companyName.toLowerCase() !== 'general'
            ? customerSnapshot.companyName
            : req.body.companyName || customerSnapshot.companyName || '');

    const performa = await Performa.create({
      performaNumber: finalPerformaNumber,
      customerId: validCustomerId,
      companyName: combinedCompanyName,
      customerSnapshot: {
        name: customerSnapshot.name.trim(),
        phone: customerSnapshot.phone || '',
        companyName: combinedCompanyName || customerSnapshot.companyName || '',
        address: customerSnapshot.address || '',
        gst: customerSnapshot.gst || '',
      },
      advanceAmount: parsedAdvance,
      advanceUsedAmount: 0,
      remainingAdvanceAmount: parsedAdvance,
      products: sanitizedProducts,
      totalRequiredCases,
      totalUsedCases: 0,
      totalRemainingCases: totalRequiredCases,
      subtotal: Number(subtotalAmount.toFixed(2)),
      discount: cleanDisc,
      discountAmount: discountAmt,
      packing: cleanPack,
      packingAmount: packingAmt,
      tax: cleanTax,
      taxAmount: taxAmt,
      totalAllocatedAmount: finalAllocatedTotal,
      totalUsedAmount: 0,
      totalRemainingAmount: finalAllocatedTotal,
      status: 'ACTIVE',
      date: performaDate,
      notes,
      createdBy,
    });

    // 💰 Initial Advance: Record in PerformaAudit AND AccountLedger
    if (parsedAdvance > 0) {
      let ledgerDate = performaDate;
      if (ledgerDate.includes('-') && ledgerDate.split('-')[0].length === 4) {
        const parts = ledgerDate.split('-');
        ledgerDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      await PerformaAudit.create({
        customerId: validCustomerId,
        customerName: customerSnapshot.name.trim(),
        performaId: performa._id,
        performaNumber: performa.performaNumber,
        amount: parsedAdvance,
        type: 'ADVANCE_RECEIVED',
        date: ledgerDate,
        paymentMode: paymentMode || 'Bank',
        reference: finalPerformaNumber,
        notes: notes || 'Initial customer advance',
        createdBy,
      });

      await AccountLedger.create({
        billNo: finalPerformaNumber,
        performaId: String(performa._id),
        performaNumber: finalPerformaNumber,
        customerName: customerSnapshot.name.trim(),
        companyName: performa.companyName || 'General',
        date: ledgerDate,
        debit: '0.00',
        credit: parsedAdvance.toFixed(2),
        balance: '0.00',
        paymentMode: paymentMode || 'Bank',
        reference: finalPerformaNumber,
        notes: 'Initial Advance for Performa',
        type: 'ADVANCE',
      });

      await recalculateCustomerBalance(customerSnapshot.name.trim());
    }

    res.status(201).json({ success: true, data: performa });
  } catch (error) {
    next(error);
  }
};

export const updatePerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await Performa.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    const { customerSnapshot, companyName, advanceAmount, products, date, notes, status, discount, packing, tax } = req.body;

    if (companyName !== undefined) {
      existing.companyName = companyName;
    }

    if (discount !== undefined) existing.discount = String(discount);
    if (packing !== undefined) existing.packing = String(packing);
    if (tax !== undefined) existing.tax = String(tax);

    if (customerSnapshot) {
      existing.customerSnapshot = {
        name: customerSnapshot.name || existing.customerSnapshot.name,
        phone: customerSnapshot.phone !== undefined ? customerSnapshot.phone : existing.customerSnapshot.phone,
        companyName:
          companyName || customerSnapshot.companyName !== undefined
            ? companyName || customerSnapshot.companyName
            : existing.customerSnapshot.companyName,
        address: customerSnapshot.address !== undefined ? customerSnapshot.address : existing.customerSnapshot.address,
        gst: customerSnapshot.gst !== undefined ? customerSnapshot.gst : existing.customerSnapshot.gst,
      };
    }

    if (advanceAmount !== undefined) {
      const newAdv = parseFloat(String(advanceAmount).replace(/,/g, '')) || 0;
      existing.advanceAmount = newAdv;
      existing.remainingAdvanceAmount = Math.max(0, Number((newAdv - existing.advanceUsedAmount).toFixed(2)));

      // Sync to AccountLedger
      const existingLedger = await AccountLedger.findOne({
        $or: [
          { performaId: String(existing._id) },
          { performaNumber: existing.performaNumber },
          { billNo: existing.performaNumber },
        ],
      });

      if (existingLedger) {
        existingLedger.credit = newAdv.toFixed(2);
        await existingLedger.save();
      } else if (newAdv > 0) {
        let lDate = existing.date || '';
        if (lDate.includes('-') && lDate.split('-')[0].length === 4) {
          const parts = lDate.split('-');
          lDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        await AccountLedger.create({
          billNo: existing.performaNumber,
          performaId: String(existing._id),
          performaNumber: existing.performaNumber,
          customerName: existing.customerSnapshot.name.trim(),
          companyName: existing.companyName || 'General',
          date: lDate,
          debit: '0.00',
          credit: newAdv.toFixed(2),
          balance: '0.00',
          paymentMode: 'Bank',
          reference: existing.performaNumber,
          notes: 'Advance for Performa',
          type: 'ADVANCE',
        });
      }

      await recalculateCustomerBalance(existing.customerSnapshot.name.trim());
    }

    if (date) existing.date = date;
    if (notes !== undefined) existing.notes = notes;
    if (status) existing.status = status;

    if (products && Array.isArray(products)) {
      let totalReq = 0;
      let totalSub = 0;

      existing.products = products.map((item: any) => {
        const reqCases = parseFloat(item.requiredCases) || 0;
        const usedCases = parseFloat(item.usedCases) || 0;
        const rate = parseFloat(item.rate) || 0;
        const pktPerUnit = parseFloat(item.pktPerUnit) || 1;
        const allocated = parseFloat(item.allocatedAmount) || reqCases * rate * pktPerUnit;
        const usedAmt = parseFloat(item.usedAmount) || 0;

        totalReq += reqCases;
        totalSub += allocated;

        return {
          productId: item.productId,
          productSnapshot: {
            productCode: item.productSnapshot?.productCode || item.productCode || '',
            productName: item.productSnapshot?.productName || item.productName || 'Product',
            companyName: item.productSnapshot?.companyName || item.companyName || '',
            category: item.productSnapshot?.category || item.category || '',
          },
          requiredCases: reqCases,
          usedCases: usedCases,
          remainingCases: Math.max(0, reqCases - usedCases),
          caseOut: parseFloat(item.caseOut) || usedCases,
          rate: rate,
          pktPerUnit: pktPerUnit,
          allocatedAmount: allocated,
          usedAmount: usedAmt,
          remainingAmount: Math.max(0, allocated - usedAmt),
        };
      });

      existing.totalRequiredCases = totalReq;
      existing.totalRemainingCases = Math.max(0, totalReq - existing.totalUsedCases);
      existing.subtotal = Number(totalSub.toFixed(2));
    }

    // Recalculate discount, packing, tax, totalAllocatedAmount
    const subtotalAmt = existing.subtotal !== undefined ? existing.subtotal : (existing.products || []).reduce((s, p) => s + (p.allocatedAmount || 0), 0);
    const cleanDisc = String(existing.discount || '0').trim();
    const discNum = parseFloat(cleanDisc) || 0;
    let discountAmt = 0;
    if (discNum > 0) {
      if (cleanDisc.endsWith('%') || discNum <= 100) {
        discountAmt = (subtotalAmt * discNum) / 100;
      } else {
        discountAmt = discNum;
      }
    }
    discountAmt = Number(discountAmt.toFixed(2));
    const baseAfterDiscount = Math.max(0, subtotalAmt - discountAmt);

    const cleanPack = String(existing.packing || '0').trim();
    const packNum = parseFloat(cleanPack) || 0;
    let packingAmt = 0;
    if (packNum > 0) {
      if (cleanPack.endsWith('%') || packNum <= 100) {
        packingAmt = (baseAfterDiscount * packNum) / 100;
      } else {
        packingAmt = packNum;
      }
    }
    packingAmt = Number(packingAmt.toFixed(2));

    const cleanTax = String(existing.tax || '0').trim().replace(/[^0-9.]/g, '');
    const taxAmt = Number((parseFloat(cleanTax) || 0).toFixed(2));

    const finalAlloc = Math.max(0, Number((subtotalAmt - discountAmt + packingAmt + taxAmt).toFixed(2)));

    existing.discountAmount = discountAmt;
    existing.packingAmount = packingAmt;
    existing.taxAmount = taxAmt;
    existing.totalAllocatedAmount = finalAlloc;
    existing.totalRemainingAmount = Math.max(0, Number((finalAlloc - existing.totalUsedAmount).toFixed(2)));

    // Derive combined company names if products have companies
    if (existing.products && existing.products.length > 0) {
      const uniqueCompanies = Array.from(
        new Set(
          existing.products
            .map((p) => p.productSnapshot?.companyName?.trim())
            .filter((c): c is string => typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'general')
        )
      );
      if (uniqueCompanies.length > 0) {
        existing.companyName = uniqueCompanies.join(', ');
        if (existing.customerSnapshot) {
          existing.customerSnapshot.companyName = existing.companyName;
        }
      }
    }

    await existing.save();

    res.status(200).json({ success: true, data: existing });
  } catch (error) {
    next(error);
  }
};

export const cancelPerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const performa = await Performa.findById(id);
    if (!performa) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    performa.status = 'CANCELLED';
    await performa.save();

    await PerformaAudit.create({
      customerId: performa.customerId,
      customerName: performa.customerSnapshot.name,
      performaId: performa._id,
      performaNumber: performa.performaNumber,
      amount: performa.remainingAdvanceAmount,
      type: 'PERFORMA_CANCELLED',
      date: new Date().toISOString().split('T')[0],
      reference: `Cancellation of Performa ${performa.performaNumber}`,
      notes: 'Performa cancelled by user',
      createdBy: 'Admin',
    });

    res.status(200).json({ success: true, message: 'Performa cancelled successfully', data: performa });
  } catch (error) {
    next(error);
  }
};

export const deletePerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const performa = await Performa.findById(id);
    if (!performa) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    if (performa.totalUsedCases > 0 || performa.advanceUsedAmount > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete Performa with active consumptions. Please cancel instead or delete linked bills first.',
      });
      return;
    }

    await PerformaAudit.deleteMany({ performaId: performa._id });
    await AccountLedger.deleteMany({ performaId: String(performa._id) });
    await Performa.findByIdAndDelete(id);

    await recalculateCustomerBalance(performa.customerSnapshot.name);

    res.status(200).json({ success: true, message: 'Performa deleted successfully', data: {} });
  } catch (error) {
    next(error);
  }
};

export const addCustomerAdvance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, customerName, companyName, amount, date, paymentMode, reference, notes, createdBy = 'Admin' } = req.body;

    const result = await addCustomerCreditToMasterPerforma({
      customerId,
      customerName,
      companyName,
      creditAmount: amount,
      date,
      paymentMode,
      reference,
      notes,
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Advance credit added successfully',
      data: result.auditEntry,
      masterPerforma: result.masterPerforma,
      summary: result.summary,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCustomerSummaryEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = String(req.params.customerId || '');
    const summary = await getCustomerPerformaSummary(customerId);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getCustomerAuditHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = String(req.params.customerId || '');
    let customer: any = null;
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findById(customerId);
    }
    if (!customer) {
      customer = await Customer.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(customerId.trim())}$`, 'i') },
      });
    }

    const query: any = {};
    if (customer) {
      query.$or = [{ customerId: customer._id }, { customerName: customer.name }];
    } else {
      query.customerName = { $regex: new RegExp(`^${escapeRegex(customerId.trim())}$`, 'i') };
    }

    const audits = await PerformaAudit.find(query).sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, count: audits.length, data: audits });
  } catch (error) {
    next(error);
  }
};
