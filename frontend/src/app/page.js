export default function Home() {
  return (
    <div className="container animate-fade-in">
      {/* Hero Section */}
      <section style={{ 
        textAlign: 'center', 
        padding: '4rem 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        <h1 style={{ fontSize: '3.5rem', lineHeight: 1.1, maxWidth: '800px', margin: '0 auto' }}>
          Know the <span className="gradient-text">Shillings & Cents</span> Impact of Proposed Laws
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#cbd5e1', maxWidth: '600px', margin: '0 auto' }}>
          KeLegislate matches new legislative bills to your specific hustle—translating complex legalese into clear financial impacts and delivering SMS alerts straight to your phone.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <a href="/bills" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Browse Analyzed Bills
          </a>
          <a href="/subscribe" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Get SMS Alerts
          </a>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '2rem', 
        margin: '4rem 0' 
      }}>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>14</h3>
          <h4 style={{ marginBottom: '0.5rem' }}>Bills Monitored</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Scraped and extracted directly from the parliament.go.ke website.</p>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>3,450</h3>
          <h4 style={{ marginBottom: '0.5rem' }}>Alerts Dispatched</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Helping BodaBodas, Mama Mbogas, and Content Creators stay ahead.</p>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--success)', marginBottom: '0.5rem' }}>92%</h3>
          <h4 style={{ marginBottom: '0.5rem' }}>Citizen Stance Concordance</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Feedback aggregated to represent the actual consensus of informal workers.</p>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="glass-card" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '3rem',
        padding: '3rem',
        marginTop: '2rem'
      }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>
            Why KeLegislate?
          </h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1.25rem' }}>
            Legislative proposals contain complicated legal definitions and tax adjustments that directly affect your business expenses, daily revenues, and compliance risk.
          </p>
          <p style={{ color: '#cbd5e1' }}>
            We scan bills, parse metrics using Gemini, cross-verify numbers, and explain the financial reality to you in plain Swahili and English.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>✦</span>
            <div>
              <h4 style={{ marginBottom: '0.25rem' }}>Agentic AI Verification</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Checks Gemini summaries against deterministic regex values to block AI hallucinations.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>✦</span>
            <div>
              <h4 style={{ marginBottom: '0.25rem' }}>Predefined & Custom Profiles</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Simulate tax models for standard hustle tiers, or save your exact metrics securely.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>✦</span>
            <div>
              <h4 style={{ marginBottom: '0.25rem' }}>KDPA Compliant Privacy</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Phone numbers are encrypted via Supabase Vault; business data remains confidential.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
