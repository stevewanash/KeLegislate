'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const DEFAULT_DEMO_BILLS = [
  {
    id: "finance-bill-2024",
    title: "The Finance Bill, 2024",
    bill_type: "financial",
    created_at: "2026-08-01T00:00:00Z",
    excerpt: "Introduces motor vehicle circulation taxes, fuel levies, and withholding tax adjustments impacting transport operators and micro-enterprises."
  },
  {
    id: "nairobi-bodaboda-regulations-2025",
    title: "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025",
    bill_type: "regulatory",
    created_at: "2026-08-05T00:00:00Z",
    excerpt: "Establishes mandatory annual county operating permits, designated SACCO registration requirements, helmet safety standards, and enforcement penalties."
  }
];

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBills() {
      setLoading(true);
      try {
        const response = await api.getBills(1, 20);
        if (response && response.bills && response.bills.length > 0) {
          const formattedBills = response.bills.map((b) => ({
            id: b.id,
            title: b.title,
            bill_type: b.bill_type || 'financial',
            created_at: b.created_at,
            excerpt: b.ai_summary_en
              ? (b.ai_summary_en.length > 160 ? b.ai_summary_en.substring(0, 160) + '...' : b.ai_summary_en)
              : (b.title.includes('Finance')
                ? "Introduces motor vehicle circulation taxes, fuel levies, and withholding tax adjustments impacting transport operators."
                : "Establishes mandatory annual county operating permits, SACCO registration, and helmet safety standards.")
          }));
          setBills(formattedBills);
        } else {
          setBills(DEFAULT_DEMO_BILLS);
        }
      } catch (err) {
        console.warn('API fetch error, using demo bills fallback:', err);
        setBills(DEFAULT_DEMO_BILLS);
      } finally {
        setLoading(false);
      }
    }

    loadBills();
  }, []);

  const getBillTypeTag = (type) => {
    switch (type) {
      case 'regulatory':
        return <span className="badge-neutral">Regulatory</span>;
      case 'financial':
      default:
        return <span className="badge-neutral">Financial</span>;
    }
  };

  return (
    <div className="container animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Browse Legislative Bills</h1>
        <p className="page-subtitle">
          Active transport sector bills and regulations currently moving through Parliament and Nairobi County Assembly.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 0',
          gap: '1rem'
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading legislative bills...</p>
        </div>
      )}

      {/* Bill Cards List */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3rem' }}>
          {bills.map((bill) => (
            <div key={bill.id} className="content-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <h2 className="card-title" style={{ flex: '1', minWidth: '240px', fontSize: '1.25rem', lineHeight: '1.3' }}>
                  <a href={`/bills/${bill.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {bill.title}
                  </a>
                </h2>
                <div>
                  {getBillTypeTag(bill.bill_type)}
                </div>
              </div>

              <p className="card-description" style={{ marginBottom: '1rem' }}>
                {bill.excerpt}
              </p>

              <div style={{
                display: 'flex',
                justify: 'flex-end',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <a
                  href={`/bills/${bill.id}`}
                  className="card-link"
                  style={{ fontSize: '0.9rem', fontWeight: 600 }}
                >
                  Read Full Bill Summary
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
