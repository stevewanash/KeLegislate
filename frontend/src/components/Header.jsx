'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase, signOutUser } from '../lib/supabase';
import AuthModal from './AuthModal';

export default function Header() {
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pathname = usePathname();

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

  const handleLogout = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const formatUserPhone = (phone) => {
    if (!phone) return 'Account';
    let cleaned = phone;
    if (cleaned.startsWith('+254')) {
      cleaned = `0${cleaned.slice(4)}`;
    }
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 4)}***${cleaned.slice(-3)}`;
    }
    return cleaned;
  };

  return (
    <>
      <header className="app-header">
        <div className="container app-header-inner">
          <a href="/" className="brand-logo" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              KeLegislate
            </span>
          </a>

          <nav className="nav-menu">
            <a href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Home
            </a>
            <a href="/bills" className={`nav-link ${pathname?.startsWith('/bills') ? 'active' : ''}`}>
              Browse Bills
            </a>
            <a href="/subscribe" className={`nav-link ${pathname === '/subscribe' ? 'active' : ''}`}>
              Subscribe
            </a>
            <a href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </a>
          </nav>

          <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user ? (
              <div className="user-profile-pill">
                <span>{formatUserPhone(user.phone)}</span>
                <button 
                  className="logout-icon-btn" 
                  onClick={handleLogout} 
                  title="Log out"
                  aria-label="Log out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                className="login-nav-btn" 
                type="button"
                onClick={() => setAuthModalOpen(true)}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(session) => setUser(session?.user || null)}
      />
    </>
  );
}
