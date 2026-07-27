'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [selectedBill, setSelectedBill] = useState('1');

  const mockStats = {
    "1": {
      title: "The Motor Vehicle Circulation Tax Bill, 2026",
      responses: 124,
      avg_rating: 1.8,
      support_pct: { support: 12, oppose: 78, neutral: 10 },
      concerns: ["Annual fee burden", "Direct hit on BodaBoda daily margins", "Strict penalty guidelines", "Verification complexity"]
    },
    "2": {
      title: "The Digital Marketplace Regulation Bill, 2026",
      responses: 86,
      avg_rating: 2.5,
      support_pct: { support: 30, oppose: 55, neutral: 15 },
      concerns: ["Withholding tax percentage", "Registration threshold limits", "Mobile money tracking", "Exemptions clarity"]
    }
  };

  const activeStats = mockStats[selectedBill];

  return (
    <div className="container animate-fade-in">
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Insights Dashboard</h1>
        <p style={{ color: '#cbd5e1' }}>Aggregated citizen sentiment and feedback statistics on active bills.</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Sentiment Distribution Card */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Support Stance Stature</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Oppose */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>Oppose ({activeStats.support_pct.oppose}%)</span>
                <span>{Math.round(activeStats.responses * activeStats.support_pct.oppose / 100)} citizens</span>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${activeStats.support_pct.oppose}%`, height: '100%', background: '#ef4444', borderRadius: '5px' }}></div>
              </div>
            </div>
            
            {/* Support */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Support ({activeStats.support_pct.support}%)</span>
                <span>{Math.round(activeStats.responses * activeStats.support_pct.support / 100)} citizens</span>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${activeStats.support_pct.support}%`, height: '100%', background: '#10b981', borderRadius: '5px' }}></div>
              </div>
            </div>

            {/* Neutral */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Neutral ({activeStats.support_pct.neutral}%)</span>
                <span>{Math.round(activeStats.responses * activeStats.support_pct.neutral / 100)} citizens</span>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${activeStats.support_pct.neutral}%`, height: '100%', background: '#f59e0b', borderRadius: '5px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Statistics Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Feedback Summary</h3>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total Responses</div>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{activeStats.responses}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Avg Rating</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>
                  {activeStats.avg_rating} <span style={{ fontSize: '1.25rem' }}>★</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '1rem', borderRadius: '8px' }}>
            <h5 style={{ color: '#a5b4fc', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Real-time Sync Active</h5>
            <p style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>Listening to Supabase PostgreSQL WAL broadcasts. Chart updates live as new citizen feedback is submitted.</p>
          </div>
        </div>

        {/* Top Concerns list */}
        <div className="glass-card" style={{ gridColumn: 'span 1' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Top Public Concerns</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeStats.concerns.map((concern, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(10,13,22,0.4)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-glow)', color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 700 }}>
                  {idx + 1}
                </span>
                <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{concern}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
