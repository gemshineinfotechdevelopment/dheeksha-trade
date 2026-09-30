import React from 'react';

export interface BillPrintProduct {
  particular: string;
  quantity: string | number;
  rate: string | number;
  pktUnit: string | number;
  amount: string | number;
}

export interface BillPrintData {
  billNo: string;
  date: string;
  customerName: string;
  companyName: string;
  preparedBy?: string;
  phone?: string;
  email?: string;
  website?: string;
  transport?: string;
  caseCount?: string | number;
  products: BillPrintProduct[];
  amount?: string | number;
  discount?: string | number;
  packing?: string | number;
  tax?: string | number;
  total?: string | number;
  pdfData?: string;
  pdfUrl?: string;
  pdfName?: string;
}

interface BillPrintTemplateProps {
  bill: BillPrintData;
}

export const BillPrintTemplate: React.FC<BillPrintTemplateProps> = ({ bill }) => {
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
      discountLabel = `Discount Amount (${bill.discount || discNum}${rawDiscStr.includes('%') ? '' : '%'})`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount Amount (₹${discNum})`;
    }
  }

  // Packing calculation (Calculated from reduced amount after discount)
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Amount';
  if (packNum > 0) {
    const baseAfterDiscount = Math.max(0, subtotal - discountAmt);
    if (rawPackStr.includes('%') || packNum <= 100) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing Amount (${bill.packing || packNum}${rawPackStr.includes('%') ? '' : '%'})`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing Amount (₹${packNum})`;
    }
  }

  // Tax calculation (Manual flat amount)
  const rawTaxStr = String(bill.tax ?? '').trim();
  const cleanTax = rawTaxStr.replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(cleanTax) || 0;
  let taxAmt = 0;
  let taxLabel = 'Tax Amount';
  if (taxNum > 0) {
    taxAmt = taxNum;
    taxLabel = `Tax Amount (₹${taxNum.toLocaleString('en-IN')})`;
  }

  // Grand Total calculation
  const calculatedTotal = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  const rawTotalNum = parseFloat(String(bill.total ?? bill.amount ?? '0').replace(/,/g, '')) || 0;
  const finalTotalNum = rawTotalNum > 0 ? rawTotalNum : calculatedTotal;
  const formattedTotal = finalTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const computedCases = bill.caseCount !== undefined && bill.caseCount !== ''
    ? bill.caseCount
    : (bill.products || []).reduce((acc, p) => acc + (parseFloat(String(p.quantity)) || 0), 0);

  const preparedBy = bill.preparedBy || 'S.Nagaraj';
  const transportName = bill.transport && bill.transport.trim() !== '' && bill.transport !== '-' ? bill.transport.trim() : '-';

  // Check for uploaded Lorry / Godown receipt (pdfData or pdfUrl)
  const receiptSrc = bill.pdfData || bill.pdfUrl || '';

  return (
    <div
      className="dheeksha-bill-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: '24px 30px 20px 30px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Centered Dheeksha Trade Link & Top Right Signatory */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '18px' }}>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            fontSize: '13px',
            fontWeight: 600,
            color: '#000000',
          }}
        >
          {preparedBy}
        </div>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#000000',
            margin: '0 0 2px 0',
            letterSpacing: '-0.01em',
          }}
        >
          Dheeksha Trade Link
        </h1>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
          Sivakasi
        </div>
      </div>

      {/* Bill Metadata Block */}
      <div
        style={{
          fontSize: '13.5px',
          lineHeight: '1.65',
          color: '#000000',
          marginBottom: '16px',
        }}
      >
        <div>
          <span>Bill No: </span>
          <strong>{bill.billNo || '-'}</strong>
        </div>
        <div>
          <span>Customer Name: </span>
          <strong>{bill.customerName || '-'}</strong>
        </div>
        <div>
          <span>Company Name: </span>
          <strong>{bill.companyName || '-'}</strong>
        </div>
        <div>
          <span>Total Amount: </span>
          <strong>{formattedTotal}</strong>
        </div>
        <div>
          <span>Transport Name: </span>
          <strong>{transportName}</strong>
        </div>
        <div>
          <span>Total No. of Cases: </span>
          <strong>{computedCases}</strong>
        </div>
        <div>
          <span>Date: </span>
          <strong>{bill.date || '-'}</strong>
        </div>
      </div>

      {/* Products Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          fontSize: '12.5px',
          marginBottom: '20px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#ffffff' }}>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '50px', fontWeight: 700 }}>
              Si.No
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>
              Particular
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '80px', fontWeight: 700 }}>
              Quantity
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '80px', fontWeight: 700 }}>
              Rate
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '90px', fontWeight: 700 }}>
              Pkt / Unit
            </th>
            <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'right', width: '110px', fontWeight: 700 }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {(bill.products || []).length === 0 ? (
            <tr>
              <td colSpan={6} style={{ border: '1px solid #000000', textAlign: 'center', padding: '16px', color: '#64748B' }}>
                No product items in bill
              </td>
            </tr>
          ) : (
            (bill.products || []).map((item, idx) => {
              const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
              return (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 600 }}>{item.particular || '-'}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>{item.quantity || '-'}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>{item.rate || '-'}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>{item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : ''}</td>
                  <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                    {numAmt.toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Bottom Split Section: Left (Uploaded Receipt Image) & Right (Calculation Summary Table) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '20px',
        }}
      >
        {/* Left Column: Uploaded Godown / Transport Receipt */}
        <div
          style={{
            flex: '1 1 50%',
            maxWidth: '48%',
            border: '1px solid #000000',
            minHeight: '170px',
            maxHeight: '230px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            padding: '4px',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {receiptSrc ? (
            receiptSrc.startsWith('data:image') || receiptSrc.match(/\.(jpeg|jpg|png|webp|gif)$/i) || !receiptSrc.includes('application/pdf') ? (
              <img
                src={receiptSrc}
                alt="Transport / Godown Receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '220px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <iframe
                src={receiptSrc}
                title="Transport Receipt PDF"
                style={{
                  width: '100%',
                  height: '210px',
                  border: 'none',
                }}
              />
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#64748B', fontSize: '11.5px', padding: '16px' }}>
              <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                TRANSPORT / GODOWN RECEIPT
              </div>
              <div>(No receipt attached for this bill)</div>
            </div>
          )}
        </div>

        {/* Right Column: Calculation Summary Table */}
        <div style={{ flex: '1 1 50%', maxWidth: '48%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000000',
              fontSize: '12.5px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 500 }}>
                  Particular Amount
                </td>
                <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                  {subtotal.toFixed(2)}
                </td>
              </tr>
              {discountAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 500 }}>
                    {discountLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                    {discountAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {packingAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 500 }}>
                    {packingLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                    {packingAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              {taxAmt > 0 && (
                <tr>
                  <td style={{ border: '1px solid #000000', padding: '6px 10px', fontWeight: 500 }}>
                    {taxLabel}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                    {taxAmt.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={{ fontWeight: 800 }}>
                <td style={{ border: '1px solid #000000', padding: '7px 10px' }}>
                  Total Amount
                </td>
                <td style={{ border: '1px solid #000000', padding: '7px 10px', textAlign: 'right', fontSize: '13.5px' }}>
                  {formattedTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
