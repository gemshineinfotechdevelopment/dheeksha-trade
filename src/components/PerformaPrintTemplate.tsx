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
          marginBottom: '18px',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #0F172A' }}>
            <th style={{ padding: '8px 6px', textAlign: 'center', width: '35px', fontWeight: 700 }}>#</th>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Product Description</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', width: '130px', fontWeight: 700 }}>Company / Brand</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '80px', fontWeight: 700 }}>Cases</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '90px', fontWeight: 700 }}>Rate (₹)</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '60px', fontWeight: 700 }}>Units</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px', fontWeight: 700 }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {(performa.products || []).map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #E2E8F0' }}>
              <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748B' }}>{index + 1}</td>
              <td style={{ padding: '8px 10px' }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.productName}</div>
                {item.productCode && (
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Code: {item.productCode}</div>
                )}
              </td>
              <td style={{ padding: '8px 8px', color: '#0B4DB7', fontWeight: 600 }}>
                {item.companyName || performa.companyName || '-'}
              </td>
              <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                {item.requiredCases}
              </td>
              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{formatCurrency(item.rate)}</td>
              <td style={{ padding: '8px 8px', textAlign: 'center' }}>{item.pktPerUnit || 1}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                ₹{formatCurrency(item.allocatedAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Box & Financial Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '20px',
          borderTop: '2px solid #0F172A',
          paddingTop: '14px',
          marginBottom: '20px',
        }}
      >
        <div>
          {performa.notes && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Notes / Remarks:</div>
              <div style={{ fontSize: '13px', color: '#1E293B', fontStyle: 'italic' }}>{performa.notes}</div>
            </div>
          )}
          <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: '1.4' }}>
            * This document represents the customer performa and product requirement record entered for reference.
          </div>
        </div>

        <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '18px', fontSize: '13.5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#475569' }}>Total Cases:</span>
            <span style={{ fontWeight: 800 }}>{performa.totalRequiredCases}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#475569' }}>Total Amount:</span>
            <span style={{ fontWeight: 800 }}>₹{formatCurrency(performa.totalAllocatedAmount)}</span>
          </div>
          <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '8px 0' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '6px',
              borderTop: '2px solid #0B4DB7',
            }}
          >
            <span style={{ color: '#0B4DB7', fontWeight: 800, fontSize: '15px' }}>Advance Received:</span>
            <span style={{ fontWeight: 800, color: '#0B4DB7', fontSize: '15px' }}>₹{formatCurrency(performa.advanceAmount)}</span>
          </div>
        </div>
      </div>

      {/* Footer Signatures */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '36px',
          paddingTop: '16px',
          borderTop: '1px dashed #CBD5E1',
          fontSize: '12px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: '32px' }} />
          <div style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '4px', fontWeight: 600 }}>
            Customer Signature
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: '20px' }}>For Dheeksha Trade Link</div>
          <div style={{ borderTop: '1px solid #000', width: '160px', paddingTop: '4px', fontWeight: 600 }}>
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
};
