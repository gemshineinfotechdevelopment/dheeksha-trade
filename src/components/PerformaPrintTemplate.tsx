import React from 'react';

export interface PerformaPrintProduct {
  productCode?: string;
  productName: string;
  companyName?: string;
  category?: string;
  requiredCases: number;
  usedCases?: number;
  remainingCases?: number;
  rate: number;
  pktPerUnit: number;
  allocatedAmount: number;
}

export interface PerformaPrintData {
  performaNumber: string;
  companyName?: string;
  date: string;
  customerSnapshot: {
    name: string;
    phone?: string;
    companyName?: string;
    address?: string;
    gst?: string;
  };
  advanceAmount: number;
  advanceUsedAmount?: number;
  remainingAdvanceAmount?: number;
  products: PerformaPrintProduct[];
  totalRequiredCases: number;
  totalUsedCases?: number;
  totalRemainingCases?: number;
  subtotal?: number;
  discount?: string | number;
  discountAmount?: number;
  packing?: string | number;
  packingAmount?: number;
  tax?: string | number;
  taxAmount?: number;
  totalAllocatedAmount: number;
  totalUsedAmount?: number;
  totalRemainingAmount?: number;
  status: string;
  notes?: string;
  preparedBy?: string;
}

interface PerformaPrintTemplateProps {
  performa: PerformaPrintData;
}

export const PerformaPrintTemplate: React.FC<PerformaPrintTemplateProps> = ({ performa }) => {
  const preparedBy = performa.preparedBy || 'S.Nagaraj';
  const customer = performa.customerSnapshot || { name: 'Customer' };

  const formatCurrency = (val: number | undefined) => {
    const num = val || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const rawSubtotal = (performa.products || []).reduce(
    (acc, p: any) =>
      acc +
      (p.allocatedAmount !== undefined && Number(p.allocatedAmount) > 0
        ? Number(p.allocatedAmount)
        : (Number(p.requiredCases) || 0) * (Number(p.rate) || 0) * (Number(p.pktPerUnit || p.pktUnit) || 1)),
    0
  );
  const subtotalVal = performa.subtotal !== undefined && performa.subtotal > 0 ? performa.subtotal : rawSubtotal;

  // Discount calculation
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

  // Packing calculation (% on discounted base amount or flat amount)
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

  // Tax calculation (flat ₹ amount)
  const rawTax = String(performa.tax ?? '').trim().replace(/[^0-9.]/g, '');
  const taxNum = parseFloat(rawTax) || 0;
  let taxAmt = 0;
  if (performa.taxAmount !== undefined && Number(performa.taxAmount) > 0) {
    taxAmt = Number(performa.taxAmount);
  } else if (taxNum > 0) {
    taxAmt = taxNum;
  }

  // Total Allocated Value = Subtotal - Discount + Packing + Tax
  const totalAllocatedVal = Math.max(0, subtotalVal - discountAmt + packingAmt + taxAmt);

  return (
    <div
      className="dheeksha-performa-container"
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
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '14px' }}>
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

      {/* Prominent Performa Notice Banner */}
      <div
        style={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          textAlign: 'center',
          padding: '6px 12px',
          borderRadius: '4px',
          fontWeight: 800,
          fontSize: '14px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}
      >
        PERFORMA / NOT A TAX INVOICE
      </div>

      {/* Performa Metadata Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          border: '1px solid #CBD5E1',
          borderRadius: '6px',
          padding: '14px 18px',
          marginBottom: '18px',
          backgroundColor: '#F8FAFC',
          fontSize: '13px',
        }}
      >
        <div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Performa No: </span>
            <span style={{ fontWeight: 800, color: '#0B4DB7', fontSize: '15px' }}>{performa.performaNumber}</span>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Date: </span>
            <span style={{ fontWeight: 700 }}>{performa.date}</span>
          </div>
          <div>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Status: </span>
            <span
              style={{
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor:
                  performa.status === 'ACTIVE'
                    ? '#DCFCE7'
                    : performa.status === 'PARTIALLY_USED'
                    ? '#FEF3C7'
                    : performa.status === 'COMPLETED'
                    ? '#E2E8F0'
                    : '#FEE2E2',
                color:
                  performa.status === 'ACTIVE'
                    ? '#166534'
                    : performa.status === 'PARTIALLY_USED'
                    ? '#92400E'
                    : performa.status === 'COMPLETED'
                    ? '#475569'
                    : '#991B1B',
                fontSize: '12px',
              }}
            >
              {performa.status}
            </span>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Customer: </span>
            <span style={{ fontWeight: 800, fontSize: '14px' }}>{customer.name}</span>
          </div>
          {customer.phone && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Phone: </span>
              <span style={{ fontWeight: 600 }}>{customer.phone}</span>
            </div>
          )}
          {customer.companyName && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Company: </span>
              <span style={{ fontWeight: 600 }}>{customer.companyName}</span>
            </div>
          )}
          {customer.address && (
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Address: </span>
              <span>{customer.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Products Allocation Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #0F172A',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '35px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>#</th>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Product Description</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', width: '120px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Company</th>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '70px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Cases</th>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '70px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Remaining</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '80px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Rate (₹)</th>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '55px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Units</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', width: '105px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', border: '1px solid #0F172A' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {(performa.products || []).length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#64748B', border: '1px solid #CBD5E1' }}>
                No products allocated.
              </td>
            </tr>
          ) : (
            (performa.products || []).map((item, index) => {
              const isEven = index % 2 === 1;
              return (
                <tr key={index} style={{ backgroundColor: isEven ? '#F8FAFC' : '#FFFFFF' }}>
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#475569', border: '1px solid #CBD5E1', fontWeight: 600 }}>{index + 1}</td>
                  <td style={{ padding: '7px 10px', border: '1px solid #CBD5E1' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.productName}</div>
                    {item.productCode && (
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>Code: {item.productCode}</div>
                    )}
                  </td>
                  <td style={{ padding: '7px 8px', color: '#0B4DB7', fontWeight: 600, border: '1px solid #CBD5E1', fontSize: '11.5px' }}>
                    {(item.companyName && item.companyName.trim()) || (item as any).productSnapshot?.companyName || performa.companyName || '-'}
                  </td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 800, color: '#0F172A', border: '1px solid #CBD5E1' }}>
                    {item.requiredCases}
                  </td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#0B4DB7', border: '1px solid #CBD5E1' }}>
                    {item.remainingCases !== undefined ? item.remainingCases : item.requiredCases}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', border: '1px solid #CBD5E1', color: '#334155' }}>₹ {formatCurrency(item.rate)}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #CBD5E1', color: '#64748B' }}>{item.pktPerUnit || 1}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#0F172A', border: '1px solid #CBD5E1' }}>
                    ₹ {formatCurrency(item.allocatedAmount)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Summary Box & Financial Breakdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '18px',
          marginTop: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ width: '52%', fontSize: '11px', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 14px', backgroundColor: '#FAFAFA' }}>
          {performa.notes && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Notes: <em>{performa.notes}</em></div>
            </div>
          )}
          <div style={{ lineHeight: '1.4' }}>
            • This quotation reserves product requirement allocation. Billed cases will automatically deduct from available customer advance balance.
          </div>
        </div>

        <div style={{ width: '44%', fontSize: '12px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#F8FAFC', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#475569' }}>Total Required Cases:</span>
            <strong style={{ color: '#0F172A' }}>{performa.totalRequiredCases}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#475569' }}>Subtotal:</span>
            <strong style={{ color: '#0F172A' }}>₹ {formatCurrency(subtotalVal)}</strong>
          </div>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#DC2626' }}>
              <span>Discount {performa.discount ? `(${performa.discount}${String(performa.discount).includes('%') ? '' : '%'})` : ''}:</span>
              <strong style={{ fontWeight: 700 }}>- ₹ {formatCurrency(discountAmt)}</strong>
            </div>
          )}
          {packingAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#475569' }}>
              <span>Packing {performa.packing ? `(${performa.packing}${String(performa.packing).includes('%') ? '' : '%'})` : ''}:</span>
              <strong style={{ fontWeight: 700, color: '#0F172A' }}>+ ₹ {formatCurrency(packingAmt)}</strong>
            </div>
          )}
          {taxAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#475569' }}>
              <span>Tax (Amount):</span>
              <strong style={{ fontWeight: 700, color: '#0F172A' }}>+ ₹ {formatCurrency(taxAmt)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', paddingTop: '4px', borderTop: '1px dashed #CBD5E1' }}>
            <span style={{ color: '#0F172A', fontWeight: 700 }}>Total Value:</span>
            <strong style={{ color: '#0B4DB7', fontWeight: 800, fontSize: '13.5px' }}>₹ {formatCurrency(totalAllocatedVal)}</strong>
          </div>
          <div style={{ height: '1px', backgroundColor: '#CBD5E1', margin: '6px 0' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '5px',
              color: '#0B4DB7',
            }}
          >
            <span style={{ fontWeight: 700 }}>Customer Advance:</span>
            <strong style={{ fontWeight: 800 }}>₹ {formatCurrency(performa.advanceAmount)}</strong>
          </div>
          {performa.advanceUsedAmount ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '5px',
                color: '#DC2626',
              }}
            >
              <span>Advance Consumed:</span>
              <strong style={{ fontWeight: 700 }}>- ₹ {formatCurrency(performa.advanceUsedAmount)}</strong>
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '6px',
              borderTop: '2px solid #0B4DB7',
              marginTop: '4px',
              fontSize: '13px',
              color: '#166534',
            }}
          >
            <span style={{ fontWeight: 800 }}>Remaining Advance:</span>
            <strong style={{ fontWeight: 900 }}>₹ {formatCurrency(performa.remainingAdvanceAmount !== undefined ? performa.remainingAdvanceAmount : performa.advanceAmount)}</strong>
          </div>
        </div>
      </div>

      {/* Footer Signatures */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '28px',
          paddingTop: '14px',
          borderTop: '1px dashed #CBD5E1',
          fontSize: '11px',
        }}
      >
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ height: '28px' }} />
          <div style={{ borderTop: '1px solid #0F172A', paddingTop: '4px', fontWeight: 700 }}>
            Customer Signature
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ fontWeight: 700, marginBottom: '24px' }}>For Dheeksha Trade Link</div>
          <div style={{ borderTop: '1px solid #0F172A', paddingTop: '4px', fontWeight: 700 }}>
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
};
