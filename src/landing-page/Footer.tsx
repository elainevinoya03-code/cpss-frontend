import React from 'react';
import { AtSign, Globe, MessageCircle, Play } from 'lucide-react';

const Footer: React.FC = () => {
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const socials = [
    { icon: AtSign, label: 'Facebook' },
    { icon: MessageCircle, label: 'X (Twitter)' },
    { icon: Globe, label: 'Instagram' },
    { icon: Play, label: 'YouTube' },
  ];

  return (
    <footer className="w-full bg-footer text-footer-foreground" role="contentinfo">
      <div className="mx-auto w-full max-w-[100rem] px-5 pb-8 pt-16 sm:px-8 lg:px-12 lg:pt-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-footer-foreground/15 bg-footer-foreground/5 text-footer-accent">
                <svg className="size-7" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                  <rect x="4" y="13" width="28" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" fill="none" />
                  <path d="M14 6 L22 6 L24 10 L12 10 Z" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  <circle cx="18" cy="22" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  <circle cx="18" cy="22" r="2.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.25" />
                  <circle cx="26" cy="18" r="1.5" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.3" />
                </svg>
              </span>
              <div>
                <div className="font-display text-base font-extrabold leading-tight">
                  COMMUNITY POLICING &amp; SURVEILLANCE SYSTEM
                </div>
                <div className="mt-1 text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-footer-muted">
                  CPSS · Barangay Culiat
                </div>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-6 text-footer-muted">
              Community Policing &amp; Surveillance System — an integrated platform unifying incident reporting, live
              surveillance, patrol management, neighborhood watch coordination, and emergency alerts for safer
              communities.
            </p>

            <div className="mt-6 flex gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="grid size-10 place-items-center rounded-full border border-footer-foreground/15 text-footer-muted transition-colors duration-300 hover:bg-footer-accent/15 hover:text-footer-accent focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-footer-accent/40"
                >
                  <social.icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-footer-foreground">
              Quick Links
            </h4>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <a href="#" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  Home
                </a>
              </li>
              <li>
                <a href="#about" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>
                  About Us
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>
                  How It Works
                </a>
              </li>
              <li>
                <a href="#services" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}>
                  Services
                </a>
              </li>
              <li>
                <a href="#initiatives" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); scrollToSection('initiatives'); }}>
                  Initiatives
                </a>
              </li>
              <li>
                <a href="#mobile-app" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); scrollToSection('mobile-app'); }}>
                  Mobile App
                </a>
              </li>
              <li>
                <a href="#contact" className="text-footer-muted transition-colors hover:text-footer-foreground" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }}>
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-footer-foreground">
              Useful Links
            </h4>
            <ul className="mt-5 space-y-3 text-sm">
              <li><a href="#" className="text-footer-muted transition-colors hover:text-footer-foreground">Incident Reporting</a></li>
              <li><a href="#" className="text-footer-muted transition-colors hover:text-footer-foreground">CCTV Access</a></li>
              <li><a href="#" className="text-footer-muted transition-colors hover:text-footer-foreground">Patrol Schedule</a></li>
              <li><a href="#" className="text-footer-muted transition-colors hover:text-footer-foreground">Neighborhood Watch</a></li>
              <li><a href="#" className="text-footer-muted transition-colors hover:text-footer-foreground">Emergency Alerts</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-footer-foreground">
              Contact Us
            </h4>
            <ul className="mt-5 space-y-3 text-sm text-footer-muted">
              <li>
                <span className="font-bold text-footer-foreground/80">Address:</span> City Hall, 2nd Floor, Peace and
                Order Council Office
              </li>
              <li>
                <span className="font-bold text-footer-foreground/80">Phone:</span> (02) 1234-5678
              </li>
              <li>
                <span className="font-bold text-footer-foreground/80">Email:</span> cpss@lgu.gov.ph
              </li>
              <li>
                <span className="font-bold text-footer-foreground/80">Hours:</span> Mon–Fri, 8:00 AM – 5:00 PM
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-footer-foreground/10 pt-6 text-xs text-footer-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Community Policing &amp; Surveillance System. All rights reserved.</p>
          <div className="flex flex-wrap gap-5">
            <a href="#privacy" className="transition-colors hover:text-footer-foreground">Privacy Policy</a>
            <a href="#terms" className="transition-colors hover:text-footer-foreground">Terms of Use</a>
            <a href="#accessibility" className="transition-colors hover:text-footer-foreground">Accessibility Statement</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;