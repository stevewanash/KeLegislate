'use client';

import { useState, useEffect, useRef } from 'react';

const HERO_SLIDES = [
  {
    headline: "Know the Financial & Regulatory Impact of Bills Before They Hit Your Hustle",
    imageSrc: "/hero-slide-1.jpg",
    fallbackBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)"
  },
  {
    headline: "Real-time analysis of national tax laws and county transport regulations.",
    imageSrc: "/hero-slide-2.jpg",
    fallbackBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)"
  }
];

const FEATURES = [
  {
    title: "Plain Language Legislation Summaries",
    description: "Translates complex legal jargon and parliamentary text into clear English and Swahili summaries so you understand what is being proposed."
  },
  {
    title: "Regulatory Compliance Checklist",
    description: "Provides clear, actionable compliance requirements covering county operating permit rules, safety gear specs, and licensing deadlines."
  },
  {
    title: "Instant SMS Alerts",
    description: "Receive direct SMS notifications in English or Swahili as bills move through parliament. Phone credentials strictly protected under KDPA."
  }
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const featureTrackRef = useRef(null);
  const isInteractingRef = useRef(false);

  // 3D Cube Auto-Rotate effect (5 seconds)
  useEffect(() => {
    const heroTimer = setInterval(() => {
      if (isInteractingRef.current) return;
      setCurrentSlide((prev) => (prev === 0 ? 1 : 0));
    }, 5000);

    return () => clearInterval(heroTimer);
  }, []);

  // Features carousel auto-scroll (4 seconds)
  useEffect(() => {
    const featureTimer = setInterval(() => {
      if (isInteractingRef.current) return;

      setActiveFeatureIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % FEATURES.length;
        scrollToFeatureCard(nextIndex);
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(featureTimer);
  }, []);

  const scrollToFeatureCard = (index) => {
    if (!featureTrackRef.current) return;
    const track = featureTrackRef.current;
    const cardElement = track.children[index];
    if (cardElement) {
      const targetLeft = cardElement.offsetLeft - (track.clientWidth - cardElement.clientWidth) / 2;
      track.scrollTo({
        left: targetLeft,
        behavior: 'smooth'
      });
    }
  };

  const handleFeatureDotClick = (index) => {
    setActiveFeatureIndex(index);
    scrollToFeatureCard(index);
  };

  const handleFeatureScroll = () => {
    if (!featureTrackRef.current) return;
    const track = featureTrackRef.current;
    const scrollPosition = track.scrollLeft + track.clientWidth / 2;

    let closestIndex = 0;
    let minDistance = Infinity;

    Array.from(track.children).forEach((child, index) => {
      const cardCenter = child.offsetLeft + child.clientWidth / 2;
      const distance = Math.abs(scrollPosition - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== activeFeatureIndex) {
      setActiveFeatureIndex(closestIndex);
    }
  };

  return (
    <div className="container animate-fade-in">
      {/* 3D Cube Rolling Hero Section (Background Images) */}
      <section 
        className="cube-viewport"
        onMouseEnter={() => { isInteractingRef.current = true; }}
        onMouseLeave={() => { isInteractingRef.current = false; }}
        onTouchStart={() => { isInteractingRef.current = true; }}
        onTouchEnd={() => { isInteractingRef.current = false; }}
      >
        <div 
          className="cube-scene"
          style={{
            transform: currentSlide === 0 ? 'rotateY(0deg)' : 'rotateY(-180deg)'
          }}
        >
          {/* Face 1 */}
          <div className="cube-face cube-face-1">
            <div 
              className="hero-bg-card"
              style={{
                backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.8)), url('${HERO_SLIDES[0].imageSrc}'), ${HERO_SLIDES[0].fallbackBg}`
              }}
            >
              <h1 className="hero-bg-headline">
                {HERO_SLIDES[0].headline}
              </h1>
            </div>
          </div>

          {/* Face 2 */}
          <div className="cube-face cube-face-2">
            <div 
              className="hero-bg-card"
              style={{
                backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.8)), url('${HERO_SLIDES[1].imageSrc}'), ${HERO_SLIDES[1].fallbackBg}`
              }}
            >
              <h1 className="hero-bg-headline">
                {HERO_SLIDES[1].headline}
              </h1>
            </div>
          </div>
        </div>

        {/* 3D Cube Slide Dots / Face Toggle Controls */}
        <div className="cube-controls">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`carousel-dot ${currentSlide === idx ? 'active' : ''}`}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Show slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Static CTAs Below Hero Section */}
      <section style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2.5rem', 
        flexWrap: 'wrap', 
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <a 
          href="/bills" 
          className="btn-primary-purple" 
          style={{ width: 'auto', padding: '0.85rem 1.75rem' }}
        >
          Browse Analyzed Bills
        </a>
        <a 
          href="/subscribe" 
          className="btn-secondary-outline" 
          style={{ padding: '0.85rem 1.75rem' }}
        >
          Get SMS Alerts
        </a>
      </section>

      {/* Feature Highlights Section — Horizontal Auto-Scrolling Carousel */}
      <section style={{ 
        padding: '1.5rem 0 2rem 0',
        marginBottom: '3rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Built for Transport Operators
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '550px', margin: '0 auto' }}>
            National tax laws and county transport regulations directly impact your daily operating costs, permit requirements, and business compliance.
          </p>
        </div>

        {/* Carousel Track */}
        <div 
          ref={featureTrackRef}
          className="carousel-track"
          onScroll={handleFeatureScroll}
          onMouseEnter={() => { isInteractingRef.current = true; }}
          onMouseLeave={() => { isInteractingRef.current = false; }}
          onTouchStart={() => { isInteractingRef.current = true; }}
          onTouchEnd={() => { isInteractingRef.current = false; }}
        >
          {FEATURES.map((feature, idx) => (
            <div key={idx} className="carousel-card-item">
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.65rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Carousel Pagination Indicator Dots */}
        <div className="carousel-dots">
          {FEATURES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`carousel-dot ${activeFeatureIndex === idx ? 'active' : ''}`}
              onClick={() => handleFeatureDotClick(idx)}
              aria-label={`Go to feature slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
