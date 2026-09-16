import React from 'react';

interface Step {
  icon: React.ReactNode;
  num: string;
  title: string;
  description: string;
}

const HowItWorks: React.FC = () => {
  const steps: Step[] = [
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="6" width="32" height="36" rx="3"/>
          <line x1="16" y1="16" x2="32" y2="16"/>
          <line x1="16" y1="24" x2="28" y2="24"/>
          <circle cx="34" cy="34" r="8"/>
          <line x1="34" y1="30" x2="34" y2="38"/>
          <line x1="31" y1="34" x2="37" y2="34"/>
        </svg>
      ),
      num: "01",
      title: "Report",
      description: "Citizens report incidents via the web portal, mobile app, or hotline with photo and video evidence."
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="14" r="6"/>
          <path d="M6 42 C6 32 12 24 24 24 C36 24 42 32 42 42"/>
        </svg>
      ),
      num: "02",
      title: "Verify",
      description: "Authorities review and validate the report, cross-referencing with CCTV feeds and sensor data."
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="12" width="36" height="24" rx="3"/>
          <circle cx="24" cy="24" r="8"/>
          <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.2" stroke="none"/>
          <path d="M14 36 L18 42 L30 42 L34 36"/>
          <line x1="24" y1="12" x2="24" y2="4"/>
        </svg>
      ),
      num: "03",
      title: "Dispatch",
      description: "The nearest patrol unit or responder is dispatched with real-time route optimization and GPS tracking."
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 24 22 30 32 18"/>
          <path d="M24 4 L6 12 L6 22 C6 34 14 42 24 46 C34 42 42 34 42 22 L42 12 Z"/>
        </svg>
      ),
      num: "04",
      title: "Resolve",
      description: "The incident is resolved and the reporter receives a real-time status update and case summary."
    }
  ];

  return (
    <section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
      <div className="container reveal">
        <div className="section-header">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2 className="section-heading" id="how-title">From Report to Resolution</h2>
          <p className="how-subtitle">Our streamlined process ensures every concern is handled quickly and transparently.</p>
        </div>
        <div className="how-grid stagger-children">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className="how-step">
                <div className="how-step-icon">
                  {step.icon}
                </div>
                <span className="how-step-num">{step.num}</span>
                <h3 className="how-step-title">{step.title}</h3>
                <p className="how-step-desc">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="how-connector" aria-hidden="true">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 24 L42 24"/>
                    <polyline points="34 16 42 24 34 32"/>
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;