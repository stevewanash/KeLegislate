import '../styles/globals.css';

export const metadata = {
  title: 'KeLegislate — Civic Action Platform',
  description: 'Proactive alerts and financial impact analysis of proposed Kenyan bills for informal sector workers.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* Header Navigation */}
          <header style={{ 
            borderBottom: '1px solid var(--border-color)', 
            padding: '1.25rem 2rem', 
            background: 'rgba(10, 13, 22, 0.8)',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}>
              <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="gradient-text" style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
                  KeLegislate
                </span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fcd34d', padding: '0.15rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Buildathon
                </span>
              </a>

              <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <a href="/bills" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', transition: 'color 0.2s' }}>Bills</a>
                <a href="/dashboard" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', transition: 'color 0.2s' }}>Insights Dashboard</a>
                <a href="/subscribe" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', transition: 'color 0.2s' }}>Alerts Sign-Up</a>
                <a href="/profile" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', transition: 'color 0.2s' }}>Business Profile</a>
              </nav>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                  Demo Bypass Active
                </div>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  Sign In
                </button>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main style={{ flex: '1 0 auto', padding: '3rem 0' }}>
            {children}
          </main>

          {/* Footer */}
          <footer style={{ 
            borderTop: '1px solid var(--border-color)', 
            padding: '2rem', 
            textAlign: 'center',
            fontSize: '0.85rem',
            color: '#64748b',
            background: 'rgba(10, 13, 22, 0.5)'
          }}>
            <div className="container">
              <p>© 2026 KeLegislate. Built for the 8-Week Buildathon. Empowering the informal sector through financial transparency.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
