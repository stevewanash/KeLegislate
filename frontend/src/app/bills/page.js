'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
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
  const [filterType, setFilterType] = useState('ALL');
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

  const filteredBills = bills.filter((bill) => {
    if (filterType === 'ALL') return true;
    return bill.bill_type?.toLowerCase() === filterType.toLowerCase();
  });

  const getBillTypeTag = (type) => {
    const isFin = (type || 'financial').toLowerCase() === 'financial';
    return isFin ? (
      <span className="badge-financial">Financial</span>
    ) : (
      <span className="badge-regulatory">Regulatory</span>
    );
  };

  const getBillTeaser = (bill) => {
    const text = bill.ai_summary_en || (
      bill.title.includes('Finance')
        ? "The Finance Bill, 2024 proposes significant taxation and fiscal adjustments aimed at revenue mobilization for transport operators."
        : "These county regulations mandate annual county operating permits for commercial motorcycle operators in Nairobi."
    );
    return truncateWords(text, 18);
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Browse Legislative Bills</h1>
        <p className="page-subtitle">
          Bodaboda sector legislation, finance acts, and regulation bills moving through Parliament and County Assemblies.
        </p>
      </div>

      {/* F8: Filter Bar matching impact page */}
      <div className="content-card" style={{ marginBottom: '1.75rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="bill-filter-select" className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>Filter by Type:</label>
            <select
              id="bill-filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input"
              style={{
                width: 'auto',
                padding: '0.45rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Legislation</option>
              <option value="financial">Financial</option>
              <option value="regulatory">Regulatory</option>
            </select>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Showing <strong>{filteredBills.length}</strong> of {bills.length} bills
          </div>
        </div>
      </div>

      {/* F10: Loading State with Spinner */}
      {loading && (
        <LoadingSpinner message="Loading legislative bills..." />
      )}

      {/* Bill Cards List */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3rem' }}>
          {filteredBills.map((bill) => (
            <div key={bill.id} className="content-card content-card-interactive">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <h2 className="card-title" style={{ flex: '1', minWidth: '240px', fontSize: '1.3rem', lineHeight: '1.35' }}>
                  <a href={`/bills/${bill.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {bill.title}
                  </a>
                </h2>
                <div>
                  {getBillTypeTag(bill.bill_type)}
                </div>
              </div>

              <p className="card-description" style={{ marginBottom: '1.25rem' }}>
                {getBillTeaser(bill)}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingTop: '0.85rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <a
                  href={`/bills/${bill.id}`}
                  className="card-link"
                  style={{ fontSize: '0.925rem', fontWeight: 600 }}
                >
                  Read Full Bill Summary &rarr;
                </a>
              </div>
            </div>
          ))}

          {filteredBills.length === 0 && (
            <div className="content-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              No legislation found matching the selected filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
