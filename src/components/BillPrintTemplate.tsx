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
    if (rawDiscStr.includes('%') || (discNum <= 100 && !rawDiscStr.includes('.'))) {
      discountAmt = (subtotal * discNum) / 100;
      discountLabel = `Discount Amount (${bill.discount || discNum}${rawDiscStr.includes('%') ? '' : '%'})`;
    } else {
      discountAmt = discNum;
      discountLabel = `Discount Amount (₹${discNum.toLocaleString('en-IN')})`;
    }
  } else {
    discountLabel = 'Discount Amount';
  }

  // Packing calculation (Calculated from reduced amount after discount)
  const rawPackStr = String(bill.packing ?? '').trim();
  const cleanPack = rawPackStr.replace(/[^0-9.]/g, '');
  const packNum = parseFloat(cleanPack) || 0;
  let packingAmt = 0;
  let packingLabel = 'Packing Charges';
  if (packNum > 0) {
    const baseAfterDiscount = Math.max(0, subtotal - discountAmt);
    if (rawPackStr.includes('%') || (packNum <= 100 && !rawPackStr.includes('.'))) {
      packingAmt = (baseAfterDiscount * packNum) / 100;
      packingLabel = `Packing Charges (${bill.packing || packNum}${rawPackStr.includes('%') ? '' : '%'})`;
    } else {
      packingAmt = packNum;
      packingLabel = `Packing Charges (₹${packNum.toLocaleString('en-IN')})`;
    }
  } else {
    packingLabel = 'Packing Charges';
  }

  // Tax calculation (Flat amount or tax)
  const rawTaxStr = String(bill.tax ?? '').trim();
  const cleanTax = rawTaxStr.replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(cleanTax) || 0;
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
      {/* Top Header */}
      <div style={{ position: 'relative', textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '8px', marginBottom: '12px' }}>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            fontSize: '12px',
            fontWeight: 700,
            color: '#475569',
          }}
        >
          Prepared By: <b>{preparedBy}</b>
        </div>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 900,
            color: '#0B4DB7',
            margin: '0 0 2px 0',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
          }}
        >
          Dheeksha Trade Link
        </h1>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Wholesale & Retail Trading • Sivakasi
        </div>
        <div style={{ marginTop: '6px' }}>
          <span style={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, padding: '3px 12px', borderRadius: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ESTIMATE / PARTICULAR BILL
          </span>
        </div>
      </div>

      {/* Bill Metadata Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '12px',
          border: '1px solid #CBD5E1',
          borderRadius: '6px',
          padding: '10px 14px',
          backgroundColor: '#F8FAFC',
          marginBottom: '14px',
          fontSize: '12.5px',
        }}
      >
        <div>
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ width: '120px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Bill No:</span>
            <strong style={{ color: '#0B4DB7', fontSize: '14px' }}>#{bill.billNo || '-'}</strong>
          </div>
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ width: '120px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Customer Name:</span>
            <strong style={{ color: '#0F172A' }}>{bill.customerName || '-'}</strong>
          </div>
          {bill.companyName && bill.companyName.trim() && (
            <div style={{ display: 'flex', marginBottom: '4px' }}>
              <span style={{ width: '120px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Company Name:</span>
              <strong style={{ color: '#0F172A' }}>{bill.companyName.trim()}</strong>
            </div>
          )}
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ width: '120px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Transport Name:</span>
            <strong style={{ color: '#0F172A' }}>{transportName}</strong>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ width: '100px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Date:</span>
            <strong style={{ color: '#0F172A' }}>{bill.date || '-'}</strong>
          </div>
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ width: '100px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Total Cases:</span>
            <strong style={{ color: '#0B4DB7', fontSize: '13.5px' }}>{computedCases}</strong>
          </div>
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ width: '100px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>Phone:</span>
            <strong style={{ color: '#0F172A' }}>{bill.phone || '+91 98765 43210'}</strong>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #0F172A',
          fontSize: '12px',
          marginBottom: '16px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
            <th style={{ border: '1px solid #0F172A', padding: '8px 6px', textAlign: 'center', width: '40px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              #
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 10px', textAlign: 'left', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Particular / Product Description
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 6px', textAlign: 'center', width: '75px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Cases
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 8px', textAlign: 'right', width: '85px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Rate (₹)
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 6px', textAlign: 'center', width: '80px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Pkt / Unit
            </th>
            <th style={{ border: '1px solid #0F172A', padding: '8px 10px', textAlign: 'right', width: '110px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
              Amount (₹)
            </th>
          </tr>
        </thead>
        <tbody>
          {(bill.products || []).length === 0 ? (
            <tr>
              <td colSpan={6} style={{ border: '1px solid #CBD5E1', textAlign: 'center', padding: '16px', color: '#64748B' }}>
                No product items in bill
              </td>
            </tr>
          ) : (
            (bill.products || []).map((item, idx) => {
              const numAmt = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
              const isEven = idx % 2 === 1;
              return (
                <tr key={idx} style={{ backgroundColor: isEven ? '#F8FAFC' : '#FFFFFF' }}>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 6px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 10px', fontWeight: 700, color: '#0F172A' }}>{item.particular || '-'}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>{item.quantity || '-'}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 8px', textAlign: 'right', color: '#334155' }}>₹ {(parseFloat(String(item.rate)) || 0).toFixed(2)}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 6px', textAlign: 'center', color: '#64748B' }}>{item.pktUnit && item.pktUnit !== '-' ? item.pktUnit : '-'}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                    ₹ {numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          gap: '16px',
        }}
      >
        {/* Left Column: Uploaded Godown / Transport Receipt */}
        <div
          style={{
            flex: '1 1 50%',
            maxWidth: '48%',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            minHeight: '160px',
            maxHeight: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            padding: '6px',
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
                  maxHeight: '205px',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '4px',
                }}
              />
            ) : (
              <iframe
                src={receiptSrc}
                title="Transport Receipt PDF"
                style={{
                  width: '100%',
                  height: '205px',
                  border: 'none',
                }}
              />
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#64748B', fontSize: '11.5px', padding: '14px' }}>
              <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px', fontSize: '12px' }}>
                TRANSPORT / GODOWN RECEIPT
              </div>
              <div>(No physical receipt attached for this bill)</div>
            </div>
          )}
        </div>

        {/* Right Column: Calculation Summary Table */}
        <div style={{ flex: '1 1 50%', maxWidth: '48%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #0F172A',
              fontSize: '12px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC' }}>
                  Subtotal / Particular Amount
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                  ₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600, color: discountAmt > 0 ? '#DC2626' : '#334155', backgroundColor: '#F8FAFC' }}>
                  {discountLabel}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: discountAmt > 0 ? '#DC2626' : '#64748B' }}>
                  - ₹ {discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC' }}>
                  {packingLabel}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: packingAmt > 0 ? '#0F172A' : '#64748B' }}>
                  + ₹ {packingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600, color: '#334155', backgroundColor: '#F8FAFC' }}>
                  {taxLabel}
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: taxAmt > 0 ? '#0F172A' : '#64748B' }}>
                  + ₹ {taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 900 }}>
                <td style={{ border: '1px solid #0F172A', padding: '8px 10px', fontSize: '13px' }}>
                  NET TOTAL AMOUNT
                </td>
                <td style={{ border: '1px solid #0F172A', padding: '8px 10px', textAlign: 'right', fontSize: '14px', color: '#FFFFFF' }}>
                  ₹ {formattedTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '24px',
          paddingTop: '14px',
          borderTop: '1px dashed #CBD5E1',
          fontSize: '11.5px',
        }}
      >
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ height: '28px' }}></div>
          <div style={{ borderTop: '1px solid #0F172A', marginBottom: '4px' }}></div>
          <div style={{ fontWeight: 700, color: '#334155' }}>Customer Signature</div>
        </div>
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>For Dheeksha Trade Link</div>
          <div style={{ borderTop: '1px solid #0F172A', marginBottom: '4px' }}></div>
          <div style={{ fontWeight: 700, color: '#334155' }}>Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
};
