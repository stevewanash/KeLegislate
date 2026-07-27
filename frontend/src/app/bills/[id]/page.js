'use client';

import { useState } from 'react';

export default function BillDetailPage({ params }) {
  const [lang, setLang] = useState('en');
  const [industry, setIndustry] = useState('');
  const [tier, setTier] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);

  const billId = params.id;

  const mockBill = {
    title: "The Motor Vehicle Circulation Tax Bill, 2026",
    date: "July 24, 2026",
    source_url: "https://parliament.go.ke/bills/motor-circulation-tax-2026.pdf",
    tags: ["Transport & Logistics", "Finance & Mobile Money"],
    summary_en: "Imposes a circulation tax on all motor vehicles in Kenya, setting rates based on engine capacity and vehicle value. For commercial passenger transporters, the annual levy is set to rise, while electric vehicles receive a reduced rate incentive.",
    summary_sw: "Huanzisha kodi mpya ya mzunguko wa magari yote nchini Kenya, ikipangwa kulingana na ukubwa wa injini na thamani ya gari. Magari ya usafiri wa umma yatatozwa ushuru mkubwa zaidi, ilhali magari ya umeme yatapewa punguzo kama motisha.",
    regex_extractions: [
      { type: "Percentage", value: "2.5%", context: "A circulation tax of 2.5% of the vehicle value is payable annually." },
      { type: "Monetary", value: "KES 5,000", context: "Subject to a minimum threshold charge of KES 5,000 per vehicle." }
    ]
  };

  const mockHustleTiers = {
    "Transport & Logistics": ["Tier 1 — BodaBoda Rider", "Tier 2 — TukTuk Transporter", "Tier 3 — MiniBus/Matatu Operator"],
    "Digital & Content Creation": ["Tier 1 — Affiliate Blogger", "Tier 2 — TikTok Creator", "Tier 3 — Production Agency"],
    "Retail & Market Trading": ["Tier 1 — Hawking Retailer", "Tier 2 — Kiosk Stand Proprietor", "Tier 3 — Wholesale Depot"]
  };

  const handleCalculate = (e) => {
    e.preventDefault();
    if (!industry || !tier) return;

    setCalculating(true);
    setResult(null);

    setTimeout(() => {
      setCalculating(false);
      setResult({
        impact_table: [
          { item: "Annual Vehicle Circulation Tax", amount: "KES 6,250", notes: "2.5% of vehicle value (KES 250,000)" },
          { item: "Compliance Registration Levy", amount: "KES 1,200", notes: "Flat fee for transport registration" },
          { item: "Total Cost Increase", amount: "KES 7,450", notes: "Computed per vehicle annually" }
        ],
        net_monthly_impact: -620.83,
        compliance_checklist: [
          "Verify vehicle engine capacity records",
          "Register circulation license card via e-Citizen portal",
          "Ensure compliance display sticker is active"
        ],
        risk_level: "MEDIUM",
        verified: true
      });
    }, 1500);
  };

  return (
    <div className="container animate-fade-in">
      {/* Bill Metadata Header */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
        <a href="/bills" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
          ← Back to Bills List
        </a>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>{mockBill.title}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {mockBill.tags.map((tag, i) => (
            <span key={i} className="badge badge-primary">{tag}</span>
          ))}
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: 'auto' }}>Published: {mockBill.date}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Bill Summary Column (Left) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>AI Summary Analysis</h3>
              <div style={{ display: 'flex', background: 'var(--bg-dark)', borderRadius: '8px', padding: '0.2rem', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setLang('en')}
                  style={{ 
                    background: lang === 'en' ? 'var(--primary)' : 'transparent',
                    border: 'none', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >EN</button>
                <button 
                  onClick={() => setLang('sw')}
                  style={{ 
                    background: lang === 'sw' ? 'var(--primary)' : 'transparent',
                    border: 'none', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >SW</button>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.6' }}>
              {lang === 'en' ? mockBill.summary_en : mockBill.summary_sw}
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <a 
                href={mockBill.source_url} 
                target="_blank" 
                rel="noreferrer" 
                style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
              >
                View Original Bill PDF ↗
              </a>
            </div>
          </div>

          {/* Key Regex Extraction Data */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Key Legal Metrics (Regex Extracted)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mockBill.regex_extractions.map((ext, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: 'rgba(10,13,22,0.5)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{ext.type}</span>
                    <strong style={{ color: 'white' }}>{ext.value}</strong>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{ext.context}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calculator Column (Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Calculate My Hustle Impact</h3>
            <form onSubmit={handleCalculate}>
              <div className="form-group">
                <label className="form-label">Select Industry</label>
                <select 
                  className="form-input" 
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value);
                    setTier('');
                  }}
                  required
                >
                  <option value="">-- Choose Industry --</option>
                  {Object.keys(mockHustleTiers).map((ind, i) => (
                    <option key={i} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              {industry && (
                <div className="form-group">
                  <label className="form-label">Select Hustle Tier</label>
                  <select 
                    className="form-input" 
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Hustle Tier --</option>
                    {mockHustleTiers[industry].map((tr, i) => (
                      <option key={i} value={tr}>{tr}</option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={calculating}
              >
                {calculating ? "Calculating Impact..." : "Calculate My Impact"}
              </button>
            </form>

            {/* Calculations Loading Spinner */}
            {calculating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2rem 0', gap: '0.5rem' }}>
                <div className="spinner" style={{ 
                  width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.1)', 
                  borderTop: '3px solid var(--primary)', borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <style jsx>{`
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Analyzing tax formulas...</p>
              </div>
            )}

            {/* Simulated Results Display */}
            {result && (
              <div className="animate-fade-in" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '1.1rem' }}>Impact Results</h4>
                  <span className="badge badge-primary" style={{ 
                    backgroundColor: result.risk_level === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', 
                    color: result.risk_level === 'HIGH' ? '#f87171' : '#fbbf24',
                    border: result.risk_level === 'HIGH' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(245,158,11,0.3)'
                  }}>
                    {result.risk_level} RISK
                  </span>
                </div>

                {/* Impact Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0', color: '#94a3b8' }}>Expense Item</th>
                      <th style={{ padding: '0.5rem 0', color: '#94a3b8', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.impact_table.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 0' }}>
                          <div>{row.item}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.notes}</div>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>
                          {row.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary Metric */}
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#f87171' }}>Estimated Net Monthly Impact</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171' }}>
                    KES {Math.abs(result.net_monthly_impact).toLocaleString()}/month
                  </div>
                </div>

                {/* Compliance Checklist */}
                <div>
                  <h5 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Compliance Checklist</h5>
                  <ul style={{ paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {result.compliance_checklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
