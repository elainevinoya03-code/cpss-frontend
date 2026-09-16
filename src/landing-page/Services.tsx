import React from 'react';

interface Service {
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
}

const Services: React.FC = () => {
  const services: Service[] = [
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="6" width="32" height="36" rx="3"/>
          <line x1="16" y1="16" x2="32" y2="16"/>
          <line x1="16" y1="24" x2="28" y2="24"/>
          <line x1="16" y1="32" x2="24" y2="32"/>
          <circle cx="34" cy="34" r="8"/>
          <line x1="34" y1="30" x2="34" y2="38"/>
          <line x1="31" y1="34" x2="37" y2="34"/>
        </svg>
      ),
      title: "Community Incident Reporting Module",
      description: "Report crimes, suspicious activity, or safety concerns with photo and video evidence and track status in real time.",
      link: "REPORT NOW"
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
      title: "CCTV and Surveillance Integration Module",
      description: "Access integrated live and recorded surveillance feeds from public cameras for real-time monitoring.",
      link: "VIEW FEEDS"
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 44 L8 28 L24 16 L40 28 L40 44"/>
          <rect x="18" y="28" width="12" height="16"/>
          <circle cx="24" cy="22" r="6"/>
          <circle cx="24" cy="22" r="2" fill="currentColor" opacity="0.2" stroke="none"/>
        </svg>
      ),
      title: "Patrol Scheduling and Monitoring Module",
      description: "Manage and track patrol officer schedules, routes, and real-time location data efficiently.",
      link: "VIEW SCHEDULE"
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="14" r="6"/>
          <path d="M6 42 C6 32 12 24 24 24 C36 24 42 32 42 42"/>
        </svg>
      ),
      title: "Neighborhood Watch Coordination Module",
      description: "Connect volunteer watch groups with local police for coordinated patrols and alerts.",
      link: "JOIN WATCH"
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 4 L4 40 L44 40 Z"/>
          <line x1="24" y1="18" x2="24" y2="28"/>
          <line x1="24" y1="34" x2="24" y2="36"/>
        </svg>
      ),
      title: "Security Alert System Module",
      description: "Receive instant emergency notifications and broadcast alerts for your area immediately.",
      link: "VIEW ALERTS"
    },
    {
      icon: (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="10" r="3"/>
          <path d="M24 16 L24 28"/>
          <path d="M24 32 L24 34"/>
          <path d="M10 24 C10 12 16 6 24 6 C32 6 38 12 38 24"/>
          <path d="M6 24 C6 8 14 2 24 2 C34 2 42 8 42 24"/>
          <line x1="6" y1="24" x2="4" y2="24"/>
          <line x1="42" y1="24" x2="44" y2="24"/>
          <path d="M8 20 L6 18"/>
          <path d="M40 20 L42 18"/>
          <circle cx="14" cy="24" r="2" fill="currentColor" opacity="0.2" stroke="none"/>
          <circle cx="34" cy="24" r="2" fill="currentColor" opacity="0.2" stroke="none"/>
          <path d="M20 28 L20 30" strokeWidth="1.2"/>
          <path d="M28 28 L28 30" strokeWidth="1.2"/>
          <rect x="10" y="34" width="28" height="4" rx="1"/>
          <rect x="14" y="38" width="20" height="8" rx="1"/>
          <line x1="18" y1="42" x2="18" y2="46"/>
          <line x1="30" y1="42" x2="30" y2="46"/>
          <line x1="14" y1="46" x2="34" y2="46"/>
        </svg>
      ),
      title: "IoT Smoke &amp; Noise Detection and Automated Emergency Alerts",
      description: "Smart IoT sensors detect smoke, excessive noise, and environmental hazards — triggering automated emergency alerts to authorities and residents in real time.",
      link: "LEARN MORE"
    }
  ];

  return (
    <section className="services" id="services" aria-labelledby="services-title">
      <div className="container reveal">
        <div className="section-header">
          <span className="eyebrow">OUR SERVICES</span>
          <h2 className="section-heading" id="services-title">How Can We Help You?</h2>
        </div>
        <div className="services-grid stagger-children">
          {services.map((service, index) => (
            <article className="service-card" key={index}>
              <div className="service-icon">
                {service.icon}
              </div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-desc">{service.description}</p>
              <a href="#" className="service-link">{service.link} <span aria-hidden="true">→</span></a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;