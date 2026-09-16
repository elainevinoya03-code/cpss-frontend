import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="hero" id="hero" aria-label="Hero section">
      <div className="hero-inner">
        <div className="hero-content">
          <div className="hero-container">
            <span className="eyebrow">TOGETHER FOR A SAFER COMMUNITY</span>
            <h1 className="hero-title">Community Policing<br />&amp; Surveillance System</h1>
            <p className="hero-text">Building a safer tomorrow through community partnership, smart surveillance and responsive policing.</p>
            <div className="hero-actions">
              <a href="#" className="btn btn-primary">
                REPORT AN ISSUE 
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="8" cy="8" r="3"/>
                  <line x1="8" y1="1" x2="8" y2="4"/>
                  <line x1="8" y1="12" x2="8" y2="15"/>
                  <line x1="1" y1="8" x2="4" y2="8"/>
                  <line x1="12" y1="8" x2="15" y2="8"/>
                </svg>
              </a>
              <a href="#about" className="btn btn-outline">
                KNOW MORE 
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4.5L6 7.5L9 4.5"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true" style={{ background: 'linear-gradient(135deg, #4A1515 0%, #6B1F1F 50%, #5C1A1A 100%)' }}></div>
      </div>
    </section>
  );
};

export default Hero;