import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Performa, type IPerformaProductItem } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Customer } from '../models/Customer';
import { escapeRegex } from '../utils/ledgerUtils';

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
    else if (sortBy === 'value' || sortBy === 'totalAllocatedAmount') sortObj.totalAllocatedAmount = order;
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

    let totalAdvance = 0;
    let totalRemainingAdvance = 0;
    let totalRequiredCases = 0;

    const enrichedPerformas = performas.map((p: any) => {
      const adv = Number((p.advanceAmount || 0).toFixed(2));
      const performaTotalValue = Number((p.totalAllocatedAmount || 0).toFixed(2));
      const balanceAmount = Math.max(0, Number((performaTotalValue - adv).toFixed(2)));

      totalAdvance += adv;
      totalRemainingAdvance += adv;
      totalRequiredCases += p.totalRequiredCases || 0;

      return {
        ...p,
        initialAdvance: adv,
        additionalCredits: 0,
        totalAdvanceReceived: adv,
        totalAvailableAmount: adv,
        performaTotalValue,
        usedAmount: 0,
        remainingAmount: adv,
        advanceUsedAmount: 0,
        remainingAdvanceAmount: adv,
        balanceAmount,
        customerPendingAmount: balanceAmount,
        performaRemainingAmount: balanceAmount,
        customerBills: [],
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedPerformas.length,
      data: enrichedPerformas,
      summary: {
        totalPerformas: enrichedPerformas.length,
        totalAdvance: Number(totalAdvance.toFixed(2)),
        totalUsedAdvance: 0,
        totalRemainingAdvance: Number(totalRemainingAdvance.toFixed(2)),
        totalRequiredCases,
        totalUsedCases: 0,
        totalRemainingCases: totalRequiredCases,
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

    const adv = Number((performa.advanceAmount || 0).toFixed(2));
    const performaTotalValue = Number((performa.totalAllocatedAmount || 0).toFixed(2));
    const balanceAmount = Math.max(0, Number((performaTotalValue - adv).toFixed(2)));

    res.status(200).json({
      success: true,
      data: {
        ...performa.toObject(),
        initialAdvance: adv,
        additionalCredits: 0,
        totalAdvanceReceived: adv,
        totalAvailableAmount: adv,
        usedAmount: 0,
        remainingAmount: adv,
        advanceUsedAmount: 0,
        remainingAdvanceAmount: adv,
        balanceAmount,
        customerPendingAmount: balanceAmount,
        performaRemainingAmount: balanceAmount,
        customerBills: [],
        auditHistory: [],
        transactionHistory: [],
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
      existing.totalAdvanceReceived = newAdv;
      existing.remainingAdvanceAmount = newAdv;
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

    await PerformaAudit.deleteMany({ performaId: performa._id });
    await Performa.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Performa deleted successfully', data: {} });
  } catch (error) {
    next(error);
  }
};

export const addCustomerAdvance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, customerName, amount, date, paymentMode, reference, notes, createdBy = 'Admin' } = req.body;
    const parsedAmount = parseFloat(String(amount).replace(/,/g, '')) || 0;
    if (parsedAmount <= 0) {
      res.status(400).json({ success: false, error: 'Valid advance amount greater than 0 is required' });
      return;
    }

    const query: any = {};
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    } else if (customerName) {
      query['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    const performa = await Performa.findOne(query).sort({ createdAt: -1 });
    if (performa) {
      performa.advanceAmount = Number(((performa.advanceAmount || 0) + parsedAmount).toFixed(2));
      performa.remainingAdvanceAmount = Number(((performa.remainingAdvanceAmount || 0) + parsedAmount).toFixed(2));
      await performa.save();
    }

    const auditEntry = await PerformaAudit.create({
      customerId: performa?.customerId,
      customerName: customerName || performa?.customerSnapshot?.name || 'General',
      performaId: performa?._id,
      performaNumber: performa?.performaNumber || '',
      amount: parsedAmount,
      type: 'ADVANCE_RECEIVED',
      date: date || new Date().toISOString().split('T')[0],
      paymentMode: paymentMode || 'Bank',
      reference: reference || 'Performa Advance',
      notes: notes || 'Performa Advance',
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Advance credit added successfully',
      data: auditEntry,
      masterPerforma: performa,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCustomerSummaryEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = String(req.params.customerId || '');
    const query: any = {};
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    } else {
      query['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(customerId.trim())}$`, 'i') };
    }
    const performas = await Performa.find(query).sort({ createdAt: -1 }).lean();
    const totalAdv = performas.reduce((sum, p) => sum + (p.advanceAmount || 0), 0);
    const totalAlloc = performas.reduce((sum, p) => sum + (p.totalAllocatedAmount || 0), 0);
    const balance = Math.max(0, totalAlloc - totalAdv);

    res.status(200).json({
      success: true,
      data: {
        hasMasterPerforma: performas.length > 0,
        masterPerforma: performas[0] || null,
        activePerformas: performas.filter((p: any) => p.status === 'ACTIVE' || p.status === 'PARTIALLY_USED'),
        availableAdvance: totalAdv,
        availableAmount: totalAdv,
        balanceAmount: balance,
        customerPendingAmount: balance,
      },
    });
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
