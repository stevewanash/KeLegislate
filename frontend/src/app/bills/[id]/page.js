'use client';

import { useState } from 'react';

export default function BillDetailPage({ params }) {
  const [lang, setLang] = useState('en');
  const [stance, setStance] = useState('');
  const [rating, setRating] = useState(5);
  const [concerns, setConcerns] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const billId = params.id;

  const mockBill = {
    title: billId === 'nairobi-bodaboda-regulations-2025'
      ? "Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025"
      : "The Finance Bill, 2024",
    date: "August 2026",
    bill_type: billId === 'nairobi-bodaboda-regulations-2025' ? "regulatory" : "financial",
    source_url: "https://parliament.go.ke/bills/finance-bill-2024.pdf",
    summary_en: "The bill introduces key provisions regulating motorcycle taxi operations and transport levies. It establishes mandatory annual county operating permit fees, designated SACCO membership requirements, standard safety helmet specifications, and enforcement schedules for transport micro-enterprises.",
    summary_sw: "Mswada huu unaleta vifungu muhimu vinavyodhibiti usafiri wa pikipiki (bodaboda) na ushuru wa usafiri. Unaweka ada za lazima za vibali vya kila mwaka vya kaunti, mahitaji ya kujiunga na SACCO rasmi, viwango vya kofia za usalama, na ratiba za utekelezaji kwa biashara ndogo za usafiri.",
    regex_extractions: [
      { type: "Levy Rate", value: "2.5%", context: "Annual vehicle circulation levy calculated at 2.5% of declared value." },
      { type: "Minimum Threshold", value: "KES 5,000", context: "Minimum annual permit registration charge of KES 5,000 per operator." }
    ]
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!stance) return;
    setSubmitted(true);
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      {/* Back Link */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <a href="/bills" className="back-link">
          ← Back to Browse Bills
        </a>
      </div>

      {/* Bill Metadata Header */}
      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, flex: '1', minWidth: '260px', color: 'var(--text-primary)' }}>
            {mockBill.title}
          </h1>
          <span className="badge-neutral" style={{ textTransform: 'capitalize' }}>
            {mockBill.bill_type}
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Published: {mockBill.date}
        </p>
      </div>

      {/* Bill Summary Card */}
      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Legislative Summary
          </h2>

          {/* Language Toggle for Summary Text */}
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
              style={{ 
                background: lang === 'sw' ? 'var(--primary)' : 'transparent',
                border: 'none', 
                color: lang === 'sw' ? 'white' : 'var(--text-muted)', 
                padding: '0.25rem 0.75rem', 
                borderRadius: '9999px', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                cursor: 'pointer'
              }}
            >
              Swahili
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.65', marginBottom: '1.5rem' }}>
          {lang === 'en' ? mockBill.summary_en : mockBill.summary_sw}
        </p>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <a 
            href={mockBill.source_url} 
            target="_blank" 
            rel="noreferrer" 
            style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
          >
            View Original Official Bill Document (PDF)
          </a>

          <a
            href={`/impact/${billId}`}
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

      {/* Key Extracted Metrics */}
      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Key Extracted Legal Provisions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {mockBill.regex_extractions.map((ext, idx) => (
            <div key={idx} style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span className="badge-neutral" style={{ fontSize: '0.7rem' }}>{ext.type}</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{ext.value}</strong>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{ext.context}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Form */}
      <div className="content-card" style={{ marginBottom: '3rem' }}>
        <h3 className="feedback-title" style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>
          Submit Citizen Stance & Feedback
        </h3>
        <p className="feedback-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Your stance is aggregated anonymously to reflect public opinion on this legislation.
        </p>

        {submitted ? (
          <div style={{ padding: '1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#166534', fontWeight: 600, fontSize: '0.95rem' }}>
              Thank you! Your feedback has been recorded.
            </p>
          </div>
        ) : (
          <form onSubmit={handleFeedbackSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Do you support this bill?</label>
              <div className="stance-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
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
  );
}
