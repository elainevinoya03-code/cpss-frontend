import React from 'react';
import { ArrowUpRight, Flame, GraduationCap, Siren, Users, type LucideIcon } from 'lucide-react';

interface Initiative {
  icon: LucideIcon;
  title: string;
  description: string;
}

const initiatives: Initiative[] = [
  {
    icon: Users,
    title: 'Community Watch Program',
    description:
      'Empowering residents to actively participate in neighborhood safety through organized patrols and reporting networks.',
  },
  {
    icon: GraduationCap,
    title: 'School Safety Initiative',
    description:
      'Partnering with educational institutions to ensure safe learning environments through surveillance and rapid response.',
  },
  {
    icon: Siren,
    title: 'Emergency Response Network',
    description:
      'A coordinated network of first responders, barangay officials, and volunteers for rapid emergency deployment.',
  },
  {
    icon: Flame,
    title: 'IoT Smoke & Noise Detection',
    description:
      'Smart sensors detect smoke, excessive noise levels, and environmental hazards — automatically triggering alerts to authorities for rapid response.',
  },
];

const Initiatives: React.FC = () => {
  return (
    <section id="initiatives" className="scroll-mt-28 bg-background lg:scroll-mt-32" aria-labelledby="initiatives-title">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <span className="section-label">Our Initiatives</span>
          <h2 id="initiatives-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
            Community Programs <span className="text-primary">for Safety</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {initiatives.map((initiative, index) => (
            <article
              key={index}
              data-reveal
              className="system-card group flex min-h-80 flex-col rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:rotate-3 group-hover:bg-primary group-hover:text-primary-foreground">
                  <initiative.icon className="size-6" aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="size-5 text-muted-foreground transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-8 font-display text-xl font-extrabold leading-snug">{initiative.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{initiative.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Initiatives;