import React, { useEffect, useRef } from 'react';

interface Stat {
  target: number;
  label: string;
}

const Stats: React.FC = () => {
  const statsRef = useRef<HTMLDivElement>(null);

  const stats: Stat[] = [
    { target: 12548, label: "Issues Resolved" },
    { target: 2345, label: "Active Volunteers" },
    { target: 1120, label: "CCTV Cameras" },
    { target: 98, label: "Satisfaction Rate" }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounters();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, []);

  const animateCounters = () => {
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach((counter) => {
      const target = parseInt(counter.getAttribute('data-target') || '0', 10);
      if (isNaN(target) || target <= 0) {
        counter.textContent = target.toString();
        return;
      }
      
      const duration = 2000;
      const startTime = performance.now();

      const step = (timestamp: number) => {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        counter.textContent = current.toLocaleString();
        
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          counter.textContent = target.toLocaleString();
        }
      };

      requestAnimationFrame(step);
    });
  };

  return (
    <section className="stats" aria-label="System statistics">
      <div className="container reveal" ref={statsRef}>
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div className="stat-item" key={index}>
              <span className="stat-number" data-target={stat.target}>0</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;