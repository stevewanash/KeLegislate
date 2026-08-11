'use client';

import React, { useState, useEffect } from 'react';
import { supabase, signOutUser } from '../lib/supabase';
import AuthModal from './AuthModal';

export default function Header() {
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [lang, setLang] = useState('EN');

  useEffect(() => {
    // Check initial auth session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null);
    });

    // Listen for auth state changes
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
          <a href="/" className="brand-logo">
            <span className="brand-icon">⚡</span>
            <span>Hustle Yetu</span>
          </a>

          <div className="header-controls">
            <div className="lang-toggle" role="group" aria-label="Language selection">
              <button 
                className={`lang-btn ${lang === 'EN' ? 'active' : ''}`} 
                type="button"
                onClick={() => setLang('EN')}
              >
                EN
              </button>
              <button 
                className={`lang-btn ${lang === 'SW' ? 'active' : ''}`} 
                type="button"
                onClick={() => setLang('SW')}
              >
                SW
              </button>
            </div>

            {user ? (
              <div className="user-profile-pill">
                <span>👤 {formatUserPhone(user.phone)}</span>
                <button 
                  className="logout-icon-btn" 
                  onClick={handleLogout} 
                  title="Log out"
                  aria-label="Log out"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button 
                className="login-nav-btn" 
                type="button"
                onClick={() => setAuthModalOpen(true)}
              >
                Log In
              </button>
            )}

            <button className="notification-bell" type="button" aria-label="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span className="notification-badge">4</span>
            </button>
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
