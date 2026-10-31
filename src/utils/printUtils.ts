import type { BillPrintData } from '../components/BillPrintTemplate';

/**
 * Robust date parser supporting DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, ISO, etc.
 */
export const parseDateToTimestamp = (dateStr: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const clean = dateStr.trim();

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  const parsed = Date.parse(clean);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Checks whether an item's date falls within [fromDate, toDate]
 */
export const isDateInRange = (dateStr: string, fromDateStr: string, toDateStr: string): boolean => {
  if (!fromDateStr && !toDateStr) return true;
  const itemTime = parseDateToTimestamp(dateStr);
  if (!itemTime) return true;

  if (fromDateStr) {
    const fromTime = parseDateToTimestamp(fromDateStr);
    if (fromTime && itemTime < fromTime) return false;
  }

  if (toDateStr) {
    const toTime = parseDateToTimestamp(toDateStr);
    // Include the full day until 23:59:59
    if (toTime && itemTime > toTime + (24 * 60 * 60 * 1000 - 1)) return false;
  }

  return true;
};

export const generateBillHtml = (bill: BillPrintData): string => {
  // Calculate Subtotal from Products or bill.amount
  const prodSubtotal = (bill.products || []).reduce((acc, p) => {
    const amt = parseFloat(String(p.amount).replace(/,/g, '')) || 0;
    return acc + amt;
  }, 0);
  const subtotal = prodSubtotal > 0 ? prodSubtotal : (parseFloat(String(bill.amount || bill.total || '0').replace(/,/g, '')) || 0);

  // Discount calculation
  const rawDiscStr = String(bill.discount ?? '').trim();
  const cleanDisc = rawDiscStr.replace(/[^0-9.]/g, '');
  const discNum = parseFloat(cleanDisc) || 0;
  let discountAmt = 0;
  let discountLabel = 'Discount Amount';
  if (discNum > 0) {
    const isDiscFlat = rawDiscStr.startsWith('₹') || rawDiscStr.toLowerCase().includes('rs');
    if (rawDiscStr.includes('%') || (!isDiscFlat && discNum <= 100)) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount (${cleanDisc}%)`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount (₹${discNum.toLocaleString('en-IN')})`;
    }
  } else {
    discountLabel = 'Discount Amount';
  }

  const baseAfterDiscount = Math.max(0, subtotal - discountAmt);

  // Packing calculation (Calculated from reduced amount after discount or flat)
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    const isPackFlat = rawPackStr.startsWith('₹') || rawPackStr.toLowerCase().includes('rs');
    if (rawPackStr.includes('%') || (!isPackFlat && packNum <= 100)) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing (${cleanPack}%)`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing (₹${packNum.toLocaleString('en-IN')})`;
    }
  } else {
    packingLabel = 'Packing Charges';
  }

  // Tax calculation (Manual flat amount)
  const rawTaxStr = String(bill.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTaxStr) || 0;
  let taxAmt = 0;
  let taxLabel = 'Tax Amount';
  if (taxNum > 0) {
    taxAmt = taxNum;
    taxLabel = `Tax Amount (₹${taxNum.toLocaleString('en-IN')})`;
  } else {
    taxLabel = 'Tax Amount';
  }

  // Grand Total calculation
  const calculatedTotal = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  const rawTotalNum = parseFloat(String(bill.total ?? bill.amount ?? '0').replace(/,/g, '')) || 0;
  const finalTotalNum = rawTotalNum > 0 && Math.abs(rawTotalNum - calculatedTotal) < 0.05 ? rawTotalNum : calculatedTotal;
  const formattedTotal = finalTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  const preparedBy = bill.preparedBy || 'S.Nagaraj';
  const transportName = bill.transport && bill.transport.trim() !== '' && bill.transport !== '-' ? bill.transport.trim() : '-';
  const receiptSrc = bill.pdfData || bill.pdfUrl || '';

  const productRowsHtml = (bill.products || []).map((item, idx) => {
    const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
    const isEven = idx % 2 === 1;
    return `
      <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
        <td style="border: 1px solid #CBD5E1; padding: 7px 8px; text-align: center; color: #475569; font-weight: 600;">${idx + 1}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 10px; text-align: left; font-weight: 700; color: #0F172A;">${item.particular || '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 8px; text-align: center; font-weight: 700; color: #0F172A;">${item.quantity || '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 8px; text-align: right; color: #334155;">₹ ${(parseFloat(String(item.rate)) || 0).toFixed(2)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 8px; text-align: center; color: #64748B;">${item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 7px 10px; text-align: right; font-weight: 800; color: #0F172A;">₹ ${numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill #${bill.billNo || 'Invoice'} - Dheeksha Trade Link</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #FFFFFF;
      color: #0F172A;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .bill-wrapper {
      width: 100%;
      max-width: 794px;
      margin: 0 auto;
      padding: 6px;
    }
    .top-header {
      position: relative;
      text-align: center;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .signatory {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
    }
    .comp-name {
      font-size: 26px;
      font-weight: 900;
      color: #0B4DB7;
      margin-bottom: 2px;
      letter-spacing: -0.01em;
      text-transform: uppercase;
    }
    .comp-sub {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .doc-type-badge {
      display: inline-block;
      background: #0F172A;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3px 12px;
      border-radius: 4px;
      margin-top: 6px;
    }
    .meta-box {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 14px;
      background-color: #F8FAFC;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .meta-row {
      display: flex;
      margin-bottom: 4px;
      line-height: 1.4;
    }
    .meta-label {
      width: 120px;
      color: #64748B;
      font-weight: 600;
      font-size: 12px;
    }
    .meta-val {
      font-weight: 700;
      color: #0F172A;
      flex: 1;
    }
    .prod-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #0F172A;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .prod-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      border: 1px solid #0F172A;
      padding: 8px 8px;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .prod-table td {
      border: 1px solid #CBD5E1;
      padding: 7px 8px;
      vertical-align: middle;
    }
    .split-bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      page-break-inside: avoid;
    }
    .receipt-box {
      flex: 1 1 50%;
      max-width: 48%;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      min-height: 160px;
      max-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F8FAFC;
      padding: 6px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .receipt-img {
      max-width: 100%;
      max-height: 205px;
      object-fit: contain;
      display: block;
      border-radius: 4px;
    }
    .summary-box {
      flex: 1 1 50%;
      max-width: 48%;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #0F172A;
      font-size: 12px;
    }
    .summary-table td {
      border: 1px solid #CBD5E1;
      padding: 6px 10px;
    }
    .summary-label-cell {
      font-weight: 600;
      color: #334155;
      background-color: #F8FAFC;
    }
    .summary-val-cell {
      text-align: right;
      font-weight: 700;
      color: #0F172A;
    }
    .summary-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      font-weight: 900;
      font-size: 14px;
      padding: 8px 10px;
      border: 1px solid #0F172A !important;
    }
    .summary-total-row .summary-val-cell {
      color: #FFFFFF !important;
    }
    .sig-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px dashed #CBD5E1;
      font-size: 11.5px;
      page-break-inside: avoid;
    }
    .sig-block {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #0F172A;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="bill-wrapper">
    <!-- Header -->
    <div class="top-header">
      <div class="signatory">Prepared By: <b>${preparedBy}</b></div>
      <div class="comp-name">Dheeksha Trade Link</div>
      <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
      <div><span class="doc-type-badge">ESTIMATE / PARTICULAR BILL</span></div>
    </div>

    <!-- Metadata Block -->
    <div class="meta-box">
      <div>
        <div class="meta-row"><span class="meta-label">Bill No:</span><span class="meta-val" style="color:#0B4DB7; font-size:14px;">#${bill.billNo || '-'}</span></div>
        <div class="meta-row"><span class="meta-label">Customer Name:</span><span class="meta-val">${bill.customerName || '-'}</span></div>
        ${bill.companyName && bill.companyName.trim() ? `<div class="meta-row"><span class="meta-label">Company Name:</span><span class="meta-val">${bill.companyName.trim()}</span></div>` : ''}
        <div class="meta-row"><span class="meta-label">Transport Name:</span><span class="meta-val">${transportName}</span></div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-val">${bill.date || '-'}</span></div>
        <div class="meta-row"><span class="meta-label">Total Cases:</span><span class="meta-val" style="font-size:13.5px; color:#0B4DB7;">${computedCases}</span></div>
        <div class="meta-row"><span class="meta-label">Phone:</span><span class="meta-val">${bill.phone || '+91 98765 43210'}</span></div>
      </div>
    </div>

    <!-- Products Table -->
    <table class="prod-table">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th style="text-align: left;">Particular / Product Description</th>
          <th style="width: 75px; text-align: center;">Cases</th>
          <th style="width: 85px; text-align: right;">Rate (₹)</th>
          <th style="width: 80px; text-align: center;">Pkt / Unit</th>
          <th style="width: 110px; text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${productRowsHtml || '<tr><td colspan="6" style="text-align:center; padding:16px; color:#64748B;">No product items attached.</td></tr>'}
      </tbody>
    </table>

    <!-- Bottom Split Section: Left Uploaded Receipt & Right Summary Box -->
    <div class="split-bottom">
      <!-- Left Column: Uploaded Godown / Transport Receipt -->
      <div class="receipt-box">
        ${
          receiptSrc
            ? `<img src="${receiptSrc}" class="receipt-img" alt="Transport Receipt" />`
            : `<div style="text-align: center; color: #64748B; font-size: 11.5px; padding: 14px;">
                 <div style="font-weight: 700; color: #0F172A; margin-bottom: 4px; font-size: 12px;">TRANSPORT / GODOWN RECEIPT</div>
                 <div>(No physical receipt attached for this bill)</div>
               </div>`
        }
      </div>

      <!-- Right Column: Summary Table -->
      <div class="summary-box">
        <table class="summary-table">
          <tbody>
            <tr>
              <td class="summary-label-cell">Subtotal / Particular Amount</td>
              <td class="summary-val-cell">₹ ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="summary-label-cell" style="color: ${discountAmt > 0 ? '#DC2626' : '#334155'};">${discountLabel}</td>
              <td class="summary-val-cell" style="color: ${discountAmt > 0 ? '#DC2626' : '#64748B'};">- ₹ ${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="summary-label-cell">${packingLabel}</td>
              <td class="summary-val-cell" style="color: ${packingAmt > 0 ? '#0F172A' : '#64748B'};">+ ₹ ${packingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="summary-label-cell">${taxLabel}</td>
              <td class="summary-val-cell" style="color: ${taxAmt > 0 ? '#0F172A' : '#64748B'};">+ ₹ ${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr class="summary-total-row">
              <td>NET TOTAL AMOUNT</td>
              <td class="summary-val-cell">₹ ${formattedTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Signatures -->
    <div class="sig-section">
      <div class="sig-block">
        <div style="height: 28px;"></div>
        <div class="sig-line"></div>
        <div style="font-weight: 700; color:#334155;">Customer Signature</div>
      </div>
      <div class="sig-block">
        <div style="font-weight: 700; color:#0F172A; margin-bottom: 24px;">For Dheeksha Trade Link</div>
        <div class="sig-line"></div>
        <div style="font-weight: 700; color:#334155;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Direct print function that opens an isolated, clean print window
 * Guaranteed to print ONLY the full-page A4 bill document!
 */
export const printBillDirectly = (bill: BillPrintData) => {
  const htmlContent = generateBillHtml(bill);
  triggerBrowserPrint(htmlContent);
};

/**
 * =======================================================================
 * MASTER / BULK LIST PRINT GENERATORS (Standard A4 Format)
 * =======================================================================
 */

export const generateCustomerListPrintHtml = (
  customers: any[],
  reportTitle = 'CUSTOMERS MASTER LEDGER & BALANCES REPORT',
  dateRangeText?: string
): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));

  let overallDebit = 0;
  let overallCredit = 0;
  let overallPendingDue = 0;
  let overallAdvanceHeld = 0;

  customers.forEach((c) => {
    const deb = c.totalDebit || 0;
    const cred = c.totalCredit || 0;
    const due = c.pendingDue || 0;
    const net = c.netBalance || 0;

    overallDebit += deb;
    overallCredit += cred;
    overallPendingDue += due;
    if (net > 0) overallAdvanceHeld += net;
  });

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageCustomers = customers.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageDebit = 0;
    let pageCredit = 0;
    let pagePendingDue = 0;
    let pageAdvanceHeld = 0;

    pageCustomers.forEach((c) => {
      const deb = c.totalDebit || 0;
      const cred = c.totalCredit || 0;
      const due = c.pendingDue || 0;
      const net = c.netBalance || 0;

      pageDebit += deb;
      pageCredit += cred;
      pagePendingDue += due;
      if (net > 0) pageAdvanceHeld += net;
    });

    const pageRowsHtml = pageCustomers.map((c, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const idDisplay = c.idCode || `#${(globalIdx + 1).toString().padStart(4, '0')}`;
      const deb = (c.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const cred = (c.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const isEven = localIdx % 2 === 1;

      let balanceHtml = '';
      if ((c.pendingDue || 0) > 0) {
        balanceHtml = `<span style="color:#DC2626; font-weight:800;">₹ ${(c.pendingDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Due)</span>`;
      } else if ((c.netBalance || 0) > 0) {
        balanceHtml = `<span style="color:#0284C7; font-weight:800;">+₹ ${(c.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)</span>`;
      } else {
        balanceHtml = `<span style="color:#16A34A; font-weight:700;">₹ 0.00 (Settled)</span>`;
      }

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width: 30px;">${globalIdx + 1}</td>
          <td class="text-center" style="width: 55px; font-weight:700; color:#475569;">${idDisplay}</td>
          <td style="font-weight:800; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${c.name}</td>
          <td style="color:#475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 195px;">${c.address || '-'}</td>
          <td class="text-right" style="font-weight:700; color:#1E293B; width: 90px;">₹ ${deb}</td>
          <td class="text-right" style="font-weight:700; color:#16A34A; width: 90px;">₹ ${cred}</td>
          <td class="text-right" style="width: 105px;">${balanceHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">DHEEKSHA TRADE LINK</div>
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
            <div class="report-heading">${reportTitle}</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Records: <span class="meta-bold">${customers.length} Customers</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Customers</div>
            <div class="kpi-val">${customers.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Debit (Purchases)</div>
            <div class="kpi-val">₹ ${overallDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Credit (Paid)</div>
            <div class="kpi-val" style="color:#16A34A;">₹ ${overallCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:#FEF2F2; border-color:#FECACA;">
            <div class="kpi-title" style="color:#991B1B;">Total Pending Due</div>
            <div class="kpi-val" style="color:#DC2626;">₹ ${overallPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:#F0F9FF; border-color:#BAE6FD;">
            <div class="kpi-title" style="color:#0369A1;">Total Advance Balances</div>
            <div class="kpi-val" style="color:#0284C7;">₹ ${overallAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 6px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">DHEEKSHA TRADE LINK</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• ${reportTitle}</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 10px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageCustomers.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Customer Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 30px;">#</th>
              <th class="text-center" style="width: 55px;">ID</th>
              <th style="width: 180px;">Customer Name</th>
              <th style="width: 195px;">Address</th>
              <th class="text-right" style="width: 90px;">Debit (Dr)</th>
              <th class="text-right" style="width: 90px;">Credit (Cr)</th>
              <th class="text-right" style="width: 105px;">Net Balance / Status</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="7" class="text-center" style="padding: 20px;">No customer records found for the selected range.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Printed at bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="4" class="text-right" style="padding-right: 8px;">
                PAGE ${pageIdx + 1} TOTAL (${pageCustomers.length} Records):
              </td>
              <td class="text-right">₹ ${pageDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${pageCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ${
                  pagePendingDue > 0
                    ? `Due: ₹ ${pagePendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : pageAdvanceHeld > 0
                    ? `+₹ ${pageAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)`
                    : `Settled`
                }
              </td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTALS -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="4" class="text-right" style="padding-right: 8px;">
                OVERALL GRAND TOTALS (${customers.length} Customers):
              </td>
              <td class="text-right">₹ ${overallDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${overallCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ${
                  overallPendingDue > 0
                    ? `Due: ₹ ${overallPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : overallAdvanceHeld > 0
                    ? `+₹ ${overallAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)`
                    : `Settled`
                }
              </td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .comp-name {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 5px;
      margin-bottom: 6px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 10px;
      padding: 5px 4px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 4px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 33px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 4px;
      height: 25px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10.5px;
      font-weight: 900;
      padding: 4px 4px;
      height: 26px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printCustomerListDirectly = (customers: any[], reportTitle?: string, dateRangeText?: string) => {
  const htmlContent = generateCustomerListPrintHtml(customers, reportTitle, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Customer Account Statement / Ledger History (A4 Standard)
 */
export const generateLedgerStatementHtml = (
  customerName: string,
  ledgerEntries: any[],
  dateRangeText?: string
): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 30;
  const totalPages = Math.max(1, Math.ceil(ledgerEntries.length / PAGE_SIZE));

  let totalDeb = 0;
  let totalCred = 0;

  ledgerEntries.forEach((entry) => {
    const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
    const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
    totalDeb += deb;
    totalCred += cred;
  });

  const netBalance = totalDeb - totalCred;

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageEntries = ledgerEntries.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageDeb = 0;
    let pageCred = 0;

    pageEntries.forEach((entry) => {
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      pageDeb += deb;
      pageCred += cred;
    });

    const pageNet = pageDeb - pageCred;

    const pageRowsHtml = pageEntries.map((entry, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      const isEven = localIdx % 2 === 1;

      const desc = entry.billNo ? `Bill #${entry.billNo}` : entry.type || 'PAYMENT / RECEIPT';

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width:30px;">${globalIdx + 1}</td>
          <td class="text-center" style="width:75px; color:#334155;">${entry.date || '-'}</td>
          <td style="font-weight:700; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${desc}</td>
          <td style="color:#475569; font-size:9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 155px;">${entry.companyName || '-'}</td>
          <td class="text-right" style="width:105px; color:#1E293B; font-weight:700;">${deb > 0 ? `₹ ${deb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td class="text-right" style="width:105px; color:#16A34A; font-weight:700;">${cred > 0 ? `₹ ${cred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
          <td class="text-right" style="width:110px; font-weight:800; color:#0B4DB7;">₹ ${entry.balance || '0.00'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">DHEEKSHA TRADE LINK</div>
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
            <div class="report-heading">ACCOUNT STATEMENT: ${customerName.toUpperCase()}</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Transactions: <span class="meta-bold">${ledgerEntries.length} Records</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Purchases / Debit (Dr)</div>
            <div class="kpi-val" style="color:#0F172A;">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Received / Credit (Cr)</div>
            <div class="kpi-val" style="color:#16A34A;">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card" style="background-color:${netBalance > 0 ? '#FEF2F2' : '#F0FDF4'}; border-color:${netBalance > 0 ? '#FECACA' : '#BBF7D0'};">
            <div class="kpi-title" style="color:${netBalance > 0 ? '#991B1B' : '#166534'};">Net Balance Status</div>
            <div class="kpi-val" style="color:${netBalance > 0 ? '#DC2626' : '#16A34A'};">
              ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? '(Due Pending)' : netBalance < 0 ? '(Advance Held)' : '(Settled)'}
            </div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">DHEEKSHA TRADE LINK</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• ACCOUNT STATEMENT: ${customerName.toUpperCase()}</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 9.5px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageEntries.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Account Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width:30px;">#</th>
              <th class="text-center" style="width:75px;">Date</th>
              <th style="width:150px;">Particulars / Description</th>
              <th style="width:155px;">Company Name</th>
              <th class="text-right" style="width:105px;">Debit (Dr)</th>
              <th class="text-right" style="width:105px;">Credit (Cr)</th>
              <th class="text-right" style="width:110px;">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="7" class="text-center" style="padding:18px; color:#64748B;">No transaction entries found for the selected period.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="4" class="text-right" style="padding-right:8px;">PAGE ${pageIdx + 1} TOTAL (${pageEntries.length} Records):</td>
              <td class="text-right">₹ ${pageDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${pageCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ₹ ${Math.abs(pageNet).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${pageNet > 0 ? 'Dr' : pageNet < 0 ? 'Cr' : ''}
              </td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTAL -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="4" class="text-right" style="padding-right:8px;">OVERALL GRAND TOTALS (${ledgerEntries.length} Records):</td>
              <td class="text-right">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">
                ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? 'Dr' : netBalance < 0 ? 'Cr' : ''}
              </td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Customer Verification</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Account Statement - ${customerName} - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .comp-name {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 5px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 9.5px;
      padding: 4px 4px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 4px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 28px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 4px;
      height: 23px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10.5px;
      font-weight: 900;
      padding: 4px 4px;
      height: 25px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printLedgerStatementDirectly = (customerName: string, ledgerEntries: any[], dateRangeText?: string) => {
  const htmlContent = generateLedgerStatementHtml(customerName, ledgerEntries, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Particulars Bills Master List (A4 Standard)
 */
export const generateParticularsListPrintHtml = (particulars: any[], dateRangeText?: string): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 30;
  const totalPages = Math.max(1, Math.ceil(particulars.length / PAGE_SIZE));

  let overallTotalSum = 0;
  let overallSubtotalSum = 0;
  let overallCasesSum = 0;

  particulars.forEach((p) => {
    const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
    const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;
    const cases = parseFloat(String(p.caseCount || '0')) || 0;
    overallTotalSum += amt;
    overallSubtotalSum += subAmt;
    overallCasesSum += cases;
  });

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageItems = particulars.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageTotalSum = 0;
    let pageSubtotalSum = 0;
    let pageCasesSum = 0;

    pageItems.forEach((p) => {
      const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
      const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;
      const cases = parseFloat(String(p.caseCount || '0')) || 0;
      pageTotalSum += amt;
      pageSubtotalSum += subAmt;
      pageCasesSum += cases;
    });

    const pageRowsHtml = pageItems.map((p, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const isEven = localIdx % 2 === 1;
      const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
      const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;

      const discStr = p.discount && String(p.discount).trim() !== '' && p.discount !== '0' && p.discount !== '-' ? String(p.discount) : '-';
      const packStr = p.packing && String(p.packing).trim() !== '' && p.packing !== '0' && p.packing !== '-' ? String(p.packing) : '-';
      const taxStr = p.tax && String(p.tax).trim() !== '' && p.tax !== '0' && p.tax !== '-' ? `₹${p.tax}` : '-';

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width:26px;">${globalIdx + 1}</td>
          <td class="text-center" style="font-weight:800; color:#0B4DB7; width:52px;">#${p.billNo || '-'}</td>
          <td class="text-center" style="width:65px; color:#334155;">${p.date || '-'}</td>
          <td style="font-weight:700; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${p.customerName || '-'}</td>
          <td style="color:#475569; font-size:9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 105px;">${p.companyName || '-'}</td>
          <td class="text-center" style="width:38px; font-weight:700;">${p.caseCount || '-'}</td>
          <td class="text-right" style="width:72px; color:#334155;">₹ ${subAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-center" style="width:42px; color:${discStr !== '-' ? '#DC2626' : '#94A3B8'}; font-weight:600;">${discStr}</td>
          <td class="text-center" style="width:42px; color:${packStr !== '-' ? '#0F172A' : '#94A3B8'}; font-weight:600;">${packStr}</td>
          <td class="text-center" style="width:42px; color:${taxStr !== '-' ? '#0F172A' : '#94A3B8'}; font-weight:600;">${taxStr}</td>
          <td class="text-right" style="font-weight:800; width:82px; color:#0F172A;">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">DHEEKSHA TRADE LINK</div>
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
            <div class="report-heading">PARTICULARS BILLS MASTER REPORT</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Records: <span class="meta-bold">${particulars.length} Bills</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Bills Count</div>
            <div class="kpi-val">${particulars.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Cases Billed</div>
            <div class="kpi-val" style="color:#0B4DB7;">${overallCasesSum}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Billed Amount</div>
            <div class="kpi-val" style="color:#16A34A;">₹ ${overallTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">DHEEKSHA TRADE LINK</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• PARTICULARS BILLS MASTER REPORT</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 9.5px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageItems.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Particulars Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width:26px;">#</th>
              <th class="text-center" style="width:52px;">Bill No</th>
              <th class="text-center" style="width:65px;">Date</th>
              <th style="width:140px;">Customer Name</th>
              <th style="width:105px;">Company</th>
              <th class="text-center" style="width:38px;">Cases</th>
              <th class="text-right" style="width:72px;">Subtotal</th>
              <th class="text-center" style="width:42px;">Disc</th>
              <th class="text-center" style="width:42px;">Pack</th>
              <th class="text-center" style="width:42px;">Tax</th>
              <th class="text-right" style="width:82px;">Net Total</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="11" class="text-center" style="padding:18px; color:#64748B;">No bill records found for the selected period.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="5" class="text-right" style="padding-right:8px;">PAGE ${pageIdx + 1} TOTAL (${pageItems.length} Bills):</td>
              <td class="text-center">${pageCasesSum}</td>
              <td class="text-right">₹ ${pageSubtotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td colspan="3"></td>
              <td class="text-right">₹ ${pageTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTAL -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="5" class="text-right" style="padding-right:8px;">OVERALL GRAND TOTAL (${particulars.length} Bills):</td>
              <td class="text-center">${overallCasesSum}</td>
              <td class="text-right">₹ ${overallSubtotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td colspan="3"></td>
              <td class="text-right">₹ ${overallTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Particulars Bills Master Report - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .comp-name {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 5px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 9px;
      padding: 4px 3px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 3px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 28px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 3px;
      height: 23px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10px;
      font-weight: 900;
      padding: 4px 3px;
      height: 24px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printParticularsListDirectly = (particulars: any[], dateRangeText?: string) => {
  const htmlContent = generateParticularsListPrintHtml(particulars, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Companies List (A4 Standard)
 */
export const generateCompaniesListPrintHtml = (companies: any[]): string => {
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const rowsHtml = companies.map((c, idx) => {
    const isEven = idx % 2 === 1;
    return `
    <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
      <td class="text-center" style="width:40px; border: 1px solid #CBD5E1; padding: 6px;">${idx + 1}</td>
      <td style="font-weight:700; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">${c.name}</td>
      <td style="color:#334155; border: 1px solid #CBD5E1; padding: 6px 8px;">${c.gstin || '-'}</td>
      <td style="color:#475569; border: 1px solid #CBD5E1; padding: 6px 8px;">${c.address || '-'}</td>
    </tr>
  `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Companies List - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; color:#0F172A; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color:#FFFFFF; border: 1px solid #0F172A; padding: 7px; font-weight: 800; font-size: 11px; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 6px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:24px; font-weight:900; color:#0B4DB7;">DHEEKSHA TRADE LINK</div>
      <h2 style="font-size:15px; margin-top:2px;">COMPANIES DIRECTORY</h2>
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Date: <b>${currentDate}</b></div>
      <div>Total Companies: <b>${companies.length}</b></div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th>Company Name</th>
        <th>GSTIN</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" class="text-center" style="padding:16px;">No companies found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printCompaniesListDirectly = (companies: any[]) => {
  const htmlContent = generateCompaniesListPrintHtml(companies);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Products List (A4 Standard)
 */
export const generateProductsListPrintHtml = (products: any[]): string => {
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const rowsHtml = products.map((p, idx) => {
    const isEven = idx % 2 === 1;
    return `
    <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
      <td class="text-center" style="width:40px; border: 1px solid #CBD5E1; padding: 6px;">${idx + 1}</td>
      <td style="font-weight:700; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">${p.name}</td>
      <td class="text-center" style="color:#64748B; border: 1px solid #CBD5E1; padding: 6px;">${p.hsnCode || '-'}</td>
      <td style="text-align:right; font-weight:700; color:#0B4DB7; border: 1px solid #CBD5E1; padding: 6px 8px;">₹ ${(parseFloat(p.rate) || 0).toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Products Catalog - ${currentDate}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin:0; padding:8px; color:#0F172A; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color:#FFFFFF; border: 1px solid #0F172A; padding: 7px; font-weight: 800; font-size: 11px; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 6px; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:24px; font-weight:900; color:#0B4DB7;">DHEEKSHA TRADE LINK</div>
      <h2 style="font-size:15px; margin-top:2px;">PRODUCTS PRICE CATALOG</h2>
    </div>
    <div style="text-align:right; font-size:11.5px;">
      <div>Date: <b>${currentDate}</b></div>
      <div>Total Products: <b>${products.length}</b></div>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th>Product Name</th>
        <th class="text-center">HSN Code</th>
        <th style="text-align:right;">Default Rate</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" class="text-center" style="padding:16px;">No products found.</td></tr>'}
    </tbody>
  </table>
</body>
</html>
  `;
};

export const printProductsListDirectly = (products: any[]) => {
  const htmlContent = generateProductsListPrintHtml(products);
  triggerBrowserPrint(htmlContent);
};

/**
 * Print Performa Quotation / Invoice (A4 Standard)
 */
export const generatePerformaHtml = (performa: any): string => {
  const customer = performa.customerSnapshot || { name: performa.customerName || 'Customer' };
  const formatCurrency = (val: number | undefined) => {
    const num = val || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const rawSubtotal = (performa.products || []).reduce(
    (acc: number, p: any) =>
      acc +
      (p.allocatedAmount !== undefined && Number(p.allocatedAmount) > 0
        ? Number(p.allocatedAmount)
        : (Number(p.requiredCases) || 0) * (Number(p.rate) || 0) * (Number(p.pktPerUnit || p.pktUnit) || 1)),
    0
  );
  const subtotalVal = performa.subtotal !== undefined && performa.subtotal > 0 ? performa.subtotal : rawSubtotal;

  const rawDisc = String(performa.discount ?? '').trim();
  const cleanDisc = rawDisc.replace(/[^0-9.]/g, '');
  const discNum = parseFloat(cleanDisc) || 0;
  let discountAmt = 0;
  if (performa.discountAmount !== undefined && Number(performa.discountAmount) > 0) {
    discountAmt = Number(performa.discountAmount);
  } else if (discNum > 0) {
    if (rawDisc.includes('%') || discNum <= 100) {
      discountAmt = (subtotalVal * discNum) / 100;
    } else {
      discountAmt = discNum;
    }
  }

  const baseAfterDiscount = Math.max(0, subtotalVal - discountAmt);

  const rawPack = String(performa.packing ?? '').trim();
  const cleanPack = rawPack.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  if (performa.packingAmount !== undefined && Number(performa.packingAmount) > 0) {
    packingAmt = Number(performa.packingAmount);
  } else if (packNum > 0) {
    if (rawPack.includes('%') || packNum <= 100) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
    } else {
      packingAmt = packNum;
    }
  }

  const rawTax = String(performa.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTax) || 0;
  let taxAmt = 0;
  if (performa.taxAmount !== undefined && Number(performa.taxAmount) > 0) {
    taxAmt = Number(performa.taxAmount);
  } else if (taxNum > 0) {
    taxAmt = taxNum;
  }

  const totalAllocatedVal = Math.max(0, subtotalVal - discountAmt + packingAmt + taxAmt);

  const billsTotalCases = (performa.customerBills || []).reduce(
    (acc: number, b: any) => acc + (parseFloat(String(b.caseCount || 0)) || 0),
    0
  );
  const billsTotalAmt = (performa.customerBills || []).reduce(
    (acc: number, b: any) => acc + (parseFloat(String(b.netTotal || b.total || b.amount || 0)) || 0),
    0
  );

  const productRowsHtml = (performa.products || []).map((item: any, idx: number) => {
    const isEven = idx % 2 === 1;
    const prodName = item.productSnapshot?.productName || item.productName || item.particular || 'Product';
    const prodCode = item.productSnapshot?.productCode || item.productCode || '';
    const compName = (item.companyName && String(item.companyName).trim()) || item.productSnapshot?.companyName || performa.companyName || '';
    const rateVal = parseFloat(String(item.rate || 0)) || 0;
    const allocatedVal = parseFloat(String(item.allocatedAmount || ((parseFloat(item.requiredCases) || 0) * rateVal * (parseFloat(item.pktPerUnit || item.pktUnit) || 1)))) || 0;

    return `
    <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
      <td style="padding: 7px 6px; text-align: center; color: #475569; border: 1px solid #CBD5E1; font-weight: 600;">${idx + 1}</td>
      <td style="padding: 7px 10px; border: 1px solid #CBD5E1;">
        <div style="font-weight: 700; color: #0F172A;">${prodName}</div>
        ${prodCode ? `<div style="font-size: 10.5px; color: #64748B;">Code: ${prodCode}</div>` : ''}
      </td>
      <td style="padding: 7px 8px; border: 1px solid #CBD5E1; color: #0B4DB7; font-weight: 600; font-size: 11.5px;">
        ${compName || '-'}
      </td>
      <td style="padding: 7px 6px; text-align: center; font-weight: 800; color: #0F172A; border: 1px solid #CBD5E1;">
        ${item.requiredCases}
      </td>
      <td style="padding: 7px 8px; text-align: right; border: 1px solid #CBD5E1; color: #334155;">
        ₹ ${formatCurrency(rateVal)}
      </td>
      <td style="padding: 7px 6px; text-align: center; border: 1px solid #CBD5E1; color: #64748B;">
        ${item.pktPerUnit || 1}
      </td>
      <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #0F172A; border: 1px solid #CBD5E1;">
        ₹ ${formatCurrency(allocatedVal)}
      </td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Performa - ${performa.performaNumber || 'Quotation'}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 8px; color: #0F172A; background: #FFFFFF; }
          .banner { background-color: #0F172A; color: #FFFFFF; text-align: center; padding: 6px 12px; border-radius: 4px; font-weight: 800; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; }
          .meta-card { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; background-color: #F8FAFC; font-size: 12.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; border: 1px solid #0F172A; }
          th { background-color: #0F172A; color: #FFFFFF; border: 1px solid #0F172A; padding: 8px 6px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
          td { border: 1px solid #CBD5E1; vertical-align: middle; }
          .summary-card { width: 44%; font-size: 12.5px; border: 1px solid #CBD5E1; border-radius: 6px; background-color: #F8FAFC; padding: 10px 14px; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div style="position: relative; text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 10px;">
          <div style="position: absolute; right: 0; top: 0; font-size: 12px; font-weight: 700; color: #475569;">Prepared By: <b>${performa.preparedBy || 'S.Nagaraj'}</b></div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0B4DB7; margin: 0 0 2px 0; text-transform: uppercase;">Dheeksha Trade Link</h1>
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Wholesale & Retail Trading • Sivakasi</div>
        </div>

        <div class="banner">PERFORMA INVOICE / QUOTATION (NOT A TAX INVOICE)</div>

        <div class="meta-card">
          <div>
            <div style="margin-bottom: 4px;"><span style="color: #64748B; font-weight: 600;">Performa No: </span><span style="font-weight: 900; color: #0B4DB7; font-size: 15px;">#${performa.performaNumber || '-'}</span></div>
            <div style="margin-bottom: 4px;"><span style="color: #64748B; font-weight: 600;">Date: </span><span style="font-weight: 700;">${performa.date || '-'}</span></div>
            <div>
              <span style="color: #64748B; font-weight: 600;">Status: </span>
              <span style="font-weight: 800; color: ${performa.status === 'ACTIVE' ? '#16A34A' : performa.status === 'PARTIALLY_USED' ? '#D97706' : '#0B4DB7'}; font-size: 11.5px;">
                ${performa.status || 'ACTIVE'}
              </span>
            </div>
          </div>
          <div>
            <div style="margin-bottom: 4px;"><span style="color: #64748B; font-weight: 600;">Customer: </span><span style="font-weight: 800; font-size: 13.5px; color: #0F172A;">${customer.name || '-'}</span></div>
            ${customer.phone ? `<div style="margin-bottom: 4px;"><span style="color: #64748B; font-weight: 600;">Phone: </span><span style="font-weight: 600;">${customer.phone}</span></div>` : ''}
            ${customer.companyName ? `<div style="margin-bottom: 4px;"><span style="color: #64748B; font-weight: 600;">Company: </span><span>${customer.companyName}</span></div>` : ''}
            ${customer.address ? `<div><span style="color: #64748B; font-weight: 600;">Address: </span><span>${customer.address}</span></div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th style="text-align: left;">Product Description</th>
              <th style="width: 110px; text-align: left;">Company</th>
              <th style="width: 70px; text-align: center;">Total Cases</th>
              <th style="width: 80px; text-align: right;">Rate (₹)</th>
              <th style="width: 55px; text-align: center;">Units</th>
              <th style="width: 105px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${productRowsHtml || '<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748B;">No products allocated.</td></tr>'}
          </tbody>
        </table>

        <!-- Summary Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; page-break-inside: avoid;">
          <div style="width: 52%; font-size: 11px; color: #64748B; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; background-color: #FAFAFA;">
            ${performa.notes ? `<div style="font-size: 12px; color: #1E293B; margin-bottom: 6px;"><strong>Notes / Terms:</strong> <em>${performa.notes}</em></div>` : ''}
            <div style="line-height: 1.4;">• This quotation reserves product requirement allocation.</div>
          </div>

          <div class="summary-card">
            <div class="summary-row">
              <span style="color:#475569;">Total Cases:</span><strong style="color:#0F172A;">${performa.totalRequiredCases || performa.totalCases || 0}</strong>
            </div>
            <div class="summary-row">
              <span style="color:#475569;">Subtotal:</span><strong style="color:#0F172A;">₹ ${formatCurrency(subtotalVal)}</strong>
            </div>
            ${discountAmt > 0 ? `
            <div class="summary-row" style="color: #DC2626;">
              <span>Discount ${performa.discount ? `(${performa.discount}${String(performa.discount).includes('%') ? '' : '%'})` : ''}:</span><strong style="font-weight: 700;">- ₹ ${formatCurrency(discountAmt)}</strong>
            </div>` : ''}
            ${packingAmt > 0 ? `
            <div class="summary-row" style="color: #475569;">
              <span>Packing ${performa.packing ? `(${performa.packing}${String(performa.packing).includes('%') ? '' : '%'})` : ''}:</span><strong style="font-weight: 700; color: #0F172A;">+ ₹ ${formatCurrency(packingAmt)}</strong>
            </div>` : ''}
            ${taxAmt > 0 ? `
            <div class="summary-row" style="color: #475569;">
              <span>Tax (Amount):</span><strong style="font-weight: 700; color: #0F172A;">+ ₹ ${formatCurrency(taxAmt)}</strong>
            </div>` : ''}
            <div class="summary-row" style="padding-top: 6px; border-top: 2px solid #0B4DB7; margin-top: 4px; font-size: 13px; color: #0B4DB7;">
              <span style="font-weight: 800;">Total Allocated Value:</span><strong style="font-weight: 900; font-size: 14px;">₹ ${formatCurrency(totalAllocatedVal)}</strong>
            </div>
          </div>
        </div>

        ${performa.customerBills && performa.customerBills.length > 0 ? `
        <div style="margin-top: 14px; margin-bottom: 14px; page-break-inside: avoid;">
          <div style="font-size: 11px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;">
            Linked Particulars Purchase Bills (${performa.customerBills.length})
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #CBD5E1;">
            <thead>
              <tr style="background-color: #F1F5F9;">
                <th style="padding: 4px 6px; text-align: center; border: 1px solid #CBD5E1; width: 30px;">#</th>
                <th style="padding: 4px 8px; text-align: left; border: 1px solid #CBD5E1;">Bill No</th>
                <th style="padding: 4px 8px; text-align: left; border: 1px solid #CBD5E1; width: 80px;">Date</th>
                <th style="padding: 4px 8px; text-align: left; border: 1px solid #CBD5E1;">Company</th>
                <th style="padding: 4px 6px; text-align: center; border: 1px solid #CBD5E1; width: 50px;">Cases</th>
                <th style="padding: 4px 8px; text-align: right; border: 1px solid #CBD5E1; width: 90px;">Net Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${performa.customerBills.map((b: any, bIdx: number) => `
                <tr style="background-color: ${bIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
                  <td style="padding: 4px 6px; text-align: center; border: 1px solid #CBD5E1;">${bIdx + 1}</td>
                  <td style="padding: 4px 8px; font-weight: 700; border: 1px solid #CBD5E1;">#${b.billNo}</td>
                  <td style="padding: 4px 8px; border: 1px solid #CBD5E1;">${b.date}</td>
                  <td style="padding: 4px 8px; border: 1px solid #CBD5E1; color: #0B4DB7;">${b.companyName || '-'}</td>
                  <td style="padding: 4px 6px; text-align: center; border: 1px solid #CBD5E1;">${b.caseCount || '0'}</td>
                  <td style="padding: 4px 8px; text-align: right; font-weight: 700; border: 1px solid #CBD5E1;">₹ ${formatCurrency(b.netTotal || parseFloat(b.total || b.amount || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #F1F5F9; font-weight: 800;">
                <td colspan="4" style="padding: 5px 8px; text-align: right; border: 1px solid #CBD5E1; color: #0F172A;">
                  Total Particulars Purchases:
                </td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #CBD5E1; color: #0F172A;">
                  ${billsTotalCases}
                </td>
                <td style="padding: 5px 8px; text-align: right; border: 1px solid #CBD5E1; color: #DC2626;">
                  ₹ ${formatCurrency(billsTotalAmt)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>` : ''}

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 28px; padding-top: 14px; border-top: 1px dashed #CBD5E1; font-size: 11px; page-break-inside: avoid;">
          <div style="text-align: center; width: 160px;">
            <div style="height: 28px;"></div>
            <div style="border-top: 1px solid #0F172A; padding-top: 4px; font-weight: 700;">Customer Signature</div>
          </div>
          <div style="text-align: center; width: 160px;">
            <div style="font-weight: 700; margin-bottom: 24px;">For Dheeksha Trade Link</div>
            <div style="border-top: 1px solid #0F172A; padding-top: 4px; font-weight: 700;">Authorized Signatory</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Print All Performas Master List (A4 Standard)
 */
export const generateAllPerformasPrintHtml = (performas: any[], reportTitle = 'PERFORMAS MASTER SUMMARY', dateRangeText?: string): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const PAGE_SIZE = 30;
  const totalPages = Math.max(1, Math.ceil(performas.length / PAGE_SIZE));

  let overallTotalCases = 0;
  let overallTotalValue = 0;

  performas.forEach((p) => {
    overallTotalCases += parseFloat(String(p.totalRequiredCases || p.totalCases || 0)) || 0;
    overallTotalValue += parseFloat(String(p.totalAllocatedAmount || p.totalAmount || 0)) || 0;
  });

  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
    const startIndex = pageIdx * PAGE_SIZE;
    const pageItems = performas.slice(startIndex, startIndex + PAGE_SIZE);
    const isFirstPage = pageIdx === 0;
    const isFinalPage = pageIdx === totalPages - 1;

    let pageCases = 0;
    let pageValue = 0;

    pageItems.forEach((p) => {
      pageCases += parseFloat(String(p.totalRequiredCases || p.totalCases || 0)) || 0;
      pageValue += parseFloat(String(p.totalAllocatedAmount || p.totalAmount || 0)) || 0;
    });

    const pageRowsHtml = pageItems.map((p, localIdx) => {
      const globalIdx = startIndex + localIdx;
      const isEven = localIdx % 2 === 1;
      const cases = parseFloat(String(p.totalRequiredCases || p.totalCases || 0)) || 0;
      const value = parseFloat(String(p.totalAllocatedAmount || p.totalAmount || 0)) || 0;
      const custName = p.customerSnapshot?.name || p.customerName || '-';
      const compName = p.companyName || p.customerSnapshot?.companyName || '-';

      return `
        <tr class="data-row" style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
          <td class="text-center" style="width:30px;">${globalIdx + 1}</td>
          <td class="text-center" style="font-weight:800; color:#0B4DB7; width:65px;">#${p.performaNumber || '-'}</td>
          <td class="text-center" style="width:75px; color:#334155;">${p.date || '-'}</td>
          <td style="font-weight:700; color:#0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${custName}</td>
          <td style="color:#475569; font-size:9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${compName}</td>
          <td class="text-center" style="width:50px; font-weight:800;">${cases}</td>
          <td class="text-center" style="width:70px; font-size:9.5px; font-weight:700; color:${p.status === 'ACTIVE' ? '#16A34A' : '#0B4DB7'};">${p.status || 'ACTIVE'}</td>
          <td class="text-right" style="font-weight:800; width:110px; color:#0F172A;">₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="print-page ${isFinalPage ? 'final-page' : ''}">
        ${
          isFirstPage
            ? `
        <!-- Full Header Banner (Page 1) -->
        <div class="company-banner">
          <div>
            <div class="comp-name">DHEEKSHA TRADE LINK</div>
            <div class="comp-sub">Wholesale & Retail Trading • Sivakasi</div>
            <div class="report-heading">${reportTitle}</div>
            ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
          </div>
          <div class="meta-box">
            <div>Generated: <span class="meta-bold">${currentDate} ${currentTime}</span></div>
            <div>Total Records: <span class="meta-bold">${performas.length} Performas</span></div>
            <div>Page: <span class="meta-bold">1 of ${totalPages}</span></div>
          </div>
        </div>

        <!-- Summary Metrics (Page 1) -->
        <div class="kpi-summary-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Performas</div>
            <div class="kpi-val">${performas.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Cases</div>
            <div class="kpi-val" style="color:#0B4DB7;">${overallTotalCases}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Allocated Value</div>
            <div class="kpi-val" style="color:#16A34A;">₹ ${overallTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>`
            : `
        <!-- Compact Header (Subsequent Pages) -->
        <div class="subsequent-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0F172A; padding-bottom: 4px; margin-bottom: 5px;">
            <div>
              <span style="font-size: 15px; font-weight: 900; color: #0B4DB7;">DHEEKSHA TRADE LINK</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #475569; margin-left: 8px;">• ${reportTitle}</span>
              ${dateRangeText ? `<span class="date-badge" style="margin-left: 8px; font-size: 9px; padding: 1px 6px;">${dateRangeText}</span>` : ''}
            </div>
            <div style="font-size: 9.5px; color: #334155; font-weight: 700;">
              <span>Date: ${currentDate}</span> | <span>Records: ${startIndex + 1} - ${startIndex + pageItems.length}</span> | <span>Page ${pageIdx + 1} of ${totalPages}</span>
            </div>
          </div>
        </div>`
        }

        <!-- Master Performas Table -->
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width:30px;">#</th>
              <th class="text-center" style="width:65px;">Performa #</th>
              <th class="text-center" style="width:75px;">Date</th>
              <th style="width:180px;">Customer Name</th>
              <th style="width:150px;">Company</th>
              <th class="text-center" style="width:50px;">Cases</th>
              <th class="text-center" style="width:70px;">Status</th>
              <th class="text-right" style="width:110px;">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml || '<tr><td colspan="8" class="text-center" style="padding:18px; color:#64748B;">No performa records found for the selected period.</td></tr>'}
          </tbody>
          <tfoot>
            <!-- Page Total Row (Bottom of EVERY page) -->
            <tr class="page-total-row">
              <td colspan="5" class="text-right" style="padding-right:8px;">PAGE ${pageIdx + 1} TOTAL (${pageItems.length} Performas):</td>
              <td class="text-center">${pageCases}</td>
              <td></td>
              <td class="text-right">₹ ${pageValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>

            <!-- Final Page Only: OVERALL GRAND TOTAL -->
            ${
              isFinalPage
                ? `
            <tr class="grand-total-row">
              <td colspan="5" class="text-right" style="padding-right:8px;">OVERALL GRAND TOTAL (${performas.length} Performas):</td>
              <td class="text-center">${overallTotalCases}</td>
              <td></td>
              <td class="text-right">₹ ${overallTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>`
                : ''
            }
          </tfoot>
        </table>

        ${
          isFinalPage
            ? `
        <!-- Signature Section (Final Page Only) -->
        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Checked & Verified By</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${currentDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      padding: 0;
    }
    .print-page:last-child,
    .print-page.final-page {
      page-break-after: auto;
      break-after: auto;
    }
    @media screen {
      .print-page {
        margin-bottom: 25px;
        padding-bottom: 25px;
        border-bottom: 2px dashed #94A3B8;
      }
      .print-page:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @media print {
      .print-page {
        margin: 0;
        border: none;
        padding: 0;
        page-break-after: always;
        break-after: page;
      }
      .print-page:last-child,
      .print-page.final-page {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .comp-name {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
      line-height: 1.1;
    }
    .comp-sub {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #334155;
      line-height: 1.35;
    }
    .meta-bold {
      font-weight: 700;
      color: #000000;
    }
    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 5px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 3px 6px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kpi-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 1px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1.5px solid #0F172A;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 9.5px;
      padding: 4px 4px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 0 4px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .data-row {
      height: 28px;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .page-total-row td {
      background-color: #F1F5F9 !important;
      color: #0F172A !important;
      border: 1px solid #CBD5E1 !important;
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 4px;
      height: 23px;
    }
    .grand-total-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 10.5px;
      font-weight: 900;
      padding: 4px 4px;
      height: 25px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 3px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

export const printAllPerformasDirectly = (performas: any[], reportTitle?: string, dateRangeText?: string) => {
  const htmlContent = generateAllPerformasPrintHtml(performas, reportTitle, dateRangeText);
  triggerBrowserPrint(htmlContent);
};

export const printPerformaDirectly = (performa: any) => {
  const htmlContent = generatePerformaHtml(performa);
  triggerBrowserPrint(htmlContent);
};

/**
 * Reusable hidden-iframe print helper with image loading support
 */
const triggerBrowserPrint = (htmlContent: string) => {
  let iframe = document.getElementById('dheeksha-print-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'dheeksha-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    const doPrint = () => {
      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      }, 150);
    };

    // Wait for all images in the print document to load
    const images = Array.from(doc.images);
    if (images.length === 0) {
      doPrint();
    } else {
      let loaded = 0;
      const total = images.length;
      const checkAllLoaded = () => {
        loaded++;
        if (loaded >= total) {
          doPrint();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkAllLoaded();
        } else {
          img.onload = checkAllLoaded;
          img.onerror = checkAllLoaded;
        }
      });

      // Safety timeout
      setTimeout(doPrint, 1200);
    }
  }
};
