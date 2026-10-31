import type { Request, Response, NextFunction } from 'express';
import { Company } from '../models/Company';
import { escapeRegex } from '../utils/ledgerUtils';

/**
 * Helper to get the next available Company slNo (01, 02, ...).
 * - Scans all existing company slNo values.
 * - Extracts all existing numbers and raw codes.
 * - If requestedSlNo is provided:
 *     Checks if duplicate in DB. If duplicate, moves to the next number.
 * - If no requestedSlNo (or duplicate resolved):
 *     Finds the lowest available positive number (1, 2, 3...) filling any gaps
 *     caused by deletions (e.g. 01, 02...).
 * - Performs a final DB existence check to ensure uniqueness.
 */
export const getNextCompanySlNo = async (
  requestedSlNo?: string,
  excludeCompanyId?: string
): Promise<string> => {
  const query: any = {
    slNo: { $exists: true, $ne: null },
  };
  if (excludeCompanyId) {
    query._id = { $ne: excludeCompanyId };
  }

  const existingCompanies = await Company.find(query, 'slNo').lean();
  const usedNumbers = new Set<number>();
  const usedCodes = new Set<string>();

  for (const c of existingCompanies) {
    if (c.slNo) {
      const clean = String(c.slNo).trim().toUpperCase();
      usedCodes.add(clean);
      const match = clean.match(/\d+/);
      if (match) {
        usedNumbers.add(parseInt(match[0], 10));
      }
    }
  }

  let targetNum = 1;

  if (requestedSlNo && String(requestedSlNo).trim()) {
    const raw = String(requestedSlNo).trim().toUpperCase();
    const match = raw.match(/\d+/);
    if (match) {
      const reqNum = parseInt(match[0], 10);
      const formattedReq = reqNum.toString().padStart(2, '0');
      if (!usedCodes.has(raw) && !usedCodes.has(formattedReq) && !usedNumbers.has(reqNum)) {
        return formattedReq;
      }
      // Duplicate found! Move to the next number
      targetNum = reqNum + 1;
    } else {
      if (!usedCodes.has(raw)) {
        return raw;
      }
      targetNum = 1;
    }
  }

  while (usedNumbers.has(targetNum)) {
    targetNum++;
  }

  let finalSlNo = targetNum.toString().padStart(2, '0');

  while (
    await Company.exists({
      slNo: finalSlNo,
      ...(excludeCompanyId ? { _id: { $ne: excludeCompanyId } } : {}),
    })
  ) {
    targetNum++;
    finalSlNo = targetNum.toString().padStart(2, '0');
  }

  return finalSlNo;
};

export const getCompanies = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Backfill missing slNo for existing records if any
    const missingSlNoCompanies = await Company.find({
      $or: [{ slNo: { $exists: false } }, { slNo: null }, { slNo: '' }],
    });

    if (missingSlNoCompanies.length > 0) {
      for (const c of missingSlNoCompanies) {
        c.slNo = await getNextCompanySlNo();
        await c.save();
      }
    }

    const companies = await Company.find().lean();
    // Sort companies in ascending alphabetical order by name
    companies.sort((a: any, b: any) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
    res.status(200).json({ success: true, count: companies.length, data: companies });
  } catch (error) {
    next(error);
  }
};

export const getCompanyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

export const createCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const finalSlNo = await getNextCompanySlNo(req.body.slNo);

    const company = await Company.create({
      ...req.body,
      slNo: finalSlNo,
    });
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oldCompany = await Company.findById(req.params.id);
    if (!oldCompany) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }
    const oldName = oldCompany.name;

    if (req.body.slNo) {
      req.body.slNo = await getNextCompanySlNo(req.body.slNo, String(req.params.id));
    }

    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (company && req.body.name && req.body.name.trim() !== oldName.trim()) {
      const newName = req.body.name.trim();
      const escapedOldName = escapeRegex(oldName.trim());
      const { Particular } = await import('../models/Particular');
      const { AccountLedger } = await import('../models/AccountLedger');
      await Particular.updateMany(
        { companyName: { $regex: new RegExp(`^${escapedOldName}$`, 'i') } },
        { companyName: newName }
      );
      await AccountLedger.updateMany(
        { companyName: { $regex: new RegExp(`^${escapedOldName}$`, 'i') } },
        { companyName: newName }
      );
    }
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

export const deleteCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }
    const companyName = company.name;
    const escapedCompName = escapeRegex(companyName.trim());

    // 1. Delete Company
    await Company.findByIdAndDelete(req.params.id);

    // 2. Cascade Delete: Delete all Particulars for this company
    const { Particular } = await import('../models/Particular');
    const { AccountLedger } = await import('../models/AccountLedger');
    const { recalculateCustomerBalance } = await import('../utils/ledgerUtils');

    const particularsToDelete = await Particular.find({
      companyName: { $regex: new RegExp(`^${escapedCompName}$`, 'i') },
    });
    const affectedCustomers = [...new Set(particularsToDelete.map((p) => p.customerName))];

    await Particular.deleteMany({
      companyName: { $regex: new RegExp(`^${escapedCompName}$`, 'i') },
    });

    // 3. Cascade Delete: Delete all AccountLedger entries for this company
    await AccountLedger.deleteMany({
      companyName: { $regex: new RegExp(`^${escapedCompName}$`, 'i') },
    });

    // 4. Recalculate balances for affected customers
    for (const custName of affectedCustomers) {
      await recalculateCustomerBalance(custName);
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

