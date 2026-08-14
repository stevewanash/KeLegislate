'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AuthModal from '../../../components/AuthModal';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

const DEMO_BILLS_FALLBACK = {
  "finance-bill-2024": {
    id: "finance-bill-2024",
    title: "The Finance Bill, 2024",
    bill_type: "financial",
    created_at: "2026-08-01T00:00:00Z",
    source_url: "https://parliament.go.ke/bills/finance-bill-2024.pdf",
    ai_summary_en: "The bill introduces key provisions regulating motorcycle taxi operations and transport levies. It establishes mandatory annual vehicle circulation levies calculated at 2.5% of declared value, designated SACCO membership requirements, standard safety helmet specifications, and withholding tax adjustments for transport micro-enterprises.",
    ai_summary_sw: "Mswada huu unaleta vifungu muhimu vinavyodhibiti usafiri wa pikipiki (bodaboda) na ushuru wa usafiri. Unaweka ada za lazima za ushuru wa kila mwaka wa asilimia 2.5 ya thamani ya chombo, mahitaji ya kujiunga na SACCO rasmi, viwango vya kofia za usalama, na marekebisho ya kodi ya zuio kwa biashara ndogo za usafiri.",
    tags: ["Transport & Logistics", "Finance & Mobile Money"],
    regex_extractions: [
      { type: "Levy Rate", value: "2.5%", context: "Annual vehicle circulation levy calculated at 2.5% of declared value." },
      { type: "Minimum Threshold", value: "KES 5,000", context: "Minimum annual circulation levy charge of KES 5,000 per operator." }
    ]
  },
  "nairobi-bodaboda-regulations-2025": {
    id: "nairobi-bodaboda-regulations-2025",
    title: "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025",
    bill_type: "regulatory",
    created_at: "2026-08-05T00:00:00Z",
    source_url: "https://nairobi.go.ke/gazette/bodaboda-regulations-2025.pdf",
    ai_summary_en: "These county regulations mandate annual county operating permits for all commercial motorcycle taxi operators in Nairobi County. They enforce designated SACCO registration, biometric rider badge identification, two standard reflective helmets, and designated CBD pick-and-drop zones.",
    ai_summary_sw: "Kanuni hizi za kaunti zinalazimisha vibali vya uendeshaji vya kila mwaka vya kaunti kwa waendeshaji wote wa bodaboda za kibiashara katika Kaunti ya Nairobi. Zinasisitiza usajili wa SACCO maalum, vitambulisho vya kibiometria vya waendeshaji, kofia mbili za usalama zenye viakisi, na maeneo maalum ya kushusha na kupakia mjini CBD.",
    tags: ["Transport & Logistics"],
    regex_extractions: [
      { type: "Permit Fee", value: "KES 3,000", context: "Annual county operating permit fee per commercial motorcycle." },
      { type: "Penalty Charge", value: "KES 10,000", context: "Fine for operating without a valid county permit or SACCO registration badge." }
    ]
  }
};

export default function BillDetailPage() {
  const params = useParams();
  const billId = params?.id;

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState('en');

  // Feedback form state
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [stance, setStance] = useState('support');
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

    async function loadBill() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getBill(billId);
        setBill(data);
      } catch (err) {
        console.warn(`Failed to fetch bill ${billId} from backend, checking demo fallback:`, err);
        if (DEMO_BILLS_FALLBACK[billId]) {
          setBill(DEMO_BILLS_FALLBACK[billId]);
        } else {
          setError(err.message || 'Bill not found');
        }
      } finally {
        setLoading(false);
      }
    }

    loadBill();
  }, [billId]);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setFeedbackError(null);

    if (!stance) {
      setFeedbackError('Please select your stance (Support, Oppose, or Neutral).');
      return;
    }

    const sessionRes = await supabase.auth.getSession();
    const currentSession = sessionRes?.data?.session;

    if (!currentSession) {
      setAuthModalOpen(true);
      return;
    }

    try {
      setSubmittingFeedback(true);
      const token = currentSession.access_token;
      await api.submitFeedback(billId, stance, rating, concerns, token);
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
        await api.submitFeedback(billId, stance, rating, concerns, session.access_token);
        setFeedbackSuccess(true);
      } catch (err) {
        setFeedbackError(err.message || 'Failed to submit feedback');
      } finally {
        setSubmittingFeedback(false);
      }
    }
  };

  const currentSummary = () => {
    if (!bill) return '';
    if (lang === 'sw') {
      return bill.ai_summary_sw || 'Muhtasari wa Kiswahili bado haujakamilika (Swahili translation is currently pending pipeline processing).';
    }
    return bill.ai_summary_en || 'Summary is currently being processed by the AI pipeline.';
  };

  const hasSwahili = Boolean(bill?.ai_summary_sw);

  const publishedDate = bill?.created_at
    ? new Date(bill.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'August 2026';

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      {/* Back Link */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <a href="/bills" className="back-link">
          &larr; Back to Browse Bills
        </a>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <p>Loading bill details...</p>
        </div>
      )}

      {error && !bill && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Unable to load bill</p>
          <p style={{ fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {!loading && bill && (
        <>
          {/* Bill Metadata Header */}
          <div className="content-card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 700, flex: '1', minWidth: '260px', color: 'var(--text-primary)' }}>
                {bill.title}
              </h1>
              <span className="badge-neutral" style={{ textTransform: 'capitalize' }}>
                {bill.bill_type || 'financial'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Published: {publishedDate}
            </p>
          </div>

          {/* Bill Summary Card */}
          <div className="content-card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Legislative Summary
              </h2>

              {/* Language Toggle */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '9999px', padding: '3px', border: '1px solid var(--border-color)' }}>
                <button 
                  type="button"
                  onClick={() => setLang('en')}
                  style={{ 
                    background: lang === 'en' ? 'var(--primary)' : 'transparent',
                    border: 'none', 
                    color: lang === 'en' ? 'white' : 'var(--text-muted)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    cursor: 'pointer'
                  }}
                >
                  English
                </button>
                <button 
                  type="button"
                  onClick={() => setLang('sw')}
                  title={!hasSwahili ? "Swahili translation pending pipeline processing" : "Swahili summary"}
                  style={{ 
                    background: lang === 'sw' ? 'var(--primary)' : 'transparent',
                    border: 'none', 
                    color: lang === 'sw' ? 'white' : (!hasSwahili ? '#94a3b8' : 'var(--text-muted)'), 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    cursor: 'pointer'
                  }}
                >
                  Swahili {!hasSwahili && <span style={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 500 }}>(Pending)</span>}
                </button>
              </div>
            </div>

            {lang === 'sw' && !hasSwahili && (
              <div style={{ background: '#f8fafc', borderLeft: '3px solid #f59e0b', padding: '0.75rem 1rem', borderRadius: '0 6px 6px 0', marginBottom: '1rem', fontSize: '0.875rem', color: '#b45309' }}>
                ℹ️ Swahili translation for this bill has not completed processing yet.
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.65', marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
              {currentSummary()}
            </p>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              {bill.source_url ? (
                <a 
                  href={bill.source_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  View Original Official Bill Document (PDF)
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Official PDF link pending gazettement</span>
              )}

              <a
                href={`/impact/${bill.id || billId}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textDecoration: 'none'
                }}
              >
                View Pre-Generated Impact & Calculator &rarr;
              </a>
            </div>
          </div>

          {/* Key Extracted Legal Provisions */}
          {bill.regex_extractions && Array.isArray(bill.regex_extractions) && bill.regex_extractions.length > 0 && (
            <div className="content-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Key Extracted Legal Provisions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {bill.regex_extractions.map((ext, idx) => (
                  <div key={idx} style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span className="badge-neutral" style={{ fontSize: '0.7rem' }}>{ext.type || ext.key || 'Provision'}</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{ext.value || ext.val}</strong>
                    </div>
                    {ext.context && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{ext.context}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citizen Feedback Form */}
          <div className="content-card" style={{ marginBottom: '3rem' }}>
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

                {/* Stance Buttons: Support / Oppose / Neutral */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Do you support this bill?</label>
                  <div className="stance-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button"
                      className={`stance-btn ${stance === 'support' ? 'active' : ''}`}
                      onClick={() => setStance('support')}
                    >
                      Support
                    </button>
                    <button 
                      type="button"
                      className={`stance-btn ${stance === 'oppose' ? 'active' : ''}`}
                      onClick={() => setStance('oppose')}
                    >
                      Oppose
                    </button>
                    <button 
                      type="button"
                      className={`stance-btn ${stance === 'neutral' ? 'active' : ''}`}
                      onClick={() => setStance('neutral')}
                    >
                      Neutral
                    </button>
                  </div>
                </div>

                {/* Level of Support (1 to 5) */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Level of Priority / Rating (1 to 5)</label>
                    <span className="slider-value" style={{ fontWeight: 700, color: 'var(--primary)' }}>{rating} / 5</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="range-input"
                  />
                </div>

                {/* Comments / Concerns */}
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

                <button 
                  type="submit" 
                  className="btn-primary-purple"
                  disabled={submittingFeedback}
                >
                  {submittingFeedback ? "Submitting Feedback..." : "Submit Feedback"}
                </button>
              </form>
            )}
          </div>
        </>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
}
