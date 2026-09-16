import React, { useState } from 'react';

interface Update {
  image: string;
  tag: string;
  tagClass: string;
  date: string;
  title: string;
}

const Updates: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const updates: Update[] = [
    {
      image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&q=80",
      tag: "Module Update",
      tagClass: "tag-module",
      date: "June 15, 2026",
      title: "New CCTV Cameras Added to Surveillance Network"
    },
    {
      image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=400&q=80",
      tag: "Feature Update",
      tagClass: "tag-feature",
      date: "June 10, 2026",
      title: "Patrol Scheduling Module Now Supports Real-Time GPS"
    },
    {
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80",
      tag: "Community News",
      tagClass: "tag-community",
      date: "June 5, 2026",
      title: "Neighborhood Watch Program Expands to 12 New Zones"
    },
    {
      image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=400&q=80",
      tag: "Community News",
      tagClass: "tag-community",
      date: "May 28, 2026",
      title: "40 New Officers Complete Community Policing Training"
    },
    {
      image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=400&q=80",
      tag: "Module Update",
      tagClass: "tag-module",
      date: "May 20, 2026",
      title: "Emergency Alert System Now Integrated with Barangay Network"
    },
    {
      image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80",
      tag: "Feature Update",
      tagClass: "tag-feature",
      date: "May 15, 2026",
      title: "CPSS Mobile App Launches on iOS and Android"
    },
    {
      image: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=400&q=80",
      tag: "Community News",
      tagClass: "tag-community",
      date: "May 8, 2026",
      title: "Volunteer Registration Surpasses 2,500 Active Members"
    }
  ];

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % updates.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + updates.length) % updates.length);
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <section className="updates" id="resources" aria-labelledby="updates-title">
      <div className="container reveal">
        <div className="updates-header">
          <div>
            <span className="eyebrow">LATEST UPDATES</span>
            <h2 className="section-heading" id="updates-title">Stay Informed, Stay Safe</h2>
          </div>
          <a href="#" className="updates-view-all">VIEW ALL UPDATES <span aria-hidden="true">→</span></a>
        </div>
        <div className="carousel-wrap">
          <button className="carousel-arrow carousel-arrow--prev" type="button" aria-label="Previous" onClick={goToPrev}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button className="carousel-arrow carousel-arrow--next" type="button" aria-label="Next" onClick={goToNext}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          <div className="carousel-track-wrap">
            <div className="updates-grid" id="updatesTrack">
              {updates.map((update, index) => (
                <article 
                  className="update-card" 
                  key={index}
                  style={{ display: index === currentIndex ? 'block' : 'none' }}
                >
                  <div className="update-thumb">
                    <img src={update.image} alt={update.title} />
                    <span className={`update-tag ${update.tagClass}`}>{update.tag}</span>
                  </div>
                  <div className="update-body">
                    <span className="update-date">{update.date}</span>
                    <h3 className="update-title">{update.title}</h3>
                    <a href="#" className="update-link">Read More <span aria-hidden="true">→</span></a>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="carousel-footer">
            <div className="carousel-dots" id="carouselDots">
              {updates.map((_, index) => (
                <button
                  key={index}
                  className={`carousel-dot ${index === currentIndex ? 'is-active' : ''}`}
                  aria-label={`Go to card ${index + 1}`}
                  onClick={() => goToIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Updates;