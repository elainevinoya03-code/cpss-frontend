import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import culiatBg from '../assets/culiat.jpg';
import { Button } from '../components/ui/button';

const Hero: React.FC = () => {
  return (
    <section id="hero" className="relative scroll-mt-28 overflow-hidden bg-brand-surface text-brand-surface-foreground lg:scroll-mt-32">
      <div
        className="civic-grid absolute inset-0"
        style={{ '--grid-line': 'color-mix(in oklab, var(--color-brand-surface-foreground) 9%, transparent)' } as React.CSSProperties}
        aria-hidden="true"
      />
      <div className="signal-line absolute inset-x-0 bottom-0 h-px" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${culiatBg})`,
          maskImage: 'linear-gradient(to right, transparent 0%, transparent 45%, black 65%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 45%, black 65%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(46, 139, 66, 0.5) 0%, rgba(52, 150, 74, 0.38) 40%, rgba(58, 158, 82, 0.16) 55%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[100rem] pb-16 pl-4 pr-4 pt-32 sm:pb-20 sm:pl-6 sm:pr-8 sm:pt-40 md:pb-24 md:pt-48 lg:pb-44 lg:pl-4 lg:pr-12 lg:pt-64 xl:pb-52 xl:pt-72">
        <div className="animate-rise max-w-full lg:max-w-4xl xl:max-w-5xl">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-surface-foreground/70 sm:text-xs sm:tracking-[0.14em] md:text-sm">
            Together for a Safer Community
          </span>
          <h1 className="mt-3 font-display text-3xl font-black leading-[1.1] sm:text-4xl sm:leading-[1.08] md:text-5xl md:leading-[1.05] lg:text-6xl lg:leading-[1.03] xl:text-7xl 2xl:text-8xl">
            Community Policing{' '}
            <span className="text-brand-surface-muted">&amp;</span> Surveillance System
          </h1>
          <p className="mt-4 max-w-full text-base leading-7 text-brand-surface-foreground/80 sm:text-lg sm:leading-8 md:text-xl md:leading-9 lg:text-2xl lg:leading-10">
            Building a safer tomorrow through community partnership, smart surveillance, and
            responsive policing for Barangay Culiat.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
            <Button
              className="bg-brand-surface-foreground text-brand-surface shadow-xl shadow-black/10 hover:bg-brand-surface-foreground/90 hover:text-brand-surface text-sm sm:text-base"
              onClick={() => document.getElementById('mobile-app')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Report an Issue
              <ArrowUpRight className="size-4 sm:size-5" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="border-brand-surface-foreground/30 bg-transparent text-brand-surface-foreground hover:border-brand-surface-foreground/50 hover:bg-brand-surface-foreground/10 hover:text-brand-surface-foreground text-sm sm:text-base"
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Know More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;