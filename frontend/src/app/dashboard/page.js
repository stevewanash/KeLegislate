'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [selectedBill, setSelectedBill] = useState('1');

  const mockStats = {
    "1": {
      title: "The Finance Bill, 2024",
      responses: 124,
      avg_rating: 1.8,
      support_pct: { support: 12, oppose: 78, neutral: 10 },
      concerns: ["Annual fee burden", "Direct hit on BodaBoda daily margins", "Strict penalty guidelines", "Verification complexity"]
    },
    "2": {
      title: "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025",
      responses: 86,
      avg_rating: 2.5,
      support_pct: { support: 30, oppose: 55, neutral: 15 },
      concerns: ["Withholding tax percentage", "Registration threshold limits", "Mobile money tracking", "Exemptions clarity"]
    }
  };

  const activeStats = mockStats[selectedBill];

  return (
    <div className="container animate-fade-in">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Insights Dashboard</h1>
        <p className="page-subtitle">Aggregated citizen sentiment and feedback statistics on transport bills.</p>
      </div>

      {/* Selector dropdown */}
      <div style={{ marginBottom: '2rem' }}>
        <label className="form-label">Select Bill to View Insights</label>
        <select 
          className="form-input" 
          value={selectedBill} 
          onChange={(e) => setSelectedBill(e.target.value)}
          style={{ maxWidth: '500px' }}
        >
          {Object.entries(mockStats).map(([id, stats]) => (
            <option key={id} value={id}>{stats.title}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {/* Sentiment Distribution Card */}
        <div className="content-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Support Stance Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Oppose */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Oppose ({activeStats.support_pct.oppose}%)</span>
                <span style={{ color: 'var(--text-muted)' }}>{Math.round(activeStats.responses * activeStats.support_pct.oppose / 100)} responses</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${activeStats.support_pct.oppose}%`, height: '100%', background: '#64748b', borderRadius: '4px' }}></div>
              </div>
            </div>
            
            {/* Support */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Support ({activeStats.support_pct.support}%)</span>
                <span style={{ color: 'var(--text-muted)' }}>{Math.round(activeStats.responses * activeStats.support_pct.support / 100)} responses</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${activeStats.support_pct.support}%`, height: '100%', background: '#5b46f6', borderRadius: '4px' }}></div>
              </div>
            </div>

            {/* Neutral */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Neutral ({activeStats.support_pct.neutral}%)</span>
                <span style={{ color: 'var(--text-muted)' }}>{Math.round(activeStats.responses * activeStats.support_pct.neutral / 100)} responses</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${activeStats.support_pct.neutral}%`, height: '100%', background: '#94a3b8', borderRadius: '4px' }}></div>
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
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{activeStats.responses}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Average Rating</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {activeStats.avg_rating} / 10
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
        <div className="content-card" style={{ gridColumn: 'span 1' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Top Public Concerns</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {activeStats.concerns.map((concern, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#e2e8f0', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700 }}>
                  {idx + 1}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{concern}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
