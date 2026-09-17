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

      <div className="relative mx-auto w-full max-w-[100rem] pb-28 pl-2 pr-5 pt-44 sm:pb-32 sm:pl-3 sm:pr-8 sm:pt-52 lg:pb-44 lg:pl-4 lg:pr-12 lg:pt-64 xl:pb-52 xl:pt-72">
        <div className="animate-rise max-w-4xl lg:max-w-5xl">
          <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-surface-foreground/70 sm:text-sm">
            Together for a Safer Community
          </span>
          <h1 className="mt-4 font-display text-5xl font-black leading-[1.03] sm:text-6xl lg:text-7xl xl:text-8xl">
            Community Policing{' '}
            <span className="text-brand-surface-muted">&amp;</span> Surveillance System
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-surface-foreground/80 sm:text-xl sm:leading-9 lg:text-2xl lg:leading-10">
            Building a safer tomorrow through community partnership, smart surveillance, and
            responsive policing for Barangay Culiat.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              className="bg-brand-surface-foreground text-brand-surface shadow-xl shadow-black/10 hover:bg-brand-surface-foreground/90 hover:text-brand-surface"
              onClick={() => document.getElementById('mobile-app')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Report an Issue
              <ArrowUpRight className="size-5" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="border-brand-surface-foreground/30 bg-transparent text-brand-surface-foreground hover:border-brand-surface-foreground/50 hover:bg-brand-surface-foreground/10 hover:text-brand-surface-foreground"
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