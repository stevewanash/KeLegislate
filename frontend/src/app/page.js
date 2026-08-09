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
          Know the <span className="gradient-text">Shillings & Cents</span> Impact Before It Hits Your Hustle
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#cbd5e1', maxWidth: '600px', margin: '0 auto' }}>
          KeLegislate alerts bodaboda riders and transport micro-enterprises about how new bills and regulations affect your pocket—delivering financial impact analysis, regulatory compliance advice, and SMS alerts in plain language.
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
          <h3 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>2</h3>
          <h4 style={{ marginBottom: '0.5rem' }}>Bills Analyzed</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Finance Bill 2024 and Bodaboda Permit Regulations 2025 — your most urgent legislation.</p>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>💰 + 📋</h3>
          <h4 style={{ marginBottom: '0.5rem' }}>Financial & Compliance</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Get both tax impact analysis and regulatory compliance checklists for your bodaboda business.</p>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', color: 'var(--success)', marginBottom: '0.5rem' }}>🏍️</h3>
          <h4 style={{ marginBottom: '0.5rem' }}>Built for BodaBoda</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Tailored for motorcycle taxi operators — know your permits, taxes, and compliance deadlines.</p>
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
            New tax bills and county regulations directly affect how much you pay, what permits you need, and whether your bodaboda business stays compliant.
          </p>
          <p style={{ color: '#cbd5e1' }}>
            We analyze bills with AI, cross-verify numbers, and give you a clear breakdown of financial impact and compliance requirements — in plain Swahili and English.
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
              <h4 style={{ marginBottom: '0.25rem' }}>Regulatory Compliance Advice</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Get a clear checklist of permits, deadlines, and requirements — know what you need before enforcement begins.</p>
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
