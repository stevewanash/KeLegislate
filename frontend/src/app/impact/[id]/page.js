'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AuthModal from '../../../components/AuthModal';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

export default function ImpactDetailPage() {
  const params = useParams();
  const billId = params?.id;

  const [impactData, setImpactData] = useState(null);
  const [billDetail, setBillDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Client-side calculator state
  const [customValue, setCustomValue] = useState(150000);
  const [calcResult, setCalcResult] = useState(null);

  // Feedback Form state
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [support, setSupport] = useState('support');
  const [rating, setRating] = useState(5);
  const [concerns, setConcerns] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!billId) return;

    async function loadData() {
      try {
        setLoading(true);
        const [impactRes, billRes] = await Promise.all([
          api.getImpact(billId).catch(() => null),
          api.getBill(billId).catch(() => null)
        ]);

        setImpactData(impactRes);
        setBillDetail(billRes);

        if (impactRes?.scenario_persona?.metrics?.vehicle_value) {
          setCustomValue(impactRes.scenario_persona.metrics.vehicle_value);
        }
      } catch (err) {
        console.error('Error loading impact detail:', err);
        setError(err.message || 'Failed to load impact details');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [billId]);

  // Client-side deterministic formula evaluation
  useEffect(() => {
    if (!impactData || impactData.bill_type === 'regulatory') return;

    const val = Number(customValue) || 0;
    const formula = impactData.calculator_formula || 'min(max(vehicle_value * 0.025, 5000), 100000)';

    let annualCost = 0;
    try {
      if (formula.includes('min') || formula.includes('max')) {
        const evalFn = new Function('vehicle_value', 'min', 'max', `return ${formula};`);
        annualCost = evalFn(val, Math.min, Math.max);
      } else {
        const evalFn = new Function('vehicle_value', `return ${formula};`);
        annualCost = evalFn(val);
      }
    } catch (e) {
      annualCost = val * 0.025;
      if (annualCost < 5000) annualCost = 5000;
      if (annualCost > 100000) annualCost = 100000;
    }

    setCalcResult({
      annual: Math.round(annualCost),
      monthly: Math.round(annualCost / 12)
    });
  }, [customValue, impactData]);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setFeedbackError(null);

    const sessionRes = await supabase.auth.getSession();
    const currentSession = sessionRes?.data?.session;

    if (!currentSession) {
      setAuthModalOpen(true);
      return;
    }

    try {
      setSubmittingFeedback(true);
      const token = currentSession.access_token;
      await api.submitFeedback(billId, support, rating, concerns, token);
      setFeedbackSuccess(true);
    } catch (err) {
      console.error('Feedback error:', err);
      setFeedbackError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const onAuthSuccess = async (session) => {
    setUser(session?.user || null);
    if (session?.access_token) {
      try {
        setSubmittingFeedback(true);
        await api.submitFeedback(billId, support, rating, concerns, session.access_token);
        setFeedbackSuccess(true);
      } catch (err) {
        setFeedbackError(err.message || 'Failed to submit feedback');
      } finally {
        setSubmittingFeedback(false);
      }
    }
  };

  const isFinancial = impactData?.bill_type !== 'regulatory';

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      {/* Back Link */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <a href="/impact" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
          &larr; Back to Legislative Impact Center
        </a>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <p>Loading pre-generated impact scenario...</p>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!loading && impactData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
          {/* Bill Metadata Header Card */}
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 700, flex: '1', minWidth: '260px', color: 'var(--text-primary)' }}>
                {impactData.bill_title || billDetail?.title || 'Legislative Document'}
              </h1>
              <span className="badge-neutral" style={{ textTransform: 'capitalize' }}>
                {isFinancial ? 'Financial' : 'Regulatory'}
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Risk Level: <strong>{impactData.risk_level || 'MEDIUM'}</strong>
            </p>

            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.65', marginBottom: '1.5rem' }}>
              {impactData.concise_summary || billDetail?.ai_summary_en}
            </p>

            {(impactData.pdf_url || billDetail?.source_url) && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <a
                  href={impactData.pdf_url || billDetail?.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  View Original Official Bill Document (PDF)
                </a>
              </div>
            )}
          </div>

          {/* FINANCIAL BILL: Worked Example Scenario + Client-Side Calculator */}
          {isFinancial && (
            <>
              {/* Worked Example Scenario Card */}
              <div className="content-card">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                  Worked Example Scenario
                </h3>

                <p style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                  {impactData.scenario_persona?.description || 'A boda boda rider operating a 150cc motorcycle valued at KES 150,000 for daily commercial transport services.'}
                </p>

                {/* Key Figures */}
                {impactData.key_figures && impactData.key_figures.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Key Policy Figures
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {impactData.key_figures.map((fig, idx) => (
                        <span key={idx} className="badge-neutral" style={{ fontWeight: 600 }}>
                          {fig}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step-by-Step Math Breakdown */}
                {impactData.math_breakdown && impactData.math_breakdown.length > 0 && (
                  <div>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Math Breakdown
                    </h4>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {impactData.math_breakdown.map((line, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Client-Side Interactive Calculator */}
              <div className="content-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Client-Side Interactive Calculator
                  </h3>
                  <span className="badge-neutral" style={{ fontSize: '0.75rem' }}>
                    Session-Only
                  </span>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  Calculate custom figures live in your browser (no server calls, no database persistence).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Input Motorcycle Value (KES):</label>
                    <input
                      type="number"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      step="10000"
                      min="10000"
                      style={{
                        width: '100%',
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Annual Impact</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', margin: '0.2rem 0' }}>
                      KES {calcResult?.annual ? calcResult.annual.toLocaleString() : 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ year</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>
                      ~ KES {calcResult?.monthly ? calcResult.monthly.toLocaleString() : 0} / month
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* REGULATORY BILL: Compliance Checklist */}
          {!isFinancial && (
            <div className="content-card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Compliance Checklist Guide
              </h3>

              {impactData.regulatory_changes && impactData.regulatory_changes.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Key Regulatory Changes
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {impactData.regulatory_changes.map((change, idx) => (
                      <li key={idx} style={{ marginBottom: '0.35rem' }}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

              {impactData.compliance_checklist && impactData.compliance_checklist.length > 0 && (
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Action Items
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {impactData.compliance_checklist.map((item, idx) => (
                      <div key={idx} style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                          {item.action}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <span>Deadline: <strong>{item.deadline || 'N/A'}</strong></span>
                          <span>Source: <strong>{item.source || 'N/A'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CITIZEN FEEDBACK FORM */}
          <div className="content-card">
            <h3 className="feedback-title" style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>
              Submit Citizen Stance & Feedback
            </h3>
            <p className="feedback-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Your stance is aggregated anonymously to reflect public opinion on this legislation.
            </p>

            {feedbackSuccess ? (
              <div style={{ padding: '1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#166534', fontWeight: 600, fontSize: '0.95rem' }}>
                  Thank you! Your feedback has been recorded.
                </p>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit}>
                {feedbackError && (
                  <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {feedbackError}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Do you support this bill?</label>
                  <div className="stance-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className={`stance-btn ${support === 'support' ? 'active' : ''}`}
                      onClick={() => setSupport('support')}
                    >
                      Support
                    </button>
                    <button
                      type="button"
                      className={`stance-btn ${support === 'oppose' ? 'active' : ''}`}
                      onClick={() => setSupport('oppose')}
                    >
                      Oppose
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Level of Support (1 to 10)</label>
                    <span className="slider-value" style={{ fontWeight: 700, color: 'var(--primary)' }}>{rating}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="range-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Comments or Concerns</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Share your feedback or specific concerns about this bill..."
                    value={concerns}
                    onChange={(e) => setConcerns(e.target.value)}
                    rows={3}
                  />
                </div>

                <button type="submit" className="btn-primary-purple">
                  Submit Feedback
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
}
