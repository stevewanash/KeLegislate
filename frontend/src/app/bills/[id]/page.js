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
    ai_summary_en: "The Finance Bill, 2024 proposes significant taxation and fiscal adjustments aimed at revenue mobilization. For transport and mobility operators, key proposals include introducing an annual motor vehicle circulation tax calculated at 2.5% of the vehicle's declared value (with a minimum statutory cap of KES 5,000), revisions to fuel levy tariffs, and adjusted withholding tax thresholds for micro-enterprises.\n\nThe legislation also updates excise duties and introduces standardized electronic invoicing requirements. These provisions collectively alter operating overheads, fleet licensing costs, and daily cash-flow requirements for commercial transport service providers across Kenya.",
    ai_summary_sw: "Mswada wa Fedha, 2024 unapendekeza mabadiliko makubwa ya kodi na fedha yenye lengo la kuongeza mapato ya serikali. Kwa waendeshaji wa sekta ya usafirishaji, mapendekezo makuu ni pamoja na kuanzishwa kwa ushuru wa kila mwaka wa mzunguko wa magari uliopangwa kwa asilimia 2.5 ya thamani ya chombo (huku kima cha chini kikiwa KES 5,000), marekebisho ya tozo za mafuta, na viwango vya kodi ya zuio kwa biashara ndogo ndogo.\n\nSheria hii pia inasasisha ushuru wa bidhaa na kuanzisha mfumo wa ankara za kielektroniki. Vifungu hivi kwa pamoja vinabadilisha gharama za uendeshaji, ada za leseni, na mzunguko wa pesa wa kila siku kwa wahudumu wa usafiri nchini Kenya.",
    tags: ["Transport & Logistics", "Finance & Mobile Money"]
  },
  "nairobi-bodaboda-regulations-2025": {
    id: "nairobi-bodaboda-regulations-2025",
    title: "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025",
    bill_type: "regulatory",
    created_at: "2026-08-05T00:00:00Z",
    source_url: "https://nairobi.go.ke/gazette/bodaboda-regulations-2025.pdf",
    ai_summary_en: "These county regulations mandate annual county operating permits for all commercial motorcycle taxi operators in Nairobi County. They enforce designated SACCO registration, biometric rider badge identification, two standard reflective helmets, and designated CBD pick-and-drop zones.\n\nFailure to comply with operating permits or safety specifications attracts county fines of up to KES 10,000 or vehicle impoundment.",
    ai_summary_sw: "Kanuni hizi za kaunti zinalazimisha vibali vya uendeshaji vya kila mwaka vya kaunti kwa waendeshaji wote wa bodaboda za kibiashara katika Kaunti ya Nairobi. Zinasisitiza usajili wa SACCO maalum, vitambulisho vya kibiometria vya waendeshaji, kofia mbili za usalama zenye viakisi, na maeneo maalum ya kushusha na kupakia mjini CBD.\n\nKukosa kufuata kanuni za vibali au viwango vya usalama kunaweza kupelekea faini ya hadi KES 10,000 au kuzuiliwa kwa chombo.",
    tags: ["Transport & Logistics"]
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [stance, setStance] = useState('support');
  const [rating, setRating] = useState(5);
  const [concerns, setConcerns] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackInfo, setFeedbackInfo] = useState('');
  const [feedbackError, setFeedbackError] = useState(null);

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
    setFeedbackInfo('');

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
      await supabase.auth.signOut().catch(() => {});
    } catch (err) {
      console.error('Feedback error:', err);
      if (err.message && (err.message.includes('already submitted') || err.message.includes('409'))) {
        setFeedbackInfo("You've already submitted feedback for this bill.");
      } else {
        setFeedbackError(err.message || 'Failed to submit feedback');
      }
      await supabase.auth.signOut().catch(() => {});
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const onAuthSuccess = async (session) => {
    if (session?.access_token) {
      try {
        setSubmittingFeedback(true);
        setFeedbackError(null);
        setFeedbackInfo('');
        await api.submitFeedback(billId, stance, rating, concerns, session.access_token);
        setFeedbackSuccess(true);
        await supabase.auth.signOut().catch(() => {});
      } catch (err) {
        if (err.message && (err.message.includes('already submitted') || err.message.includes('409'))) {
          setFeedbackInfo("You've already submitted feedback for this bill.");
        } else {
          setFeedbackError(err.message || 'Failed to submit feedback');
        }
        await supabase.auth.signOut().catch(() => {});
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
    <div className="container animate-fade-in">
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

            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.7', marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
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
            ) : feedbackInfo ? (
              <div style={{ padding: '1.25rem', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#1e40af', fontWeight: 600, fontSize: '0.95rem' }}>
                  ℹ️ {feedbackInfo}
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
