'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { truncateWords } from '../../lib/excerpt';

const DEFAULT_DEMO_BILLS = [
  {
    id: "213dac54-7d9d-41f3-b87c-25e135450e4d",
    title: "The Finance Bill, 2024",
    bill_type: "financial",
    created_at: "2026-08-01T00:00:00Z",
    impact_summary: "Key financial and tax changes for the transport sector, including an annual motor vehicle circulation tax."
  },
  {
    id: "a7e1b8e6-b31e-42b6-8bc5-37be68ffecde",
    title: "The Nairobi City County Transport Act, 2020 — Motorcycle Taxi (Boda Boda) Permit Regulations, 2025",
    bill_type: "regulatory",
    created_at: "2026-08-05T00:00:00Z",
    impact_summary: "Key regulatory and compliance requirements for commercial motorcycle operators in Nairobi County."
  }
];

export default function ImpactListPage() {
  const [bills, setBills] = useState([]);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'financial', 'regulatory'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadBills() {
      try {
        setLoading(true);
        const res = await api.getBills(1, 50);
        if (res && res.bills && res.bills.length > 0) {
          // If some bills lack impact_summary, fetch in parallel
          const billsWithImpact = await Promise.all(
            res.bills.map(async (b) => {
              if (b.impact_summary) return b;
              try {
                const impactRes = await api.getImpact(b.id);
                return {
                  ...b,
                  impact_summary: impactRes?.concise_summary || b.ai_summary_en || ''
                };
              } catch (e) {
                return b;
              }
            })
          );
          setBills(billsWithImpact);
        } else {
          setBills(DEFAULT_DEMO_BILLS);
        }
      } catch (err) {
        console.warn('Failed to load bills via API, using fallback:', err);
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

  const getBillTypeBadge = (type) => {
    return <span className="badge-neutral">{type === 'regulatory' ? 'Regulatory' : 'Financial'}</span>;
  };

  const getImpactTeaser = (bill) => {
    const text = bill.impact_summary || bill.concise_summary || (
      bill.bill_type === 'regulatory'
        ? "Key regulatory compliance requirements, SACCO mandates, and county permit enforcement rules for transport operators."
        : "Key financial and tax policy impacts, motor vehicle levies, and cash-flow estimates for transport operators."
    );
    return truncateWords(text, 16);
  };

  return (
    <div className="container animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Legislative Impact & Calculators</h1>
        <p className="page-subtitle">
          Pre-generated worked example scenarios and compliance guides for Kenya's boda boda transport sector.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: 0, fontWeight: 600 }}>Filter by Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                background: '#f8fafc',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="ALL">All Legislation</option>
              <option value="financial">Financial Bills</option>
              <option value="regulatory">Regulatory Regulations</option>
            </select>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Showing <strong>{filteredBills.length}</strong> of {bills.length} bills
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Loading legislative impact data...</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Bills Cards List */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3rem' }}>
          {filteredBills.map((bill) => (
            <div key={bill.id} className="content-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <h2 className="card-title" style={{ flex: '1', minWidth: '240px', fontSize: '1.25rem', lineHeight: '1.3' }}>
                  <a href={`/impact/${bill.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {bill.title}
                  </a>
                </h2>
                <div>
                  {getBillTypeBadge(bill.bill_type)}
                </div>
              </div>

              <p className="card-description" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                {getImpactTeaser(bill)}
              </p>

              <div style={{
                display: 'flex',
                justify: 'flex-end',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <a
                  href={`/impact/${bill.id}`}
                  className="card-link"
                  style={{ fontSize: '0.9rem', fontWeight: 600 }}
                >
                  View Pre-Generated Impact & Calculator &rarr;
                </a>
              </div>
            </div>
          ))}

          {filteredBills.length === 0 && (
            <div className="content-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No legislation found for the selected filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
