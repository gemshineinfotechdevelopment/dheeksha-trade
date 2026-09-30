import html2pdf from 'html2pdf.js';
import {
  generateBillHtml,
  generateLedgerStatementHtml,
  generateParticularsListPrintHtml,
  generatePerformaHtml,
  generateAllPerformasPrintHtml,
} from './printUtils';
import type { BillPrintData } from '../components/BillPrintTemplate';

/**
 * Normalizes phone numbers for WhatsApp (adds 91 if 10-digit Indian number)
 */
export const normalizeWhatsAppPhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

/**
 * Generates an in-memory PDF Blob from raw HTML using html2pdf.js without saving to disk
 */
export const generatePdfBlobFromHtml = async (html: string, fileName: string): Promise<File | null> => {
  return new Promise((resolve) => {
    try {
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '794px';
      iframe.style.height = '1123px';
      iframe.style.zIndex = '-99999';
      iframe.style.opacity = '1';
      iframe.style.visibility = 'visible';
      iframe.style.border = 'none';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        resolve(null);
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Allow 350ms for the browser layout engine to render tables, inline CSS, and fonts
      setTimeout(async () => {
        try {
          const target = doc.body;
          const opt = {
            margin: [8, 8, 8, 8],
            filename: cleanFileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#FFFFFF',
              windowWidth: 794,
              scrollX: 0,
              scrollY: 0,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          };

          const worker = (html2pdf() as any).set(opt).from(target);
          const pdfBlob: Blob = await worker.output('blob');

          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }

          if (pdfBlob && pdfBlob.size > 200) {
            resolve(new File([pdfBlob], cleanFileName, { type: 'application/pdf' }));
          } else {
            console.warn('[PDF Gen] Generated PDF Blob is too small or empty');
            resolve(null);
          }
        } catch (err) {
          console.error('[PDF Generation Worker Error]:', err);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(null);
        }
      }, 350);
    } catch (e) {
      console.error('[PDF Gen Error]:', e);
      resolve(null);
    }
  });
};

/**
 * Base dispatcher: tries Web Share API with attached PDF File;
 * falls back to direct WhatsApp Web/App URL with pre-filled message.
 */
export const shareToWhatsApp = async (options: {
  title: string;
  text: string;
  fileName: string;
  html?: string;
  phone?: string;
}) => {
  const { title, text, fileName, html, phone } = options;
  const cleanPhone = normalizeWhatsAppPhone(phone);

  let pdfFile: File | null = null;
  if (html) {
    pdfFile = await generatePdfBlobFromHtml(html, fileName);
  }

  // 1. Try Native Web Share API if device/browser supports file sharing (Mobile, Tablets, Mac/Windows Edge)
  if (pdfFile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title,
        text,
      });
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[WebShare API failed, falling back to WhatsApp URL]:', err);
      } else {
        return; // User cancelled share sheet
      }
    }
  }

  // 2. WhatsApp URL fallback (Desktop Web / Mobile App deep link)
  const encodedText = encodeURIComponent(text);
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(waUrl, '_blank');
};

/**
 * 1. Share Particular Bill on WhatsApp
 */
export const shareBillOnWhatsApp = async (bill: BillPrintData, phone?: string) => {
  const itemsText = (bill.products || [])
    .map(
      (p, i) =>
        `${i + 1}. *${p.particular}* - ${p.quantity} Cases @ ₹${p.rate}${p.pktUnit && p.pktUnit !== '-' ? ` (${p.pktUnit}/pkt)` : ''} = *₹${p.amount}*`
    )
    .join('\n');

  const text = `*DHEEKSHA TRADE - INVOICE BILL* 🧾
----------------------------------------
*Bill No:* #${bill.billNo}
*Customer:* ${bill.customerName}
${bill.companyName && bill.companyName !== 'General' ? `*Company:* ${bill.companyName}\n` : ''}*Date:* ${bill.date}
*Transport:* ${bill.transport || '-'}
*Cases:* ${bill.caseCount || '-'}
----------------------------------------
*ITEMS:*
${itemsText || '-'}
----------------------------------------
*Subtotal:* ₹${bill.amount || '0.00'}
${bill.discount && parseFloat(String(bill.discount)) > 0 ? `*Discount:* ${bill.discount}%\n` : ''}${bill.packing && parseFloat(String(bill.packing)) > 0 ? `*Packing:* ${bill.packing}\n` : ''}${bill.tax && parseFloat(String(bill.tax)) > 0 ? `*Tax:* ₹${bill.tax}\n` : ''}*TOTAL AMOUNT:* ₹${bill.total}
----------------------------------------
_Thank you for your business!_
*Dheeksha Trade*`;

  const html = generateBillHtml(bill);
  await shareToWhatsApp({
    title: `Bill #${bill.billNo} - ${bill.customerName}`,
    text,
    fileName: `Bill-${bill.billNo}-${bill.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone: phone || bill.phone,
  });
};

/**
 * 2. Share Account Ledger Statement on WhatsApp
 */
export const shareLedgerOnWhatsApp = async (
  customerName: string,
  accountDetails: any[],
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const totalDebit = accountDetails.reduce((sum, r) => sum + (parseFloat(String(r.debit).replace(/,/g, '')) || 0), 0);
  const totalCredit = accountDetails.reduce((sum, r) => sum + (parseFloat(String(r.credit).replace(/,/g, '')) || 0), 0);
  const netBalance = totalDebit - totalCredit;

  const dateRangeStr = fromDate || toDate ? ` (${fromDate || 'Start'} to ${toDate || 'Present'})` : '';

  const text = `*DHEEKSHA TRADE - ACCOUNT STATEMENT* 📊
----------------------------------------
*Customer:* ${customerName}${dateRangeStr}
*Total Transactions:* ${accountDetails.length}
----------------------------------------
*Total Debit (Bills):* ₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Total Credit (Received):* ₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*NET BALANCE:* ₹${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${netBalance > 0 ? '(Due)' : netBalance < 0 ? '(Advance)' : '(Settled)'}
----------------------------------------
_Generated on ${new Date().toLocaleDateString('en-GB')}_
*Dheeksha Trade*`;

  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateLedgerStatementHtml(customerName, accountDetails, rangeLabel);
  await shareToWhatsApp({
    title: `Account Statement - ${customerName}`,
    text,
    fileName: `Ledger-${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 3. Share Particulars Statement / List on WhatsApp
 */
export const shareParticularsListOnWhatsApp = async (
  customerName: string,
  particularDetails: any[],
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const totalAmount = particularDetails.reduce(
    (sum, r) => sum + (parseFloat(String(r.total || r.amount).replace(/,/g, '')) || 0),
    0
  );
  const totalCases = particularDetails.reduce(
    (sum, r) => sum + (parseFloat(String(r.caseCount).replace(/,/g, '')) || 0),
    0
  );

  const text = `*DHEEKSHA TRADE - PARTICULAR BILLS STATEMENT* 📋
----------------------------------------
*Customer:* ${customerName}
*Total Bills:* ${particularDetails.length}
*Total Cases:* ${totalCases}
*Total Billed Amount:* ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
----------------------------------------
_Generated on ${new Date().toLocaleDateString('en-GB')}_
*Dheeksha Trade*`;

  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateParticularsListPrintHtml(particularDetails, rangeLabel);
  await shareToWhatsApp({
    title: `Particulars List - ${customerName}`,
    text,
    fileName: `Particulars-${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 4. Share Performa Quotation on WhatsApp
 */
export const sharePerformaOnWhatsApp = async (performa: any, phone?: string) => {
  const custName = performa.customerSnapshot?.name || performa.customerName || 'Customer';
  const pfNum = performa.performaNumber || 'PF';
  const totalCases = performa.totalCases || performa.products?.reduce((s: number, p: any) => s + (Number(p.requiredCases) || 0), 0) || 0;
  const totalAmount = performa.totalAmount || performa.products?.reduce((s: number, p: any) => s + (Number(p.allocatedAmount) || ((Number(p.requiredCases) || 0) * (Number(p.rate) || 0) * (Number(p.pktPerUnit) || 1)) || 0), 0) || 0;

  const itemsText = (performa.products || [])
    .map(
      (p: any, i: number) =>
        `${i + 1}. *${p.productSnapshot?.productName || p.productName}* - ${p.requiredCases} Cases @ ₹${p.rate} = *₹${p.allocatedAmount || ((Number(p.requiredCases) || 0) * (Number(p.rate) || 0) * (Number(p.pktPerUnit) || 1))}*`
    )
    .join('\n');

  const text = `*DHEEKSHA TRADE - PERFORMA INVOICE / QUOTATION* 📝
----------------------------------------
*Performa No:* #${pfNum}
*Customer:* ${custName}
*Date:* ${performa.date || '-'}
*Status:* ${performa.status || 'Active'}
----------------------------------------
*PRODUCTS ALLOCATION:*
${itemsText || '-'}
----------------------------------------
*Total Cases:* ${totalCases}
*Total Value:* ₹${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Advance Received:* ₹${Number(performa.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Remaining Advance:* ₹${Number(performa.remainingAdvanceAmount ?? performa.advanceAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
----------------------------------------
*Dheeksha Trade*`;

  const html = generatePerformaHtml(performa);
  await shareToWhatsApp({
    title: `Performa #${pfNum} - ${custName}`,
    text,
    fileName: `Performa-${pfNum}-${custName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone: phone || performa.customerSnapshot?.phone,
  });
};

/**
 * 5. Share All Performas List / Summary on WhatsApp
 */
export const shareAllPerformasOnWhatsApp = async (
  performas: any[],
  summaryTitle: string = 'All Performas',
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const totalPerformas = performas.length;
  const totalCases = performas.reduce((acc, p) => acc + (parseFloat(p.totalCases) || 0), 0);
  const totalValue = performas.reduce((acc, p) => acc + (parseFloat(p.totalAmount) || 0), 0);
  const totalAdvance = performas.reduce((acc, p) => acc + (parseFloat(p.advanceAmount) || 0), 0);

  const text = `*DHEEKSHA TRADE - PERFORMA SUMMARY* 📊
----------------------------------------
*Title:* ${summaryTitle}
*Total Performas:* ${totalPerformas}
*Total Cases:* ${totalCases}
*Total Value:* ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
*Total Advance:* ₹${totalAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
----------------------------------------
_Generated on ${new Date().toLocaleDateString('en-GB')}_
*Dheeksha Trade*`;

  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateAllPerformasPrintHtml(performas, summaryTitle, rangeLabel);
  await shareToWhatsApp({
    title: `Performa Summary - ${summaryTitle}`,
    text,
    fileName: `Performas-Summary-${summaryTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};
