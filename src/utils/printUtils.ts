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
    if (rawDiscStr.includes('%') || discNum <= 100) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount (${bill.discount || discNum}${rawDiscStr.includes('%') ? '' : '%'})`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount (₹${discNum.toLocaleString('en-IN')})`;
    }
  }

  const baseAfterDiscount = Math.max(0, subtotal - discountAmt);

  // Packing calculation (Calculated from reduced amount after discount or flat)
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    if (rawPackStr.includes('%') || packNum <= 100) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing (${bill.packing || packNum}${rawPackStr.includes('%') ? '' : '%'})`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing (₹${packNum.toLocaleString('en-IN')})`;
    }
  }

  // Tax calculation (Manual flat amount)
  const rawTaxStr = String(bill.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTaxStr) || 0;
  let taxAmt = 0;
  let taxLabel = 'Tax Amount';
  if (taxNum > 0) {
    taxAmt = taxNum;
    taxLabel = `Tax (₹${taxNum.toLocaleString('en-IN')})`;
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
            ${
              discountAmt > 0
                ? `<tr>
                    <td class="summary-label-cell" style="color:#DC2626;">${discountLabel}</td>
                    <td class="summary-val-cell" style="color:#DC2626;">- ₹ ${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>`
                : ''
            }
            ${
              packingAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${packingLabel}</td>
                    <td class="summary-val-cell">+ ₹ ${packingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>`
                : ''
            }
            ${
              taxAmt > 0
                ? `<tr>
                    <td class="summary-label-cell">${taxLabel}</td>
                    <td class="summary-val-cell">+ ₹ ${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>`
                : ''
            }
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

  let totalDebit = 0;
  let totalCredit = 0;
  let totalPendingDue = 0;
  let totalAdvanceHeld = 0;

  customers.forEach((c) => {
    const deb = c.totalDebit || 0;
    const cred = c.totalCredit || 0;
    const due = c.pendingDue || 0;
    const net = c.netBalance || 0;

    totalDebit += deb;
    totalCredit += cred;
    totalPendingDue += due;
    if (net > 0) totalAdvanceHeld += net;
  });

  const rowsHtml = customers.map((c, idx) => {
    const idDisplay = c.idCode || `#${(idx + 1).toString().padStart(4, '0')}`;
    const deb = (c.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const cred = (c.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const isEven = idx % 2 === 1;

    let balanceHtml = '';
    if ((c.pendingDue || 0) > 0) {
      balanceHtml = `<span style="color:#DC2626; font-weight:800;">₹ ${(c.pendingDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Due)</span>`;
    } else if ((c.netBalance || 0) > 0) {
      balanceHtml = `<span style="color:#0284C7; font-weight:800;">+₹ ${(c.netBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Adv)</span>`;
    } else {
      balanceHtml = `<span style="color:#16A34A; font-weight:700;">₹ 0.00 (Settled)</span>`;
    }

    return `
      <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
        <td class="text-center" style="width: 35px; border: 1px solid #CBD5E1; padding: 6px 5px;">${idx + 1}</td>
        <td class="text-center" style="width: 60px; font-weight:700; color:#475569; border: 1px solid #CBD5E1; padding: 6px 5px;">${idDisplay}</td>
        <td style="font-weight:800; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">
          ${c.name}
          ${c.gst && c.gst !== 'N/A' ? `<div style="font-size:9.5px; color:#64748B; font-weight:600;">GSTIN: ${c.gst}</div>` : ''}
        </td>
        <td style="font-size:11px; color:#334155; width:95px; border: 1px solid #CBD5E1; padding: 6px 5px;">${c.mobile || '-'}</td>
        <td style="font-size:10.5px; color:#475569; max-width:180px; border: 1px solid #CBD5E1; padding: 6px 5px;">${c.address || '-'}</td>
        <td class="text-right" style="font-weight:700; color:#1E293B; width:105px; border: 1px solid #CBD5E1; padding: 6px 8px;">₹ ${deb}</td>
        <td class="text-right" style="font-weight:700; color:#16A34A; width:105px; border: 1px solid #CBD5E1; padding: 6px 8px;">₹ ${cred}</td>
        <td class="text-right" style="width:130px; border: 1px solid #CBD5E1; padding: 6px 8px;">${balanceHtml}</td>
      </tr>
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
      size: A4 landscape;
      margin: 8mm 10mm;
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
    .report-container {
      width: 100%;
      padding: 6px;
    }
    .company-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .comp-name {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: #0B4DB7;
    }
    .comp-sub {
      font-size: 10.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-heading {
      font-size: 14.5px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 3px;
    }
    .date-badge {
      display: inline-block;
      background-color: #EFF6FF;
      color: #0B4DB7;
      border: 1px solid #BFDBFE;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-top: 4px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
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
      gap: 6px;
      margin-bottom: 10px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 6px 8px;
      background-color: #F8FAFC;
    }
    .kpi-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 13.5px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 2px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      border: 1px solid #0F172A;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #0F172A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 10.5px;
      padding: 6px 5px;
      border: 1px solid #0F172A;
      text-align: left;
      letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 5px 5px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .totals-row td {
      background-color: #0F172A !important;
      color: #FFFFFF !important;
      border: 1px solid #0F172A !important;
      font-size: 11.5px;
      font-weight: 900;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 22px;
      padding: 0 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 160px;
    }
    .sig-line {
      border-top: 1px solid #000000;
      margin-bottom: 4px;
    }
    .sig-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header Banner -->
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
        <div>Phone: +91 98765 43210</div>
      </div>
    </div>

    <!-- Summary Metrics -->
    <div class="kpi-summary-grid">
      <div class="kpi-card">
        <div class="kpi-title">Total Customers</div>
        <div class="kpi-val">${customers.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Debit (Purchases)</div>
        <div class="kpi-val">₹ ${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Credit (Paid)</div>
        <div class="kpi-val" style="color:#16A34A;">₹ ${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card" style="background-color:#FEF2F2; border-color:#FECACA;">
        <div class="kpi-title" style="color:#991B1B;">Total Pending Due</div>
        <div class="kpi-val" style="color:#DC2626;">₹ ${totalPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="kpi-card" style="background-color:#F0F9FF; border-color:#BAE6FD;">
        <div class="kpi-title" style="color:#0369A1;">Total Advance Balances</div>
        <div class="kpi-val" style="color:#0284C7;">₹ ${totalAdvanceHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

    <!-- Master Customer Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 35px;">#</th>
          <th class="text-center" style="width: 60px;">ID</th>
          <th>Customer Name</th>
          <th style="width: 95px;">Mobile</th>
          <th>Address</th>
          <th class="text-right" style="width: 105px;">Debit (Dr)</th>
          <th class="text-right" style="width: 105px;">Credit (Cr)</th>
          <th class="text-right" style="width: 130px;">Net Balance / Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8" class="text-center" style="padding: 20px;">No customer records found for the selected range.</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td colspan="5" class="text-right" style="padding-right: 10px;">GRAND TOTALS (${customers.length} Customers):</td>
          <td class="text-right">₹ ${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">₹ ${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">
            ${
              totalPendingDue > 0
                ? `Due: ₹ ${totalPendingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                : `Settled`
            }
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Signature Section -->
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
    </div>
  </div>
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
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  let totalDeb = 0;
  let totalCred = 0;

  const rowsHtml = ledgerEntries.map((entry, idx) => {
    const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
    const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
    totalDeb += deb;
    totalCred += cred;
    const isEven = idx % 2 === 1;

    return `
      <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
        <td class="text-center" style="border: 1px solid #CBD5E1; padding: 6px 4px; color:#64748B;">${idx + 1}</td>
        <td class="text-center" style="border: 1px solid #CBD5E1; padding: 6px 6px; font-weight:600; color:#334155;">${entry.date || '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 8px; font-weight:700; color:#0F172A;">${entry.billNo ? `Bill #${entry.billNo}` : entry.type || 'PAYMENT / RECEIPT'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 8px; color:#475569;">${entry.companyName || '-'}</td>
        <td class="text-right" style="border: 1px solid #CBD5E1; padding: 6px 8px; color:#1E293B; font-weight:700;">${deb > 0 ? `₹ ${deb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
        <td class="text-right" style="border: 1px solid #CBD5E1; padding: 6px 8px; color:#16A34A; font-weight:700;">${cred > 0 ? `₹ ${cred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}</td>
        <td class="text-right" style="border: 1px solid #CBD5E1; padding: 6px 8px; font-weight:800; color:#0B4DB7;">₹ ${entry.balance || '0.00'}</td>
      </tr>
    `;
  }).join('');

  const netBalance = totalDeb - totalCred;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Account Statement - ${customerName}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0F172A; margin:0; padding:8px; background:#fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 10px; }
    .title { font-size: 24px; font-weight: 900; color: #0B4DB7; letter-spacing: -0.01em; }
    .sub { font-size: 10.5px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .kpi-box { border: 1px solid #CBD5E1; border-radius: 6px; padding: 8px 12px; background: #F8FAFC; }
    .kpi-lbl { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .kpi-num { font-size: 15px; font-weight: 900; margin-top: 2px; }
    .table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color: #FFFFFF; border: 1px solid #0F172A; padding: 7px 6px; font-weight: 800; font-size: 10.5px; letter-spacing: 0.03em; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 6px 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals td { background: #0F172A !important; color: #FFFFFF !important; border: 1px solid #0F172A !important; font-weight: 900; font-size: 12px; padding: 8px 6px; }
    .sig-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 26px; padding-top: 14px; border-top: 1px dashed #CBD5E1; font-size: 11px; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">DHEEKSHA TRADE LINK</div>
      <div class="sub">Wholesale & Retail Trading • Sivakasi</div>
      <h2 style="font-size:15px; font-weight:800; margin-top:4px; color:#0F172A;">ACCOUNT STATEMENT: ${customerName}</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11.5px; color:#334155;">
      <div>Generated Date: <b>${currentDate}</b></div>
      <div>Total Transactions: <b>${ledgerEntries.length}</b></div>
      <div>Phone: <b>+91 98765 43210</b></div>
    </div>
  </div>

  <!-- KPI Summary Cards -->
  <div class="kpi-row">
    <div class="kpi-box">
      <div class="kpi-lbl">Total Purchases / Debit (Dr)</div>
      <div class="kpi-num" style="color:#0F172A;">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Total Received / Credit (Cr)</div>
      <div class="kpi-num" style="color:#16A34A;">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-box" style="background-color:${netBalance > 0 ? '#FEF2F2' : '#F0FDF4'}; border-color:${netBalance > 0 ? '#FECACA' : '#BBF7D0'};">
      <div class="kpi-lbl" style="color:${netBalance > 0 ? '#991B1B' : '#166534'};">Net Balance Status</div>
      <div class="kpi-num" style="color:${netBalance > 0 ? '#DC2626' : '#16A34A'};">
        ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? '(Due Pending)' : netBalance < 0 ? '(Advance Held)' : '(Settled)'}
      </div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th class="text-center" style="width:35px;">#</th>
        <th class="text-center" style="width:85px;">Date</th>
        <th>Particulars / Bill No</th>
        <th>Company Name</th>
        <th class="text-right" style="width:110px;">Debit (Dr)</th>
        <th class="text-right" style="width:110px;">Credit (Cr)</th>
        <th class="text-right" style="width:120px;">Balance (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7" class="text-center" style="padding:18px; color:#64748B;">No transaction entries found for the selected period.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="4" class="text-right" style="padding-right:10px;">GRAND TOTALS:</td>
        <td class="text-right">₹ ${totalDeb.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">₹ ${totalCred.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">
          ₹ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? 'Dr' : 'Cr'}
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- Signatures -->
  <div class="sig-section">
    <div style="text-align:center; width:160px;">
      <div style="height:28px;"></div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Customer Verification</div>
    </div>
    <div style="text-align:center; width:160px;">
      <div style="font-weight:700; margin-bottom:24px;">For Dheeksha Trade Link</div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Authorized Signatory</div>
    </div>
  </div>
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
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  let totalSum = 0;
  let totalSubtotalSum = 0;
  let totalCasesSum = 0;

  const rowsHtml = particulars.map((p, idx) => {
    const amt = parseFloat(String(p.total || p.amount || '0').replace(/,/g, '')) || 0;
    const subAmt = parseFloat(String(p.amount || p.total || '0').replace(/,/g, '')) || amt;
    const cases = parseFloat(String(p.caseCount || '0')) || 0;
    totalSum += amt;
    totalSubtotalSum += subAmt;
    totalCasesSum += cases;
    const isEven = idx % 2 === 1;

    const discStr = p.discount && String(p.discount).trim() !== '' && p.discount !== '0' ? String(p.discount) : '-';
    const packStr = p.packing && String(p.packing).trim() !== '' && p.packing !== '0' ? String(p.packing) : '-';
    const taxStr = p.tax && String(p.tax).trim() !== '' && p.tax !== '0' ? `₹${p.tax}` : '-';

    return `
      <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
        <td class="text-center" style="width:30px; border: 1px solid #CBD5E1; padding: 6px 4px; color:#64748B;">${idx + 1}</td>
        <td class="text-center" style="font-weight:800; color:#0B4DB7; width:70px; border: 1px solid #CBD5E1; padding: 6px 4px;">#${p.billNo || '-'}</td>
        <td class="text-center" style="width:75px; border: 1px solid #CBD5E1; padding: 6px 4px; color:#334155;">${p.date || '-'}</td>
        <td style="font-weight:700; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">${p.customerName || '-'}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 6px; color:#475569; font-size:10.5px;">${p.companyName || '-'}</td>
        <td class="text-center" style="width:50px; font-weight:700; border: 1px solid #CBD5E1; padding: 6px 4px;">${p.caseCount || '-'}</td>
        <td class="text-right" style="width:90px; border: 1px solid #CBD5E1; padding: 6px 6px; color:#334155;">₹ ${subAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-center" style="width:65px; border: 1px solid #CBD5E1; padding: 6px 4px; color:${discStr !== '-' ? '#DC2626' : '#94A3B8'}; font-weight:600;">${discStr}</td>
        <td class="text-center" style="width:65px; border: 1px solid #CBD5E1; padding: 6px 4px; color:${packStr !== '-' ? '#0F172A' : '#94A3B8'}; font-weight:600;">${packStr}</td>
        <td class="text-center" style="width:65px; border: 1px solid #CBD5E1; padding: 6px 4px; color:${taxStr !== '-' ? '#0F172A' : '#94A3B8'}; font-weight:600;">${taxStr}</td>
        <td class="text-right" style="font-weight:800; width:110px; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 8px;">₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Particulars Bills Master Report - ${currentDate}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0F172A; margin:0; padding:8px; background:#fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 10px; }
    .title { font-size: 24px; font-weight: 900; color: #0B4DB7; letter-spacing: -0.01em; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
    .kpi-box { border: 1px solid #CBD5E1; border-radius: 6px; padding: 7px 12px; background: #F8FAFC; }
    .kpi-lbl { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .kpi-num { font-size: 15px; font-weight: 900; margin-top: 2px; color: #0F172A; }
    .table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color: #FFFFFF; border: 1px solid #0F172A; padding: 6px 4px; font-weight: 800; font-size: 10px; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 5px 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals td { background: #0F172A !important; color: #FFFFFF !important; border: 1px solid #0F172A !important; font-weight: 900; font-size: 11px; padding: 7px 6px; }
    .sig-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 12px; border-top: 1px dashed #CBD5E1; font-size: 11px; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">DHEEKSHA TRADE LINK</div>
      <div style="font-size:10.5px; font-weight:700; color:#475569; text-transform:uppercase;">Wholesale & Retail Trading • Sivakasi</div>
      <h2 style="font-size:15px; font-weight:800; margin-top:4px; color:#0F172A;">PARTICULARS BILLS MASTER REPORT</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11.5px; color:#334155;">
      <div>Generated Date: <b>${currentDate}</b></div>
      <div>Total Records: <b>${particulars.length} Bills</b></div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="kpi-row">
    <div class="kpi-box">
      <div class="kpi-lbl">Total Bills Count</div>
      <div class="kpi-num">${particulars.length}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Total Cases Billed</div>
      <div class="kpi-num" style="color:#0B4DB7;">${totalCasesSum}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Total Billed Amount</div>
      <div class="kpi-num" style="color:#16A34A;">₹ ${totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th class="text-center" style="width:30px;">#</th>
        <th class="text-center" style="width:70px;">Bill No</th>
        <th class="text-center" style="width:75px;">Date</th>
        <th>Customer Name</th>
        <th>Company</th>
        <th class="text-center" style="width:50px;">Cases</th>
        <th class="text-right" style="width:90px;">Subtotal (₹)</th>
        <th class="text-center" style="width:65px;">Discount</th>
        <th class="text-center" style="width:65px;">Packing</th>
        <th class="text-center" style="width:65px;">Tax (₹)</th>
        <th class="text-right" style="width:110px;">Net Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="11" class="text-center" style="padding:18px; color:#64748B;">No bill records found for the selected period.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="5" class="text-right" style="padding-right:10px;">GRAND TOTAL (${particulars.length} Bills):</td>
        <td class="text-center">${totalCasesSum}</td>
        <td class="text-right">₹ ${totalSubtotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td colspan="3"></td>
        <td class="text-right">₹ ${totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Signatures -->
  <div class="sig-section">
    <div style="text-align:center; width:150px;">
      <div style="height:24px;"></div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Prepared By</div>
    </div>
    <div style="text-align:center; width:150px;">
      <div style="height:24px;"></div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Checked & Verified</div>
    </div>
    <div style="text-align:center; width:150px;">
      <div style="font-weight:700; margin-bottom:20px;">For Dheeksha Trade Link</div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Authorized Signatory</div>
    </div>
  </div>
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
      <td style="padding: 7px 6px; text-align: center; font-weight: 700; color: #0B4DB7; border: 1px solid #CBD5E1;">
        ${item.remainingCases !== undefined ? item.remainingCases : item.requiredCases}
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
              <th style="width: 65px; text-align: center;">Req Cases</th>
              <th style="width: 65px; text-align: center;">Remaining</th>
              <th style="width: 80px; text-align: right;">Rate (₹)</th>
              <th style="width: 55px; text-align: center;">Units</th>
              <th style="width: 105px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${productRowsHtml || '<tr><td colspan="8" style="text-align:center; padding:16px; color:#64748B;">No products allocated.</td></tr>'}
          </tbody>
        </table>

        <!-- Summary Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; page-break-inside: avoid;">
          <div style="width: 52%; font-size: 11px; color: #64748B; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; background-color: #FAFAFA;">
            ${performa.notes ? `<div style="font-size: 12px; color: #1E293B; margin-bottom: 6px;"><strong>Notes / Terms:</strong> <em>${performa.notes}</em></div>` : ''}
            <div style="line-height: 1.4;">• This quotation reserves product requirement allocation. Billed cases will automatically deduct from available customer advance balance.</div>
          </div>

          <div class="summary-card">
            <div class="summary-row">
              <span style="color:#475569;">Total Required Cases:</span><strong style="color:#0F172A;">${performa.totalRequiredCases || performa.totalCases || 0}</strong>
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
            <div class="summary-row" style="padding-top: 4px; border-top: 1px dashed #CBD5E1;">
              <span style="color:#0F172A; font-weight: 700;">Total Allocated Value:</span><strong style="color:#0B4DB7; font-weight: 800; font-size: 13.5px;">₹ ${formatCurrency(totalAllocatedVal)}</strong>
            </div>
            <div style="height: 1px; background: #CBD5E1; margin: 6px 0;"></div>
            <div class="summary-row" style="color: #0B4DB7;">
              <span style="font-weight: 700;">Customer Advance:</span><strong style="font-weight: 800;">₹ ${formatCurrency(performa.advanceAmount || 0)}</strong>
            </div>
            ${performa.advanceUsedAmount ? `
            <div class="summary-row" style="color: #DC2626;">
              <span>Advance Consumed:</span><strong style="font-weight: 700;">- ₹ ${formatCurrency(performa.advanceUsedAmount)}</strong>
            </div>` : ''}
            <div class="summary-row" style="padding-top: 6px; border-top: 2px solid #0B4DB7; margin-top: 4px; font-size: 13px; color: #166534;">
              <span style="font-weight: 800;">Remaining Advance:</span><strong style="font-weight: 900;">₹ ${formatCurrency(performa.remainingAdvanceAmount !== undefined ? performa.remainingAdvanceAmount : performa.advanceAmount)}</strong>
            </div>
          </div>
        </div>

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
  const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  let totalCases = 0;
  let totalValue = 0;
  let totalAdvance = 0;
  let totalUsedAdv = 0;
  let totalRemainingAdv = 0;

  const rowsHtml = performas.map((p, idx) => {
    const cases = parseFloat(String(p.totalRequiredCases || p.totalCases || 0)) || 0;
    const value = parseFloat(String(p.totalAllocatedAmount || p.totalAmount || 0)) || 0;
    const adv = parseFloat(String(p.advanceAmount || p.totalAvailableAmount || 0)) || 0;
    const usedAdv = parseFloat(String(p.usedAmount !== undefined ? p.usedAmount : (p.advanceUsedAmount || 0))) || 0;
    const remAdv = parseFloat(String(p.remainingAmount !== undefined ? p.remainingAmount : (p.remainingAdvanceAmount !== undefined ? p.remainingAdvanceAmount : Math.max(0, adv - usedAdv)))) || 0;
    const custName = p.customerSnapshot?.name || p.customerName || '-';
    const compName = p.companyName || p.customerSnapshot?.companyName || '-';
    const isEven = idx % 2 === 1;

    totalCases += cases;
    totalValue += value;
    totalAdvance += adv;
    totalUsedAdv += usedAdv;
    totalRemainingAdv += remAdv;

    return `
      <tr style="background-color: ${isEven ? '#F8FAFC' : '#FFFFFF'};">
        <td class="text-center" style="width:30px; border: 1px solid #CBD5E1; padding: 6px 4px; color:#64748B;">${idx + 1}</td>
        <td class="text-center" style="font-weight:800; color:#0B4DB7; width:75px; border: 1px solid #CBD5E1; padding: 6px 4px;">#${p.performaNumber || '-'}</td>
        <td class="text-center" style="width:75px; border: 1px solid #CBD5E1; padding: 6px 4px; color:#334155;">${p.date || '-'}</td>
        <td style="font-weight:700; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 6px;">${custName}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 6px; color:#475569; font-size:10.5px;">${compName}</td>
        <td class="text-center" style="width:45px; font-weight:800; border: 1px solid #CBD5E1; padding: 6px 4px;">${cases}</td>
        <td class="text-center" style="width:70px; border: 1px solid #CBD5E1; padding: 6px 4px; font-size:10px; font-weight:700; color:${p.status === 'ACTIVE' ? '#16A34A' : '#D97706'};">${p.status || 'ACTIVE'}</td>
        <td class="text-right" style="font-weight:700; width:90px; color:#0F172A; border: 1px solid #CBD5E1; padding: 6px 6px;">₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right" style="font-weight:700; width:90px; color:#0B4DB7; border: 1px solid #CBD5E1; padding: 6px 6px;">₹ ${adv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right" style="font-weight:700; width:90px; color:${usedAdv > 0 ? '#DC2626' : '#64748B'}; border: 1px solid #CBD5E1; padding: 6px 6px;">₹ ${usedAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right" style="font-weight:800; width:95px; color:#166534; border: 1px solid #CBD5E1; padding: 6px 6px;">₹ ${remAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${currentDate}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 10mm; }
    *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0F172A; margin:0; padding:8px; background:#fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 10px; }
    .title { font-size: 24px; font-weight: 900; color: #0B4DB7; letter-spacing: -0.01em; }
    .date-badge { display: inline-block; background: #EFF6FF; color: #0B4DB7; border: 1px solid #BFDBFE; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px; }
    .kpi-box { border: 1px solid #CBD5E1; border-radius: 6px; padding: 7px 10px; background: #F8FAFC; }
    .kpi-lbl { font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .kpi-num { font-size: 14px; font-weight: 900; margin-top: 2px; color: #0F172A; }
    .table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #0F172A; }
    .table th { background: #0F172A; color: #FFFFFF; border: 1px solid #0F172A; padding: 6px 4px; font-weight: 800; font-size: 10px; text-transform: uppercase; }
    .table td { border: 1px solid #CBD5E1; padding: 5px 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals td { background: #0F172A !important; color: #FFFFFF !important; border: 1px solid #0F172A !important; font-weight: 900; font-size: 11px; padding: 7px 6px; }
    .sig-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; padding-top: 12px; border-top: 1px dashed #CBD5E1; font-size: 11px; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">DHEEKSHA TRADE LINK</div>
      <div style="font-size:10.5px; font-weight:700; color:#475569; text-transform:uppercase;">Wholesale & Retail Trading • Sivakasi</div>
      <h2 style="font-size:15px; font-weight:800; margin-top:4px; color:#0F172A;">${reportTitle}</h2>
      ${dateRangeText ? `<div class="date-badge">${dateRangeText}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:11.5px; color:#334155;">
      <div>Generated Date: <b>${currentDate}</b></div>
      <div>Total Records: <b>${performas.length} Performas</b></div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="kpi-row">
    <div class="kpi-box">
      <div class="kpi-lbl">Total Performas</div>
      <div class="kpi-num">${performas.length}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Total Req Cases</div>
      <div class="kpi-num" style="color:#0B4DB7;">${totalCases}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Total Allocated Value</div>
      <div class="kpi-num" style="color:#0F172A;">₹ ${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-box" style="background-color:#FEF2F2; border-color:#FECACA;">
      <div class="kpi-lbl" style="color:#991B1B;">Total Advance Consumed</div>
      <div class="kpi-num" style="color:#DC2626;">₹ ${totalUsedAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi-box" style="background-color:#F0FDF4; border-color:#BBF7D0;">
      <div class="kpi-lbl" style="color:#166534;">Remaining Advance Balance</div>
      <div class="kpi-num" style="color:#16A34A;">₹ ${totalRemainingAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th class="text-center" style="width:30px;">#</th>
        <th class="text-center" style="width:75px;">Performa #</th>
        <th class="text-center" style="width:75px;">Date</th>
        <th>Customer Name</th>
        <th>Company</th>
        <th class="text-center" style="width:45px;">Cases</th>
        <th class="text-center" style="width:70px;">Status</th>
        <th class="text-right" style="width:90px;">Total Value</th>
        <th class="text-right" style="width:90px;">Total Advance</th>
        <th class="text-right" style="width:90px;">Adv. Consumed</th>
        <th class="text-right" style="width:95px;">Rem. Advance</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="11" class="text-center" style="padding:18px; color:#64748B;">No performa records found for the selected period.</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="totals">
        <td colspan="5" class="text-right" style="padding-right:10px;">GRAND TOTALS (${performas.length} Performas):</td>
        <td class="text-center">${totalCases}</td>
        <td></td>
        <td class="text-right">₹ ${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">₹ ${totalAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">₹ ${totalUsedAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">₹ ${totalRemainingAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Signatures -->
  <div class="sig-section">
    <div style="text-align:center; width:150px;">
      <div style="height:24px;"></div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Prepared By</div>
    </div>
    <div style="text-align:center; width:150px;">
      <div style="height:24px;"></div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Checked & Verified</div>
    </div>
    <div style="text-align:center; width:150px;">
      <div style="font-weight:700; margin-bottom:20px;">For Dheeksha Trade Link</div>
      <div style="border-top:1px solid #0F172A; padding-top:4px; font-weight:700;">Authorized Signatory</div>
    </div>
  </div>
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
