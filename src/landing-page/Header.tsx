import React, { useState } from 'react';

interface HeaderProps {
  scrollToSection?: (sectionId: string) => void;
  onNavigateToLogin?: () => void;
}

const Header: React.FC<HeaderProps> = ({ scrollToSection, onNavigateToLogin }) => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [fontSize, setFontSize] = useState('medium');

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    const root = document.documentElement;
    switch (size) {
      case 'small':
        root.style.fontSize = '14px';
        break;
      case 'medium':
        root.style.fontSize = '16px';
        break;
      case 'large':
        root.style.fontSize = '18px';
        break;
    }
  };

  const handleScrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsNavOpen(false);
    }
  };

  return (
    <>
      {/* Government Utility Bar */}
      <div className="gov-bar">
        <div className="container">
          <div className="gov-bar-inner">
            <div className="gov-bar-left">
              <svg className="gov-emblem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3" stroke="none"/>
              </svg>
              <span className="gov-text">GOVERNMENT OF THE PHILIPPINES</span>
            </div>
            <div className="gov-bar-right">
              <a href="#main-content" className="gov-skip">Skip to main content</a>
              <span className="gov-sep" aria-hidden="true">|</span>
              <span className="gov-font-size">
                <button 
                  type="button" 
                  className={`gov-font-btn ${fontSize === 'small' ? 'active' : ''}`} 
                  data-size="small" 
                  aria-label="Decrease font size"
                  onClick={() => handleFontSizeChange('small')}
                >
                  A−
                </button>
                <button 
                  type="button" 
                  className={`gov-font-btn ${fontSize === 'medium' ? 'active' : ''}`} 
                  data-size="medium" 
                  aria-label="Default font size"
                  onClick={() => handleFontSizeChange('medium')}
                >
                  A
                </button>
                <button 
                  type="button" 
                  className={`gov-font-btn ${fontSize === 'large' ? 'active' : ''}`} 
                  data-size="large" 
                  aria-label="Increase font size"
                  onClick={() => handleFontSizeChange('large')}
                >
                  A+
                </button>
              </span>
              <span className="gov-sep" aria-hidden="true">|</span>
              <span className="gov-lang">English <span aria-hidden="true">▾</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="site-header" role="banner">
        <div className="container">
          <div className="header-inner">
            <a href="#" className="header-brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <svg className="header-shield" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <rect x="4" y="13" width="28" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" fill="none"/>
                <path d="M14 6 L22 6 L24 10 L12 10 Z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                <circle cx="18" cy="22" r="6" stroke="currentColor" strokeWidth="1.4" fill="none"/>
                <circle cx="18" cy="22" r="2.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.25"/>
                <circle cx="26" cy="18" r="1.5" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.3"/>
              </svg>
              <div className="header-wordmark">
                <span className="header-wordmark-primary">COMMUNITY POLICING &amp; SURVEILLANCE SYSTEM</span>
                <span className="header-wordmark-secondary">CPSS</span>
              </div>
            </a>

            <nav className={`header-nav ${isNavOpen ? 'nav-open' : ''}`} id="headerNav" aria-label="Main navigation">
              <a href="#" className="active" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>HOME</a>
              <a href="#about" onClick={(e) => { e.preventDefault(); handleScrollToSection('about'); }}>ABOUT US</a>
              <a href="#services" onClick={(e) => { e.preventDefault(); handleScrollToSection('services'); }}>SERVICES</a>
              <a href="#initiatives" onClick={(e) => { e.preventDefault(); handleScrollToSection('initiatives'); }}>INITIATIVES</a>
              <a href="#resources" onClick={(e) => { e.preventDefault(); handleScrollToSection('resources'); }}>RESOURCES</a>
              <a href="#contact" onClick={(e) => { e.preventDefault(); handleScrollToSection('contact'); }}>CONTACT US</a>
              {onNavigateToLogin && (
                <button 
                  type="button"
                  className="header-login-btn"
                  onClick={() => {
                    onNavigateToLogin();
                    setIsNavOpen(false);
                  }}
                >
                  LOGIN
                </button>
              )}
              <a href="#" className="header-cta">REPORT AN ISSUE</a>
            </nav>
          </div>

          <button 
            className={`nav-toggle ${isNavOpen ? 'nav-open' : ''}`} 
            id="navToggle" 
            aria-label="Open menu" 
            aria-expanded={isNavOpen}
            onClick={toggleNav}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;