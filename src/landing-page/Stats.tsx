import React, { useEffect, useRef } from 'react';

interface Stat {
  target: number;
  label: string;
}

const stats: Stat[] = [
  { target: 12548, label: 'Issues Resolved' },
  { target: 2345, label: 'Active Volunteers' },
  { target: 1120, label: 'CCTV Cameras' },
  { target: 98, label: 'Satisfaction Rate' },
];

const Stats: React.FC = () => {
  const statsRef = useRef<HTMLDivElement>(null);

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
      { threshold: 0.5 },
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const animateCounters = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach((counter) => {
      const target = parseInt(counter.getAttribute('data-target') || '0', 10);
      if (isNaN(target) || target <= 0) {
        counter.textContent = target.toString();
        return;
      }
      if (reduced) {
        counter.textContent = target.toLocaleString();
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
    <section className="scroll-mt-28 bg-brand-surface text-brand-surface-foreground lg:scroll-mt-32" aria-label="System statistics">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4" ref={statsRef}>
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="font-display text-4xl font-black text-brand-surface-foreground sm:text-5xl">
                <span className="stat-number" data-target={stat.target}>0</span>
              </div>
              <div className="mt-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-brand-surface-foreground/70">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;