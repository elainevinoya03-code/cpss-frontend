import React from 'react';

const MobileApp: React.FC = () => {
  return (
    <section className="app-download" id="mobile-app" aria-labelledby="app-title">
      <div className="container">
        <div className="app-grid">
          <div className="app-content reveal-left">
            <span className="eyebrow">GET THE APP</span>
            <h2 className="section-heading" id="app-title">CPSS Mobile App</h2>
            <p className="app-text">Report incidents, receive emergency alerts, track patrols, and stay connected with your community — all from the palm of your hand. Available on iOS and Android.</p>
            <div className="app-badges">
              <a href="#" className="app-badge" aria-label="Download on the App Store">
                <svg viewBox="0 0 120 40" fill="none">
                  <rect width="120" height="40" rx="6" fill="#000"/>
                  <text x="12" y="16" fontSize="4" fill="#fff" fontFamily="sans-serif" fontWeight="600">App Store</text>
                  <text x="12" y="28" fontSize="7" fill="#fff" fontFamily="sans-serif" fontWeight="700">Download on the</text>
                </svg>
              </a>
              <a href="#" className="app-badge" aria-label="Get it on Google Play">
                <svg viewBox="0 0 120 40" fill="none">
                  <rect width="120" height="40" rx="6" fill="#000"/>
                  <text x="12" y="16" fontSize="4" fill="#fff" fontFamily="sans-serif" fontWeight="600">Google Play</text>
                  <text x="12" y="28" fontSize="7" fill="#fff" fontFamily="sans-serif" fontWeight="700">Get it on</text>
                </svg>
              </a>
            </div>
            <ul className="app-features">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Real-time incident reporting with media
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Push notifications for emergency alerts
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Live patrol tracking and GPS navigation
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                CCTV live view on-the-go
              </li>
            </ul>
          </div>
          <div className="app-visual reveal-right" aria-hidden="true">
            <div className="app-mockup">
              <svg viewBox="0 0 240 480" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="8" y="4" width="224" height="472" rx="24" fill="var(--cream)" stroke="var(--border-light)"/>
                <rect x="96" y="12" width="48" height="6" rx="3" fill="#aaa"/>
                <rect x="20" y="28" width="200" height="44" rx="6" fill="var(--primary)"/>
                <text x="34" y="52" fontSize="5" fill="#fff" fontFamily="sans-serif" fontWeight="600">CPSS</text>
                <text x="34" y="60" fontSize="3.5" fill="rgba(255,255,255,0.7)" fontFamily="sans-serif">Safe Community</text>
                <circle cx="200" cy="50" r="8" fill="rgba(255,255,255,0.2)"/>
                <rect x="20" y="84" width="200" height="100" rx="6" fill="#eee"/>
                <circle cx="120" cy="134" r="20" fill="rgba(92,26,26,0.1)" stroke="var(--primary)" strokeWidth="1.5"/>
                <text x="108" y="138" fontSize="4" fill="var(--primary)" fontFamily="sans-serif" fontWeight="600">CAM</text>
                <rect x="20" y="196" width="96" height="48" rx="6" fill="rgba(92,26,26,0.06)" stroke="var(--border-light)" strokeWidth="1"/>
                <text x="30" y="214" fontSize="4" fill="var(--primary)" fontFamily="sans-serif" fontWeight="600">Report</text>
                <text x="30" y="224" fontSize="3" fill="#888" fontFamily="sans-serif">Submit incident</text>
                <rect x="124" y="196" width="96" height="48" rx="6" fill="rgba(92,26,26,0.06)" stroke="var(--border-light)" strokeWidth="1"/>
                <text x="134" y="214" fontSize="4" fill="var(--primary)" fontFamily="sans-serif" fontWeight="600">Alerts</text>
                <text x="134" y="224" fontSize="3" fill="#888" fontFamily="sans-serif">Emergency</text>
                <rect x="20" y="256" width="200" height="120" rx="6" fill="#fafafa" stroke="var(--border-light)" strokeWidth="1"/>
                <text x="34" y="276" fontSize="4" fill="var(--primary)" fontFamily="sans-serif" fontWeight="600">Recent Updates</text>
                <rect x="34" y="286" width="172" height="20" rx="3" fill="#eee"/>
                <rect x="34" y="312" width="172" height="20" rx="3" fill="#eee"/>
                <rect x="34" y="338" width="172" height="20" rx="3" fill="#eee"/>
                <rect x="20" y="390" width="200" height="40" rx="20" fill="var(--primary)"/>
                <text x="80" y="414" fontSize="5" fill="#fff" fontFamily="sans-serif" fontWeight="600">REPORT NOW</text>
                <rect x="80" y="440" width="80" height="4" rx="2" fill="#ddd"/>
                <rect x="110" y="444" width="20" height="2" rx="1" fill="var(--primary)"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileApp;