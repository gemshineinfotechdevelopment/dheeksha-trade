import { AccountLedger } from '../models/AccountLedger';

export const escapeRegex = (text: string): string => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export const cleanNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const getParticularNetTotal = (p: any): number => {
  if (!p) return 0;
  const storedTotal = cleanNumber(p.total);

  const prodSubtotal = (p.products || []).reduce((acc: number, item: any) => {
    const a = cleanNumber(item.amount);
    const q = cleanNumber(item.quantity);
    const r = cleanNumber(item.rate);
    const u = cleanNumber(item.pktUnit || item.pktPerUnit) || 1;
    return acc + (a > 0 ? a : q * r * u);
  }, 0);

  const subtotal = prodSubtotal > 0 ? prodSubtotal : cleanNumber(p.amount);

  let discountAmt = 0;
  const discStr = String(p.discount || '0').trim();
  const discNum = cleanNumber(discStr);
  const isDiscFlat = discStr.startsWith('₹') || discStr.toLowerCase().includes('rs');
  if (discStr.includes('%') || (!isDiscFlat && discNum > 0 && discNum <= 100)) {
    discountAmt = (subtotal * discNum) / 100;
  } else {
    discountAmt = discNum;
  }

  const baseAfterDisc = Math.max(0, subtotal - discountAmt);

  let packingAmt = 0;
  const packStr = String(p.packing || '0').trim();
  const packNum = cleanNumber(packStr);
  const isPackFlat = packStr.startsWith('₹') || packStr.toLowerCase().includes('rs');
  if (packStr.includes('%') || (!isPackFlat && packNum > 0 && packNum <= 100)) {
    packingAmt = (baseAfterDisc * packNum) / 100;
  } else {
    packingAmt = packNum;
  }

  const taxAmt = cleanNumber(p.tax);
  const calculatedNet = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);

  if (storedTotal > 0) {
    return Number(storedTotal.toFixed(2));
  }

  return Number(calculatedNet.toFixed(2));
};

export const recalculateCustomerBalance = async (customerName: string): Promise<void> => {
  if (!customerName || customerName.trim() === '' || customerName.toLowerCase() === 'all') return;
  try {
    const escapedName = escapeRegex(customerName.trim());
    const entries = await AccountLedger.find({
      customerName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    }).sort({ createdAt: 1, _id: 1 });

    let currentBalance = 0;
    for (const entry of entries) {
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      currentBalance = currentBalance + cred - deb;
      entry.balance = currentBalance.toFixed(2);
      await entry.save();
    }
  } catch (err) {
    console.error(`Failed to recalculate balance for customer ${customerName}:`, err);
  }
};

