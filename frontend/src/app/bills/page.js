'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { truncateWords } from '../../lib/excerpt';

const DEFAULT_DEMO_BILLS = [
  {
    id: "finance-bill-2024",
    title: "The Finance Bill, 2024",
    bill_type: "financial",
    created_at: "2026-08-01T00:00:00Z",
    ai_summary_en: "The Finance Bill, 2024 proposes significant taxation and fiscal adjustments aimed at revenue mobilization. For transport and mobility operators, key proposals include introducing an annual motor vehicle circulation tax calculated at 2.5% of the vehicle's declared value (with a minimum statutory cap of KES 5,000), revisions to fuel levy tariffs, and adjusted withholding tax thresholds for micro-enterprises."
  },
  {
    id: "nairobi-bodaboda-regulations-2025",
    title: "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025",
    bill_type: "regulatory",
    created_at: "2026-08-05T00:00:00Z",
    ai_summary_en: "These county regulations mandate annual county operating permits for all commercial motorcycle taxi operators in Nairobi County. They enforce designated SACCO registration, biometric rider badge identification, two standard reflective helmets, and designated CBD pick-and-drop zones."
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
          setBills(response.bills);
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

  const getBillTeaser = (bill) => {
    const text = bill.ai_summary_en || (
      bill.title.includes('Finance')
        ? "The Finance Bill, 2024 proposes significant taxation and fiscal adjustments aimed at revenue mobilization for transport operators."
        : "These county regulations mandate annual county operating permits for commercial motorcycle operators in Nairobi."
    );
    return truncateWords(text, 16);
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
                {getBillTeaser(bill)}
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
