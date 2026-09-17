import React from 'react';
import {
  ArrowUpRight,
  BellRing,
  ClipboardList,
  Flame,
  Route,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';

interface Service {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
}

const services: Service[] = [
  {
    icon: ClipboardList,
    eyebrow: 'Module 01',
    title: 'Community Incident Reporting',
    description:
      'Report crimes, suspicious activity, or safety concerns with photo and video evidence and track status in real time.',
    action: 'Report Now',
  },
  {
    icon: Video,
    eyebrow: 'Module 02',
    title: 'CCTV & Surveillance Integration',
    description:
      'Access integrated live and recorded surveillance feeds from public cameras for real-time monitoring.',
    action: 'View Feeds',
  },
  {
    icon: Route,
    eyebrow: 'Module 03',
    title: 'Patrol Scheduling & Monitoring',
    description:
      'Manage and track patrol officer schedules, routes, and real-time location data efficiently.',
    action: 'View Schedule',
  },
  {
    icon: Users,
    eyebrow: 'Module 04',
    title: 'Neighborhood Watch Coordination',
    description: 'Connect volunteer watch groups with local police for coordinated patrols and alerts.',
    action: 'Join Watch',
  },
  {
    icon: BellRing,
    eyebrow: 'Module 05',
    title: 'Security Alert System',
    description: 'Receive instant emergency notifications and broadcast alerts for your area immediately.',
    action: 'View Alerts',
  },
  {
    icon: Flame,
    eyebrow: 'Module 06',
    title: 'IoT Smoke & Noise Detection',
    description:
      'Smart IoT sensors detect smoke, excessive noise, and environmental hazards — triggering automated emergency alerts to authorities and residents in real time.',
    action: 'Learn More',
  },
];

const Services: React.FC = () => {
  return (
    <section id="services" className="scroll-mt-28 border-y border-border bg-muted/35 lg:scroll-mt-32" aria-labelledby="services-title">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <span className="section-label">Our Services</span>
          <h2 id="services-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
            How Can We <span className="text-primary">Help You?</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service, index) => (
            <article
              key={index}
              data-reveal
              className="system-card group flex min-h-80 flex-col rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:rotate-3 group-hover:bg-primary group-hover:text-primary-foreground">
                  <service.icon className="size-6" aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="size-5 text-muted-foreground transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{service.eyebrow}</p>
              <h3 className="mt-2 font-display text-xl font-extrabold leading-snug">{service.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description}</p>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-xs font-semibold text-muted-foreground">Live module</span>
                <Button size="sm" variant="outline">
                  {service.action}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;