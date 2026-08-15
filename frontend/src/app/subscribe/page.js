'use client';

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { formatE164, isValidKenyanPhone } from '../../lib/phone';

export default function SubscribePage() {
  // Subscribe form state
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('en');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [subscribeError, setSubscribeError] = useState(null);

  // Manage subscription state
  const [managePhone, setManagePhone] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [manageError, setManageError] = useState(null);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [unsubscribeSuccess, setUnsubscribeSuccess] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setSubscribeError(null);

    const formatted = formatE164(phone.trim());
    if (!isValidKenyanPhone(formatted)) {
      setSubscribeError('Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)');
      return;
    }

    if (!consent) {
      setSubscribeError('Consent is required under the Kenya Data Protection Act.');
      return;
    }

    try {
      setSubmitting(true);
      await api.subscribe(formatted, language, ['sms']);
      setSubscribeSuccess(true);
    } catch (err) {
      console.error('Subscription error:', err);
      setSubscribeError(err.message || 'Failed to register subscription. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    setManageError(null);
    setStatusResult(null);
    setUnsubscribeSuccess(false);

    const formatted = formatE164(managePhone.trim());
    if (!isValidKenyanPhone(formatted)) {
      setManageError('Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)');
      return;
    }

    try {
      setCheckingStatus(true);
      const res = await api.getSubscriptionStatus(formatted);
      setStatusResult(res);
    } catch (err) {
      console.error('Status lookup error:', err);
      setManageError(err.message || 'Failed to check subscription status.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleUnsubscribe = async () => {
    setManageError(null);
    const formatted = formatE164(managePhone.trim());
    if (!isValidKenyanPhone(formatted)) {
      setManageError('Please enter a valid Kenyan phone number.');
      return;
    }

    try {
      setUnsubscribing(true);
      await api.unsubscribe(formatted);
      setUnsubscribeSuccess(true);
      setStatusResult((prev) => (prev ? { ...prev, is_active: false } : null));
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setManageError(err.message || 'Failed to cancel subscription.');
    } finally {
      setUnsubscribing(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '650px' }}>
      <div className="page-header" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="page-title">Subscribe to Legislative Alerts</h1>
        <p className="page-subtitle">
          Receive direct SMS alerts for transport sector bills and regulations as they move through Parliament.
        </p>
      </div>

      {/* Subscription Signup Card */}
      <div className="content-card" style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          New SMS Alert Subscription
        </h2>

        {subscribeSuccess ? (
          <div style={{ padding: '1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ color: '#166534', fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Successfully Subscribed!
            </h3>
            <p style={{ color: '#15803d', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Your phone number ({formatE164(phone)}) has been registered for transport legislative alerts.
            </p>
            <p style={{ color: '#166534', fontSize: '0.825rem' }}>
              A confirmation SMS will be sent shortly to your mobile number via Africa's Talking.
            </p>
            <button
              type="button"
              className="btn-text"
              onClick={() => { setSubscribeSuccess(false); setPhone(''); }}
              style={{ marginTop: '1rem' }}
            >
              Subscribe another number
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubscribe}>
            {subscribeError && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {subscribeError}
              </div>
            )}

            {/* Phone input */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Kenyan Mobile Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="e.g. 0712345678 or +254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={submitting}
              />
              <p className="form-hint">E.164 format (+254XXXXXXXXX). Protected under Kenya Data Protection Act.</p>
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
                  <span>SMS Alerts (Africa's Talking)</span>
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
                  I consent to hustleyetu processing my phone number to deliver legislative alerts in compliance with the Kenya Data Protection Act (KDPA) 2019.
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
        )}
      </div>

      {/* Manage Existing Subscription Card */}
      <div className="content-card" style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Manage Subscription
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Check your active status or unsubscribe from SMS alerts at any time.
        </p>

        {manageError && (
          <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {manageError}
          </div>
        )}

        {unsubscribeSuccess && (
          <div style={{ padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Subscription successfully deactivated. You will no longer receive SMS alerts.
          </div>
        )}

        <form onSubmit={handleCheckStatus} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="tel"
              className="form-input"
              placeholder="e.g. 0712345678"
              value={managePhone}
              onChange={(e) => setManagePhone(e.target.value)}
              required
              style={{ flex: 1, minWidth: '200px' }}
            />
            <button
              type="submit"
              className="stance-btn"
              disabled={checkingStatus}
            >
              {checkingStatus ? "Checking..." : "Check Status"}
            </button>
          </div>
        </form>

        {statusResult && (
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Subscription Status:</span>
              <span className="badge-neutral" style={{ color: statusResult.is_active ? '#15803d' : '#991b1b', fontWeight: 700 }}>
                {statusResult.is_active ? 'Active' : 'Inactive / Unsubscribed'}
              </span>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Preferred Language: <strong>{statusResult.preferred_language?.toUpperCase() || 'EN'}</strong>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Channels: <strong>{statusResult.channels?.join(', ') || 'SMS'}</strong>
            </div>

            {statusResult.is_active && (
              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={unsubscribing}
                style={{
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {unsubscribing ? "Unsubscribing..." : "Unsubscribe from Alerts"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
