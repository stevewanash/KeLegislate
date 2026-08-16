'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const DEFAULT_DEMO_BILLS = [
  { id: "finance-bill-2024", title: "The Finance Bill, 2024" },
  { id: "nairobi-bodaboda-regulations-2025", title: "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025" }
];

export default function DashboardPage() {
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState('all');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch bills for selector
  useEffect(() => {
    async function loadBills() {
      try {
        const response = await api.getBills(1, 100);
        if (response?.bills && response.bills.length > 0) {
          setBills(response.bills);
        } else {
          setBills(DEFAULT_DEMO_BILLS);
        }
      } catch (err) {
        console.warn('Failed to load bills for dashboard dropdown, using fallback:', err);
        setBills(DEFAULT_DEMO_BILLS);
      }
    }

    loadBills();
  }, []);

  // 2. Fetch stats for selected bill or global
  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);
        const billIdParam = selectedBill === 'all' ? null : selectedBill;
        const data = await api.getDashboardStats(billIdParam);
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        setError('Failed to load feedback statistics');
        // Fallback default state
        setStats({
          total_feedback: 0,
          support_pct: { support: 0.0, oppose: 0.0, neutral: 0.0 },
          avg_rating: 0.0,
          top_concerns: []
        });
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [selectedBill]);

  const supportPct = stats?.support_pct || { support: 0, oppose: 0, neutral: 0 };
  const totalResponses = stats?.total_feedback || 0;
  const avgRating = stats?.avg_rating || 0.0;
  const topConcerns = stats?.top_concerns || [];

  const opposeCount = Math.round((totalResponses * (supportPct.oppose || 0)) / 100);
  const supportCount = Math.round((totalResponses * (supportPct.support || 0)) / 100);
  const neutralCount = Math.round((totalResponses * (supportPct.neutral || 0)) / 100);

  return (
    <div className="container animate-fade-in">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Insights Dashboard</h1>
        <p className="page-subtitle">Aggregated citizen sentiment and verified feedback statistics on transport bills.</p>
      </div>

      {/* Selector dropdown */}
      <div style={{ marginBottom: '2rem' }}>
        <label className="form-label" style={{ fontWeight: 600 }}>Select Bill to View Insights</label>
        <select 
          className="form-input" 
          value={selectedBill} 
          onChange={(e) => setSelectedBill(e.target.value)}
          style={{ maxWidth: '500px', cursor: 'pointer' }}
        >
          <option value="all">All Bills (Global Legislative Overview)</option>
          {bills.map((b) => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <p>Aggregating verified citizen feedback metrics...</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!loading && stats && (
        <div className="dashboard-grid">
          {/* Sentiment Distribution Card */}
          <div className="content-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
              Support Stance Distribution
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Oppose */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Oppose ({supportPct.oppose}%)</span>
                  <span style={{ color: 'var(--text-muted)' }}>{opposeCount} responses</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, supportPct.oppose))}%`, height: '100%', background: '#ef4444', borderRadius: '4px' }}></div>
                </div>
              </div>
              
              {/* Support */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Support ({supportPct.support}%)</span>
                  <span style={{ color: 'var(--text-muted)' }}>{supportCount} responses</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, supportPct.support))}%`, height: '100%', background: '#10b981', borderRadius: '4px' }}></div>
                </div>
              </div>

              {/* Neutral */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Neutral ({supportPct.neutral}%)</span>
                  <span style={{ color: 'var(--text-muted)' }}>{neutralCount} responses</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, supportPct.neutral))}%`, height: '100%', background: '#94a3b8', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Statistics Card */}
          <div className="content-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Feedback Overview</h3>
              <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Responses</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalResponses}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Average Rating</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {avgRating} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ 5</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.85rem', borderRadius: '6px' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.2rem', fontSize: '0.85rem', fontWeight: 600 }}>Data Synchronization</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Aggregated anonymously from verified citizen feedback submissions.</p>
            </div>
          </div>

          {/* Top Concerns list */}
          <div className="content-card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Top Public Concerns</h3>
            {topConcerns.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {topConcerns.map((concern, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '22px', height: '22px', borderRadius: '50%', background: '#e2e8f0', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700 }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{concern}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No specific citizen concerns submitted yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
