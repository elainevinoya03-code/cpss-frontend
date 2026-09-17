import React from 'react';
import { ArrowUpRight, BadgeCheck, Radar } from 'lucide-react';
import { Button } from '../components/ui/button';

const highlights = ['Integrated emergency alerting', 'Real-time dispatch coordination', 'Community reporting with media evidence'];

const About: React.FC = () => {
  return (
    <section id="about" className="scroll-mt-28 bg-background lg:scroll-mt-32" aria-labelledby="about-title">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <span className="section-label">About Us</span>
            <h2 id="about-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
              Building a Safer Community <span className="text-primary">Through Partnership</span>
            </h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg">
              Our system unifies incident reporting, live surveillance, patrol management, neighborhood watch
              coordination, and emergency alerts into a single platform. Designed for local government units, CPSS
              empowers communities and authorities to work together for a safer environment.
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
              With real-time data sharing and integrated communication tools, CPSS ensures that every stakeholder has
              the information they need to respond effectively and keep our community safe.
            </p>

            <ul className="mt-8 space-y-3">
              {highlights.map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-sm font-semibold text-foreground sm:text-base">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BadgeCheck className="size-4" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              className="mt-9"
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Learn More About Us
              <ArrowUpRight className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <div data-reveal className="relative">
            <div className="rounded-3xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
              <img
                src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80"
                alt="Police officer engaging with community members"
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
            </div>
            <div className="absolute -bottom-6 left-6 right-6 rounded-3xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-xl sm:left-10 sm:right-auto sm:w-64">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Radar className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-display text-xl font-extrabold text-foreground">Real-time</div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Situation Awareness
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;