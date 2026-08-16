import '../styles/globals.css';
import Header from '../components/Header';

export const metadata = {
  title: 'Hustle Yetu — Civic Action & Impact Analysis Platform',
  description: 'Proactive alerts, financial impact modeling, and regulatory compliance guidance on Kenyan bills.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div className="app-shell">
          {/* Header Navigation */}
          <Header />

          {/* Main Content Area */}
          <main style={{ flex: '1 0 auto', padding: '1.25rem 0' }}>
            <div className="container">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

