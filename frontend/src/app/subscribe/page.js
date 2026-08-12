'use client';

import { useState } from 'react';

export default function SubscribePage() {
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('en');
  const [consent, setConsent] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone || !consent) return;

    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
    }, 1500);
  };

  if (subscribed) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '600px', textAlign: 'center', marginTop: '3rem' }}>
        <div className="content-card" style={{ padding: '3rem 2rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Successfully Subscribed</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            We have registered your phone number ({phone}) for SMS alerts on transport legislation.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
            You will receive direct notifications as new bills and regulations move through Parliament and County Assemblies.
          </p>
          <button onClick={() => setSubscribed(false)} className="stance-btn" style={{ margin: '0 auto', display: 'inline-flex' }}>
            Manage Subscription
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '650px' }}>
      <div className="page-header" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="page-title">Subscribe to Legislative Alerts</h1>
        <p className="page-subtitle">
          Receive direct SMS alerts for transport sector bills and regulations.
        </p>
      </div>

      <div className="content-card" style={{ marginBottom: '3rem' }}>
        <form onSubmit={handleSubmit}>
          {/* Phone input */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Kenyan Phone Number</label>
            <input 
              type="tel"
              className="form-input"
              placeholder="+254 700 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="form-hint">E.164 format. Phone credentials are protected under the Kenya Data Protection Act (KDPA).</p>
          </div>

          {/* Language Selection */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Preferred Alert Language</label>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  name="language" 
                  value="en"
                  checked={language === 'en'}
                  onChange={() => setLanguage('en')}
                />
                <span>English</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  name="language" 
                  value="sw"
                  checked={language === 'sw'}
                  onChange={() => setLanguage('sw')}
                />
                <span>Swahili</span>
              </label>
            </div>
          </div>

          {/* Alert Channel */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Alert Channel</label>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'default', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={true}
                  readOnly
                />
                <span>SMS Alerts</span>
              </label>
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={consent}
                onChange={() => setConsent(!consent)}
                required
                style={{ marginTop: '0.15rem', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                I consent to KeLegislate processing my phone number to deliver legislative alerts in compliance with the Kenya Data Protection Act (KDPA) 2019.
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            className="btn-primary-purple" 
            disabled={submitting}
          >
            {submitting ? "Signing Up..." : "Confirm Subscription"}
          </button>
        </form>
      </div>
    </div>
  );
}
