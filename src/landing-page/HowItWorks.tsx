import React from 'react';
import { ClipboardList, MapPinned, ScanEye, ShieldCheck, type LucideIcon } from 'lucide-react';

interface Step {
  icon: LucideIcon;
  num: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: ClipboardList,
    num: '01',
    title: 'Report',
    description:
      'Citizens report incidents via the web portal, mobile app, or hotline with photo and video evidence.',
  },
  {
    icon: ScanEye,
    num: '02',
    title: 'Verify',
    description:
      'Authorities review and validate the report, cross-referencing with CCTV feeds and sensor data.',
  },
  {
    icon: MapPinned,
    num: '03',
    title: 'Dispatch',
    description:
      'The nearest patrol unit or responder is dispatched with real-time route optimization and GPS tracking.',
  },
  {
    icon: ShieldCheck,
    num: '04',
    title: 'Resolve',
    description:
      'The incident is resolved and the reporter receives a real-time status update and case summary.',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="scroll-mt-28 bg-background lg:scroll-mt-32" aria-labelledby="how-title">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <span className="section-label">How It Works</span>
          <h2 id="how-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
            From Report <span className="text-primary">to Resolution</span>
          </h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
            Our streamlined process ensures every concern is handled quickly and transparently.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <article
              key={index}
              data-reveal
              className="system-card group flex flex-col rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <span className="font-display text-5xl font-black leading-none text-primary/15 transition-colors duration-500 group-hover:text-primary/30">
                {step.num}
              </span>
              <span className="mt-6 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:rotate-3 group-hover:bg-primary group-hover:text-primary-foreground">
                <step.icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-display text-xl font-extrabold leading-snug">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;