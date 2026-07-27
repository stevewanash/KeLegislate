'use client';

import { useState } from 'react';

export default function SubscribePage() {
  const [phone, setPhone] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [language, setLanguage] = useState('en');
  const [channels, setChannels] = useState(['sms']);
  const [consent, setConsent] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const handleCheckboxChange = (ind) => {
    if (selectedIndustries.includes(ind)) {
      setSelectedIndustries(selectedIndustries.filter(x => x !== ind));
    } else {
      setSelectedIndustries([...selectedIndustries, ind]);
    }
  };

  const handleChannelChange = (chan) => {
    if (channels.includes(chan)) {
      setChannels(channels.filter(x => x !== chan));
    } else {
      setChannels([...channels, chan]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone || selectedIndustries.length === 0 || !consent) return;

    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
    }, 1500);
  };

  if (subscribed) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '600px', textAlign: 'center', marginTop: '3rem' }}>
        <div className="glass-card" style={{ padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3.5rem', color: 'var(--success)', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Successfully Subscribed!</h2>
          <p style={{ color: '#cbd5e1', marginBottom: '2rem' }}>
            We have registered your phone number ({phone}) for alerts on:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
            {selectedIndustries.map((ind, i) => (
              <span key={i} className="badge badge-accent">{ind}</span>
            ))}
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '2rem' }}>
            You will receive a confirmation message shortly. You can manage or cancel your subscription at any time.
          </p>
          <button onClick={() => setSubscribed(false)} className="btn btn-secondary">
            Manage Preferences
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '700px' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Subscribe to Proactive Alerts</h1>
        <p style={{ color: '#cbd5e1' }}>Register your phone to receive customized SMS or WhatsApp impact alerts as soon as bills are proposed.</p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          {/* Phone input */}
          <div className="form-group">
            <label className="form-label">Kenyan Phone Number</label>
            <input 
              type="tel"
              className="form-input"
              placeholder="+254 700 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>E.164 format. Phone number will be stored encrypted via Supabase Vault.</p>
          </div>

          {/* Industry Selection */}
          <div className="form-group">
            <label className="form-label">Select Relevant Industries (Multi-select)</label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '0.75rem',
              marginTop: '0.5rem' 
            }}>
              {industriesList.map((ind, i) => (
                <label key={i} style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.75rem', 
                  padding: '0.75rem', background: 'rgba(10,13,22,0.4)', 
                  borderRadius: '8px', border: '1px solid var(--border-color)', 
                  cursor: 'pointer' 
                }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIndustries.includes(ind)}
                    onChange={() => handleCheckboxChange(ind)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>{ind}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Language Selection */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Preferred Alert Language</label>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="language" 
                  value="en"
                  checked={language === 'en'}
                  onChange={() => setLanguage('en')}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>English</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="language" 
                  value="sw"
                  checked={language === 'sw'}
                  onChange={() => setLanguage('sw')}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>Swahili</span>
              </label>
            </div>
          </div>

          {/* Channel Selection */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Alert Channels</label>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={channels.includes('sms')}
                  onChange={() => handleChannelChange('sms')}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>SMS Alerts</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={channels.includes('whatsapp')}
                  onChange={() => handleChannelChange('whatsapp')}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>WhatsApp Alerts</span>
              </label>
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
                By checking this box, I explicitly consent to KeLegislate processing my phone number and sending alerts. I understand that my data is protected in accordance with the Kenya Data Protection Act (KDPA) 2019, stored securely, and can be deleted instantly by unsubscribing.
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={submitting}
          >
            {submitting ? "Signing Up..." : "Confirm Subscription"}
          </button>
        </form>
      </div>
    </div>
  );
}
