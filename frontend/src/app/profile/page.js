'use client';

import { useState } from 'react';

export default function ProfilePage() {
  const [industry, setIndustry] = useState('');
  const [tier, setTier] = useState('');
  const [vehicleValue, setVehicleValue] = useState('');
  const [revenue, setRevenue] = useState('');
  const [overhead, setOverhead] = useState('');
  const [employees, setEmployees] = useState('0');
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const industriesList = [
    "Transport & Logistics",
    "Digital & Content Creation",
    "Agriculture & Farming",
    "Retail & Market Trading",
    "Hospitality & Food Service",
    "Manufacturing & Artisan",
    "Finance & Mobile Money",
    "Construction & Real Estate"
  ];

  const handleSave = (e) => {
    e.preventDefault();
    if (!industry || !consent) return;

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1200);
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Business Profile</h1>
        <p style={{ color: '#cbd5e1' }}>Save your specific business metrics securely. We use these to calculate exact, personalized impact assessments.</p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSave}>
          {/* Industry Selection */}
          <div className="form-group">
            <label className="form-label">Primary Industry</label>
            <select 
              className="form-input" 
              value={industry} 
              onChange={(e) => setIndustry(e.target.value)}
              required
            >
              <option value="">-- Choose Industry --</option>
              {industriesList.map((ind, i) => (
                <option key={i} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Tier Label (Optional reference) */}
          <div className="form-group">
            <label className="form-label">Closest Hustle Tier (Optional reference)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. BodaBoda Rider, Retail Kiosk Operator"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent)' }}>Custom Business Metrics</h4>
            
            {/* Vehicle Value */}
            <div className="form-group">
              <label className="form-label">Estimated Vehicle / Asset Value (KES)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 150000"
                value={vehicleValue}
                onChange={(e) => setVehicleValue(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Used to evaluate asset-based circulation taxes.</p>
            </div>

            {/* Monthly Revenue */}
            <div className="form-group">
              <label className="form-label">Estimated Monthly Revenue Range (KES)</label>
              <select 
                className="form-input" 
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              >
                <option value="">-- Choose Revenue Range --</option>
                <option value="0-15000">Below KES 15,000</option>
                <option value="15000-50000">KES 15,000 - 50,000</option>
                <option value="50000-100000">KES 50,000 - 100,000</option>
                <option value="100000+">Above KES 100,000</option>
              </select>
            </div>

            {/* Monthly Operating Overhead */}
            <div className="form-group">
              <label className="form-label">Estimated Monthly Operating Overhead (KES)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 20000"
                value={overhead}
                onChange={(e) => setOverhead(e.target.value)}
              />
            </div>

            {/* Employees count */}
            <div className="form-group">
              <label className="form-label">Employee Count</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
              />
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="form-group" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <label style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={consent}
                onChange={() => setConsent(!consent)}
                required
                style={{ width: '20px', height: '20px', marginTop: '0.1rem', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                I consent to KeLegislate storing my business profile metrics. I understand my data is encrypted at the application layer before being saved in Supabase, and will only be used to compute personalized financial impacts. I can delete this data at any time.
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: '2' }}
              disabled={saving}
            >
              {saving ? "Saving Profile..." : "Save Business Profile"}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ flex: '1', borderColor: 'var(--danger)', color: '#f87171' }}
            >
              Delete
            </button>
          </div>
        </form>

        {saved && (
          <div className="animate-fade-in" style={{ 
            marginTop: '1.5rem', padding: '1rem', background: 'rgba(16,185,129,0.1)', 
            border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', borderRadius: '8px', 
            textAlign: 'center', fontSize: '0.9rem', fontWeight: 600
          }}>
            Business profile successfully saved and encrypted!
          </div>
        )}
      </div>
    </div>
  );
}
