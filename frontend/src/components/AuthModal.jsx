'use client';

import React, { useState } from 'react';
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/supabase';
import { formatE164, isValidKenyanPhone } from '../lib/phone';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const formatted = formatE164(phone.trim());
    if (!isValidKenyanPhone(formatted)) {
      setErrorMsg('Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)');
      return;
    }

    setLoading(true);
    try {
      await sendPhoneOtp(formatted);
      setPhone(formatted);
      setStep('otp');
      setInfoMsg(`OTP code sent via SMS to ${formatted}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!otp.trim() || otp.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit verification code sent to your phone.');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyPhoneOtp(phone, otp.trim());
      if (onSuccess) {
        onSuccess(data?.session);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired OTP code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('phone');
    setPhone('');
    setOtp('');
    setErrorMsg('');
    setInfoMsg('');
  };

  return (
    <div className="modal-backdrop" onClick={() => { resetForm(); onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button 
          className="modal-close-btn" 
          onClick={() => { resetForm(); onClose(); }}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="auth-modal-header">
          <div className="auth-modal-icon">📱</div>
          <h3>{step === 'phone' ? 'Log In / Sign Up' : 'Verify Phone Number'}</h3>
          <p className="auth-modal-subtitle">
            {step === 'phone'
              ? 'Enter your Kenyan mobile number to receive a secure OTP code.'
              : `Enter the 6-digit code sent to ${phone}`}
          </p>
        </div>

        {errorMsg && (
          <div className="auth-alert error-alert">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="auth-alert info-alert">
            <span>ℹ️ {infoMsg}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="auth-form">
            <div className="form-group">
              <label htmlFor="phone-input">Mobile Phone Number</label>
              <input
                id="phone-input"
                type="tel"
                className="form-control"
                placeholder="e.g. 0712345678 or +254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
              />
              <span className="form-hint">
                Demo test number: <code>+254111721222</code> (code: <code>123456</code>)
              </span>
            </div>

            <button type="submit" className="btn-primary-purple full-width" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send SMS Verification Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="auth-form">
            <div className="form-group">
              <label htmlFor="otp-input">6-Digit Verification Code</label>
              <input
                id="otp-input"
                type="text"
                className="form-control otp-control"
                placeholder="123456"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary-purple full-width" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Log In'}
            </button>

            <div className="auth-modal-footer">
              <button 
                type="button" 
                className="btn-text" 
                onClick={() => setStep('phone')}
                disabled={loading}
              >
                ← Change Phone Number
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
