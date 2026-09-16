import React from 'react';

const About: React.FC = () => {
  return (
    <section className="about" id="about" aria-labelledby="about-title">
      <div className="container">
        <div className="about-grid">
          <div className="about-content reveal-left">
            <span className="eyebrow">ABOUT US</span>
            <h2 className="section-heading" id="about-title">Building a Safer Community Through Partnership</h2>
            <p className="about-text">Our system unifies incident reporting, live surveillance, patrol management, neighborhood watch coordination, and emergency alerts into a single platform. Designed for local government units, CPSS empowers communities and authorities to work together for a safer environment.</p>
            <p className="about-text">With real-time data sharing and integrated communication tools, CPSS ensures that every stakeholder has the information they need to respond effectively and keep our community safe.</p>
            <a href="#services" className="btn btn-outline btn-maroon">LEARN MORE ABOUT US <span aria-hidden="true">→</span></a>
          </div>
          <div className="about-visual reveal-right" aria-hidden="true">
            <div className="about-image-placeholder">
              <img src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80" alt="Police officer engaging with community members" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;