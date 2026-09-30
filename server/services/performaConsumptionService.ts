import mongoose from 'mongoose';
import { Performa, type IPerforma } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Customer } from '../models/Customer';
import { AccountLedger } from '../models/AccountLedger';
import { escapeRegex, recalculateCustomerBalance } from '../utils/ledgerUtils';

export interface BillProductInput {
  particular: string;
  quantity: string;
  rate: string;
  pktUnit?: string;
  amount: string;
}

export interface ConsumptionResultItem {
  performaId: string;
  performaNumber: string;
  productId?: string;
  productName: string;
  casesConsumed: number;
  amountConsumed: number;
  remainingCasesInPerforma: number;
}

export interface BillConsumptionResult {
  consumed: boolean;
  totalCasesConsumed: number;
  totalAmountConsumed: number;
  items: ConsumptionResultItem[];
  warnings: string[];
  remainingCustomerAdvance: number;
}

/**
 * Find customer's single master Performa
 */
export const getCustomerMasterPerforma = async (
  customerIdentifier: string
): Promise<IPerforma | null> => {
  if (!customerIdentifier || customerIdentifier.trim() === '' || customerIdentifier.toLowerCase() === 'all') {
    return null;
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(customerIdentifier);
  let customer: any = null;
  if (isObjectId) {
    customer = await Customer.findById(customerIdentifier);
  }
  if (!customer) {
    const escaped = escapeRegex(customerIdentifier.trim());
    customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });
  }

  const customerName = customer ? customer.name : customerIdentifier.trim();
  const customerId = customer ? customer._id : null;

  const query: any = {
    $or: [{ 'customerSnapshot.name': { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') } }],
  };
  if (customerId) {
    query.$or.push({ customerId });
  }

  // Return the first/master Performa
  return await Performa.findOne(query).sort({ createdAt: 1, _id: 1 });
};

/**
 * Add credit payment to customer's account and Master Performa
 */
export const addCustomerCreditToMasterPerforma = async (params: {
  customerId?: string;
  customerName: string;
  companyName?: string;
  creditAmount: number | string;
  date?: string;
  paymentMode?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
}): Promise<{ ledgerEntry: any; auditEntry: any; masterPerforma: IPerforma | null; summary: any }> => {
  const {
    customerId,
    customerName,
    companyName = 'General',
    creditAmount,
    date = new Date().toISOString().split('T')[0],
    paymentMode = 'Bank',
    reference = '',
    notes = 'Additional customer advance via Add Credit',
    createdBy = 'Admin',
  } = params;

  const parsedCredit = parseFloat(String(creditAmount).replace(/,/g, '')) || 0;
  if (parsedCredit <= 0) {
    throw new Error('Valid credit amount greater than 0 is required');
  }

  // Resolve Customer
  let validCustomerId = customerId;
  let finalCustomerName = customerName.trim();
  if (validCustomerId && mongoose.Types.ObjectId.isValid(validCustomerId)) {
    const cust = await Customer.findById(validCustomerId);
    if (cust) finalCustomerName = cust.name.trim();
  } else {
    const cust = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(finalCustomerName)}$`, 'i') },
    });
    if (cust) {
      validCustomerId = String(cust._id);
      finalCustomerName = cust.name.trim();
    }
  }

  // Find Master Performa
  const masterPerforma = await getCustomerMasterPerforma(validCustomerId || finalCustomerName);

  if (masterPerforma) {
    masterPerforma.advanceAmount = Number((masterPerforma.advanceAmount + parsedCredit).toFixed(2));
    masterPerforma.remainingAdvanceAmount = Number(
      (masterPerforma.remainingAdvanceAmount + parsedCredit).toFixed(2)
    );
    if (masterPerforma.status === 'COMPLETED' && masterPerforma.totalRemainingCases > 0) {
      masterPerforma.status = 'PARTIALLY_USED';
    }
    await masterPerforma.save();
  }

  // Create PerformaAudit entry
  const auditEntry = await PerformaAudit.create({
    customerId: validCustomerId ? new mongoose.Types.ObjectId(validCustomerId) : masterPerforma?.customerId,
    customerName: finalCustomerName,
    performaId: masterPerforma?._id,
    performaNumber: masterPerforma?.performaNumber || '',
    amount: parsedCredit,
    type: 'ADVANCE_RECEIVED',
    date,
    paymentMode,
    reference: reference || (masterPerforma ? `Credit for ${masterPerforma.performaNumber}` : 'Customer Credit'),
    notes,
    createdBy,
  });

  // Create AccountLedger entry
  const ledgerEntry = await AccountLedger.create({
    billNo: masterPerforma?.performaNumber || '',
    performaId: masterPerforma ? String(masterPerforma._id) : undefined,
    performaNumber: masterPerforma?.performaNumber || '',
    customerName: finalCustomerName,
    companyName: companyName || masterPerforma?.companyName || 'General',
    date,
    debit: '0.00',
    credit: parsedCredit.toFixed(2),
    balance: '0.00',
    paymentMode,
    reference: reference || (masterPerforma ? `Credit for ${masterPerforma.performaNumber}` : ''),
    notes,
    type: 'CREDIT',
  });

  await recalculateCustomerBalance(finalCustomerName);

  const summary = await getCustomerPerformaSummary(validCustomerId || finalCustomerName);

  return {
    ledgerEntry,
    auditEntry,
    masterPerforma,
    summary,
  };
};

/**
 * Consume actual bill against customer's Master Performa
 */
export const consumeBillAgainstPerforma = async (
  particularId: string,
  billNo: string,
  customerName: string,
  billDate: string,
  products: BillProductInput[],
  billTotal: number
): Promise<BillConsumptionResult> => {
  const result: BillConsumptionResult = {
    consumed: false,
    totalCasesConsumed: 0,
    totalAmountConsumed: 0,
    items: [],
    warnings: [],
    remainingCustomerAdvance: 0,
  };

  if (!customerName || !products || products.length === 0) {
    return result;
  }

  try {
    const escapedCustomerName = escapeRegex(customerName.trim());
    const customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapedCustomerName}$`, 'i') },
    });

    const masterPerforma = await getCustomerMasterPerforma(customer ? String(customer._id) : customerName);

    if (!masterPerforma) {
      return result;
    }

    // Process each bill item against Master Performa
    let totalBillAmountConsumed = 0;

    for (const billItem of products) {
      const billedCases = parseFloat(billItem.quantity) || 0;
      const itemAmount = parseFloat(String(billItem.amount || '0').replace(/,/g, '')) || 0;
      const itemRate = parseFloat(String(billItem.rate || '0').replace(/,/g, '')) || 0;
      const billedNameNormalized = billItem.particular.trim().toLowerCase();

      if (billedCases <= 0) continue;

      let remainingCasesToConsume = billedCases;

      for (const pProd of masterPerforma.products) {
        if (remainingCasesToConsume <= 0) break;

        const pName = pProd.productSnapshot.productName.trim().toLowerCase();
        const pCode = (pProd.productSnapshot.productCode || '').trim().toLowerCase();

        // Match by SKU or Name
        if (pName === billedNameNormalized || (pCode && pCode === billedNameNormalized)) {
          const availableCases = pProd.remainingCases || 0;
          if (availableCases <= 0) continue;

          const casesToConsume = Math.min(remainingCasesToConsume, availableCases);
          if (casesToConsume <= 0) continue;

          // Consume actual bill item amount proportionally
          let consumedAmount = 0;
          if (billedCases > 0 && itemAmount > 0) {
            consumedAmount = Number(((casesToConsume / billedCases) * itemAmount).toFixed(2));
          } else {
            consumedAmount = Number((casesToConsume * itemRate).toFixed(2));
          }

          pProd.usedCases = Number((pProd.usedCases + casesToConsume).toFixed(2));
          pProd.caseOut = Number((pProd.caseOut + casesToConsume).toFixed(2));
          pProd.remainingCases = Math.max(0, Number((pProd.requiredCases - pProd.usedCases).toFixed(2)));
          pProd.usedAmount = Number((pProd.usedAmount + consumedAmount).toFixed(2));
          pProd.remainingAmount = Math.max(0, Number((pProd.allocatedAmount - pProd.usedAmount).toFixed(2)));

          totalBillAmountConsumed += consumedAmount;

          // Record audit log for product case consumption
          await PerformaAudit.create({
            customerId: customer?._id || masterPerforma.customerId,
            customerName: customerName.trim(),
            performaId: masterPerforma._id,
            performaNumber: masterPerforma.performaNumber,
            particularId: new mongoose.Types.ObjectId(particularId),
            billNo: billNo,
            productId: pProd.productId,
            productName: pProd.productSnapshot.productName,
            cases: casesToConsume,
            amount: consumedAmount,
            type: 'PERFORMA_CONSUMED',
            date: billDate,
            reference: `Bill #${billNo}`,
            notes: `Consumed ${casesToConsume} cases for bill #${billNo}`,
            createdBy: 'System',
          });

          result.consumed = true;
          result.totalCasesConsumed += casesToConsume;
          result.totalAmountConsumed += consumedAmount;
          result.items.push({
            performaId: String(masterPerforma._id),
            performaNumber: masterPerforma.performaNumber,
            productId: pProd.productId ? String(pProd.productId) : undefined,
            productName: pProd.productSnapshot.productName,
            casesConsumed: casesToConsume,
            amountConsumed: consumedAmount,
            remainingCasesInPerforma: pProd.remainingCases,
          });

          remainingCasesToConsume -= casesToConsume;
        }
      }
    }

    // If total billed products consumed money, reduce advance from Master Performa
    // Use actual final bill amount consumed
    const amountToDeduct = totalBillAmountConsumed > 0 ? totalBillAmountConsumed : (result.consumed ? billTotal : 0);

    masterPerforma.totalUsedCases = Number(
      masterPerforma.products.reduce((acc, curr) => acc + curr.usedCases, 0).toFixed(2)
    );
    masterPerforma.totalRemainingCases = Math.max(
      0,
      Number((masterPerforma.totalRequiredCases - masterPerforma.totalUsedCases).toFixed(2))
    );
    masterPerforma.advanceUsedAmount = Number((masterPerforma.advanceUsedAmount + amountToDeduct).toFixed(2));
    masterPerforma.remainingAdvanceAmount = Math.max(
      0,
      Number((masterPerforma.advanceAmount - masterPerforma.advanceUsedAmount).toFixed(2))
    );
    masterPerforma.totalUsedAmount = Number(
      masterPerforma.products.reduce((acc, curr) => acc + curr.usedAmount, 0).toFixed(2)
    );
    masterPerforma.totalRemainingAmount = Math.max(
      0,
      Number((masterPerforma.totalAllocatedAmount - masterPerforma.totalUsedAmount).toFixed(2))
    );

    const allItemsFulfilled = masterPerforma.products.every((p) => p.remainingCases <= 0);
    if (allItemsFulfilled) {
      masterPerforma.status = 'COMPLETED';
    } else if (masterPerforma.totalUsedCases > 0) {
      masterPerforma.status = 'PARTIALLY_USED';
    }

    await masterPerforma.save();

    const summary = await getCustomerPerformaSummary(customerName);
    result.remainingCustomerAdvance = summary.availableAmount;

    return result;
  } catch (err) {
    console.error(`[Performa Consumption Error for Bill ${billNo}]:`, err);
    return result;
  }
};

/**
 * Reverse bill consumption on update or deletion
 */
export const reverseBillConsumption = async (particularId: string): Promise<void> => {
  if (!particularId) return;

  try {
    const consumedAudits = await PerformaAudit.find({
      particularId: new mongoose.Types.ObjectId(particularId),
      type: 'PERFORMA_CONSUMED',
    });

    if (consumedAudits.length === 0) return;

    for (const audit of consumedAudits) {
      if (!audit.performaId) continue;

      const performa = await Performa.findById(audit.performaId);
      if (!performa) continue;

      const auditCases = audit.cases || 0;
      const auditAmount = audit.amount || 0;

      const pProd = performa.products.find((p) => {
        if (audit.productId && p.productId) {
          return String(p.productId) === String(audit.productId);
        }
        return (
          p.productSnapshot.productName.trim().toLowerCase() ===
          (audit.productName || '').trim().toLowerCase()
        );
      });

      if (pProd) {
        pProd.usedCases = Math.max(0, Number((pProd.usedCases - auditCases).toFixed(2)));
        pProd.caseOut = Math.max(0, Number((pProd.caseOut - auditCases).toFixed(2)));
        pProd.remainingCases = Math.min(
          pProd.requiredCases,
          Number((pProd.requiredCases - pProd.usedCases).toFixed(2))
        );
        pProd.usedAmount = Math.max(0, Number((pProd.usedAmount - auditAmount).toFixed(2)));
        pProd.remainingAmount = Math.min(
          pProd.allocatedAmount,
          Number((pProd.allocatedAmount - pProd.usedAmount).toFixed(2))
        );
      }

      performa.totalUsedCases = Number(
        performa.products.reduce((acc, curr) => acc + curr.usedCases, 0).toFixed(2)
      );
      performa.totalRemainingCases = Math.max(
        0,
        Number((performa.totalRequiredCases - performa.totalUsedCases).toFixed(2))
      );
      performa.advanceUsedAmount = Math.max(0, Number((performa.advanceUsedAmount - auditAmount).toFixed(2)));
      performa.remainingAdvanceAmount = Math.min(
        performa.advanceAmount,
        Number((performa.advanceAmount - performa.advanceUsedAmount).toFixed(2))
      );
      performa.totalUsedAmount = Number(
        performa.products.reduce((acc, curr) => acc + curr.usedAmount, 0).toFixed(2)
      );
      performa.totalRemainingAmount = Math.min(
        performa.totalAllocatedAmount,
        Number((performa.totalAllocatedAmount - performa.totalUsedAmount).toFixed(2))
      );

      if (performa.status !== 'CANCELLED') {
        if (performa.totalUsedCases === 0 && performa.advanceUsedAmount === 0) {
          performa.status = 'ACTIVE';
        } else if (performa.totalRemainingCases > 0) {
          performa.status = 'PARTIALLY_USED';
        }
      }

      await performa.save();

      // Record reversal audit
      await PerformaAudit.create({
        customerId: audit.customerId,
        customerName: audit.customerName,
        performaId: performa._id,
        performaNumber: performa.performaNumber,
        particularId: new mongoose.Types.ObjectId(particularId),
        billNo: audit.billNo,
        productId: audit.productId,
        productName: audit.productName,
        cases: auditCases,
        amount: auditAmount,
        type: 'PERFORMA_REVERSED',
        date: new Date().toISOString().split('T')[0],
        reference: `Reversal for Bill #${audit.billNo || particularId}`,
        notes: `Reversed ${auditCases} cases upon bill update/deletion`,
        createdBy: 'System',
      });
    }

    await PerformaAudit.deleteMany({
      particularId: new mongoose.Types.ObjectId(particularId),
      type: 'PERFORMA_CONSUMED',
    });
  } catch (err) {
    console.error(`[Performa Reversal Error for Particular ${particularId}]:`, err);
  }
};

/**
 * Get comprehensive customer master Performa summary and financial state
 */
export const getCustomerPerformaSummary = async (customerIdentifier: string): Promise<any> => {
  if (!customerIdentifier || customerIdentifier.trim() === '' || customerIdentifier.toLowerCase() === 'all') {
    return {
      customerId: null,
      customerName: '',
      hasMasterPerforma: false,
      masterPerforma: null,
      initialAdvance: 0,
      additionalCredits: 0,
      totalAdvanceReceived: 0,
      totalAdvanceUsed: 0,
      totalUsedByBills: 0,
      availableAdvance: 0,
      availableAmount: 0,
      totalAllocatedCases: 0,
      totalUsedCases: 0,
      totalRemainingCases: 0,
      ledgerTotalCredit: 0,
      ledgerTotalDebit: 0,
      ledgerCreditBalance: 0,
      transactionHistory: [],
    };
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(customerIdentifier);
  let customer: any = null;
  if (isObjectId) {
    customer = await Customer.findById(customerIdentifier);
  }
  if (!customer) {
    const escaped = escapeRegex(customerIdentifier.trim());
    customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });
  }

  const customerName = customer ? customer.name : customerIdentifier.trim();
  const customerId = customer ? customer._id : null;

  const masterPerforma = await getCustomerMasterPerforma(customerId ? String(customerId) : customerName);

  // Get all ledger entries for this customer
  const ledgerEntries = await AccountLedger.find({
    customerName: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') },
  }).sort({ date: 1, createdAt: 1, _id: 1 }).lean();

  let ledgerTotalCredit = 0;
  let ledgerTotalDebit = 0;
  for (const entry of ledgerEntries) {
    const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
    const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
    ledgerTotalCredit += cred;
    ledgerTotalDebit += deb;
  }
  const ledgerCreditBalance = Number((ledgerTotalCredit - ledgerTotalDebit).toFixed(2));

  // Get all audits for this customer
  const auditQuery: any = {
    $or: [{ customerName: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') } }],
  };
  if (customerId) auditQuery.$or.push({ customerId });

  const audits = await PerformaAudit.find(auditQuery).sort({ date: 1, createdAt: 1, _id: 1 }).lean();

  // Calculate Initial Advance vs Additional Credits
  let initialAdvance = 0;
  let additionalCredits = 0;
  let totalUsedByBills = 0;

  // If master performa exists, find the initial advance audit or performa's initial advance
  if (masterPerforma) {
    const initialAudit = audits.find(
      (a) =>
        a.type === 'ADVANCE_RECEIVED' &&
        (String(a.performaId) === String(masterPerforma._id) || a.reference?.includes('Initial Advance'))
    );

    if (initialAudit) {
      initialAdvance = Number(initialAudit.amount) || 0;
    } else {
      // Calculate from difference
      initialAdvance = masterPerforma.advanceAmount || 0;
    }

    // Additional credits from audits or ledger
    for (const a of audits) {
      if (a._id.toString() === initialAudit?._id?.toString()) continue;

      if (a.type === 'ADVANCE_RECEIVED' || a.type === 'PERFORMA_ADVANCE') {
        additionalCredits += Number(a.amount) || 0;
      } else if (a.type === 'PERFORMA_CONSUMED') {
        totalUsedByBills += Number(a.amount) || 0;
      } else if (a.type === 'PERFORMA_REVERSED') {
        totalUsedByBills = Math.max(0, totalUsedByBills - (Number(a.amount) || 0));
      }
    }
  } else {
    // No performa, but might have ledger credits
    additionalCredits = ledgerTotalCredit;
    totalUsedByBills = ledgerTotalDebit;
  }

  const totalAdvanceReceived = Number((initialAdvance + additionalCredits).toFixed(2));
  const availableAmount = Math.max(0, Number((totalAdvanceReceived - totalUsedByBills).toFixed(2)));

  // Build Chronological Transaction History with running balance
  const transactionHistory: any[] = [];
  let runningBal = 0;

  for (const a of audits) {
    let typeLabel = 'TRANSACTION';
    let delta = 0;

    if (a.type === 'ADVANCE_RECEIVED' && (a.reference?.includes('Initial Advance') || a.notes?.includes('Initial'))) {
      typeLabel = 'INITIAL ADVANCE';
      delta = Number(a.amount) || 0;
    } else if (a.type === 'ADVANCE_RECEIVED' || a.type === 'PERFORMA_ADVANCE') {
      typeLabel = 'ADDITIONAL CREDIT';
      delta = Number(a.amount) || 0;
    } else if (a.type === 'PERFORMA_CONSUMED') {
      typeLabel = 'BILL CONSUMPTION';
      delta = -(Number(a.amount) || 0);
    } else if (a.type === 'PERFORMA_REVERSED') {
      typeLabel = 'BILL REVERSAL';
      delta = Number(a.amount) || 0;
    } else if (a.type === 'PERFORMA_CANCELLED') {
      typeLabel = 'CANCELLED';
      delta = 0;
    }

    runningBal += delta;

    transactionHistory.push({
      _id: String(a._id),
      date: a.date,
      type: typeLabel,
      rawType: a.type,
      amount: Number(a.amount) || 0,
      delta,
      balance: Number(runningBal.toFixed(2)),
      reference: a.reference || a.performaNumber || '',
      billNo: a.billNo || '',
      paymentMode: a.paymentMode || 'Bank',
      notes: a.notes || '',
      createdBy: a.createdBy || 'Admin',
      createdAt: a.createdAt,
    });
  }

  return {
    customerId: customerId ? String(customerId) : null,
    customerName,
    idCode: customer?.idCode || '',
    phone: customer?.mobile || masterPerforma?.customerSnapshot?.phone || '',
    address: customer?.address || masterPerforma?.customerSnapshot?.address || '',
    gst: customer?.gst || masterPerforma?.customerSnapshot?.gst || '',
    hasMasterPerforma: !!masterPerforma,
    masterPerforma: masterPerforma
      ? {
          _id: String(masterPerforma._id),
          performaNumber: masterPerforma.performaNumber,
          date: masterPerforma.date,
          status: masterPerforma.status,
          companyName: masterPerforma.companyName,
          initialAdvance: Number(initialAdvance.toFixed(2)),
          additionalCredits: Number(additionalCredits.toFixed(2)),
          totalAdvanceReceived,
          totalUsedByBills,
          availableAmount,
          totalRequiredCases: masterPerforma.totalRequiredCases,
          totalUsedCases: masterPerforma.totalUsedCases,
          totalRemainingCases: masterPerforma.totalRemainingCases,
          products: masterPerforma.products.map((p) => ({
            productId: p.productId ? String(p.productId) : undefined,
            productCode: p.productSnapshot.productCode,
            productName: p.productSnapshot.productName,
            companyName: p.productSnapshot.companyName,
            category: p.productSnapshot.category,
            requiredCases: p.requiredCases,
            usedCases: p.usedCases,
            remainingCases: p.remainingCases,
            rate: p.rate,
            pktPerUnit: p.pktPerUnit,
            allocatedAmount: p.allocatedAmount,
            usedAmount: p.usedAmount,
            remainingAmount: p.remainingAmount,
          })),
        }
      : null,
    initialAdvance: Number(initialAdvance.toFixed(2)),
    additionalCredits: Number(additionalCredits.toFixed(2)),
    totalAdvanceReceived,
    totalAdvanceUsed: totalUsedByBills,
    totalUsedByBills,
    availableAdvance: availableAmount,
    availableAmount,
    totalAllocatedCases: masterPerforma?.totalRequiredCases || 0,
    totalUsedCases: masterPerforma?.totalUsedCases || 0,
    totalRemainingCases: masterPerforma?.totalRemainingCases || 0,
    ledgerTotalCredit: Number(ledgerTotalCredit.toFixed(2)),
    ledgerTotalDebit: Number(ledgerTotalDebit.toFixed(2)),
    ledgerCreditBalance,
    transactionHistory: transactionHistory.reverse(), // most recent first for UI tables
  };
};
