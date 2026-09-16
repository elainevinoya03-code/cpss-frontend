import React from 'react';

const Footer: React.FC = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col footer-col--brand">
            <svg className="footer-shield" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <rect x="4" y="13" width="28" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" fill="none"/>
              <path d="M14 6 L22 6 L24 10 L12 10 Z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <circle cx="18" cy="22" r="6" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <circle cx="18" cy="22" r="2.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.25"/>
              <circle cx="26" cy="18" r="1.5" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.3"/>
            </svg>
            <div>
              <span className="footer-name">CPSS</span>
              <p className="footer-desc">Community Policing &amp; Surveillance System — an integrated platform unifying incident reporting, live surveillance, patrol management, neighborhood watch coordination, and emergency alerts for safer communities.</p>
              <div className="footer-social">
                <a href="#" aria-label="Facebook">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M16 8h-2a2 2 0 0 0-2 2v10M12 14h4"/>
                  </svg>
                </a>
                <a href="#" aria-label="Twitter / X">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 8l8 8M16 8l-8 8"/>
                  </svg>
                </a>
                <a href="#" aria-label="Instagram">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="4"/>
                    <circle cx="12" cy="12" r="5"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                </a>
                <a href="#" aria-label="YouTube">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="10 8 16 12 10 16 10 8"/>
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Home</a></li>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About Us</a></li>
              <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}>Services</a></li>
              <li><a href="#initiatives" onClick={(e) => { e.preventDefault(); scrollToSection('initiatives'); }}>Initiatives</a></li>
              <li><a href="#mobile-app" onClick={(e) => { e.preventDefault(); scrollToSection('mobile-app'); }}>Mobile App</a></li>
              <li><a href="#resources" onClick={(e) => { e.preventDefault(); scrollToSection('resources'); }}>Resources</a></li>
              <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>Contact Us</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Useful Links</h4>
            <ul className="footer-links">
              <li><a href="#">Incident Reporting</a></li>
              <li><a href="#">CCTV Access</a></li>
              <li><a href="#">Patrol Schedule</a></li>
              <li><a href="#">Neighborhood Watch</a></li>
              <li><a href="#">Emergency Alerts</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Contact Us</h4>
            <ul className="footer-links footer-contact">
              <li><span className="contact-label">Address:</span> City Hall, 2nd Floor, Peace and Order Council Office</li>
              <li><span className="contact-label">Phone:</span> (02) 1234-5678</li>
              <li><span className="contact-label">Email:</span> cpss@lgu.gov.ph</li>
              <li><span className="contact-label">Hours:</span> Mon–Fri, 8:00 AM – 5:00 PM</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Community Policing &amp; Surveillance System. All rights reserved.</p>
          <div className="footer-bottom-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Use</a>
            <a href="#accessibility">Accessibility Statement</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;