import React from 'react';

interface Initiative {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const Initiatives: React.FC = () => {
  const initiatives: Initiative[] = [
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="14" r="6"/>
          <path d="M6 42 C6 32 12 24 24 24 C36 24 42 32 42 42"/>
        </svg>
      ),
      title: "Community Watch Program",
      description: "Empowering residents to actively participate in neighborhood safety through organized patrols and reporting networks."
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="32" height="32" rx="4"/>
          <path d="M16 24 L22 30 L32 18"/>
        </svg>
      ),
      title: "School Safety Initiative",
      description: "Partnering with educational institutions to ensure safe learning environments through surveillance and rapid response."
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 32 L16 40 L40 14"/>
          <circle cx="12" cy="10" r="4"/>
          <circle cx="38" cy="38" r="4"/>
        </svg>
      ),
      title: "Emergency Response Network",
      description: "A coordinated network of first responders, barangay officials, and volunteers for rapid emergency deployment."
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="14" r="5"/>
          <path d="M14 24 C14 18 18 14 24 14 C30 14 34 18 34 24"/>
          <path d="M10 24 C10 14 16 8 24 8 C32 8 38 14 38 24"/>
          <line x1="24" y1="28" x2="24" y2="34"/>
          <line x1="20" y1="40" x2="28" y2="40"/>
          <rect x="16" y="34" width="16" height="6" rx="1"/>
          <circle cx="8" cy="24" r="2" fill="currentColor" opacity="0.2" stroke="none"/>
          <circle cx="40" cy="24" r="2" fill="currentColor" opacity="0.2" stroke="none"/>
          <path d="M12 26 L14 26" strokeWidth="1.2"/>
          <path d="M34 26 L36 26" strokeWidth="1.2"/>
          <path d="M16 42 L32 42"/>
        </svg>
      ),
      title: "IoT Smoke &amp; Noise Detection",
      description: "Smart sensors detect smoke, excessive noise levels, and environmental hazards — automatically triggering alerts to authorities for rapid response."
    }
  ];

  return (
    <section className="initiatives" id="initiatives" aria-labelledby="initiatives-title">
      <div className="container reveal">
        <div className="section-header">
          <span className="eyebrow">OUR INITIATIVES</span>
          <h2 className="section-heading" id="initiatives-title">Community Programs for Safety</h2>
        </div>
        <div className="initiatives-grid stagger-children">
          {initiatives.map((initiative, index) => (
            <article className="initiative-card" key={index}>
              <div className="initiative-card-inner">
                <div className="initiative-icon">
                  {initiative.icon}
                </div>
                <h3 className="initiative-title">{initiative.title}</h3>
                <p className="initiative-desc">{initiative.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Initiatives;