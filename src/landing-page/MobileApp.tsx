import React from 'react';
import { Check, Play, Smartphone } from 'lucide-react';

const features = [
  'Real-time incident reporting with media',
  'Push notifications for emergency alerts',
  'Live patrol tracking and GPS navigation',
  'CCTV live view on-the-go',
];

const AppBadge = ({ icon: Icon, top, bottom }: { icon: typeof Smartphone; top: string; bottom: string }) => (
  <a
    href="#"
    aria-label={`${top} ${bottom}`}
    className="group inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/40"
  >
    <Icon className="size-6 text-primary transition-transform duration-300 group-hover:rotate-3" aria-hidden="true" />
    <span className="text-left leading-tight">
      <span className="block text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
        {top}
      </span>
      <span className="block font-display text-sm font-extrabold text-foreground">{bottom}</span>
    </span>
  </a>
);

const MobileApp: React.FC = () => {
  return (
    <section id="mobile-app" className="scroll-mt-28 border-y border-border bg-muted/35 lg:scroll-mt-32" aria-labelledby="app-title">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <span className="section-label">Get the App</span>
            <h2 id="app-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
              CPSS <span className="text-primary">Mobile App</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              Report incidents, receive emergency alerts, track patrols, and stay connected with your community — all
              from the palm of your hand. Available on iOS and Android.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <AppBadge icon={Smartphone} top="Download on the" bottom="App Store" />
              <AppBadge icon={Play} top="Get it on" bottom="Google Play" />
            </div>

            <ul className="mt-8 space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3 text-sm font-semibold text-foreground sm:text-base">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="mx-auto w-full max-w-xs">
            <svg viewBox="0 0 240 480" className="mx-auto w-56 drop-shadow-2xl sm:w-64" aria-hidden="true">
              <rect x="8" y="4" width="224" height="472" rx="24" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
              <rect x="96" y="14" width="48" height="6" rx="3" fill="var(--border)" />

              <rect x="16" y="30" width="208" height="58" rx="14" fill="var(--primary)" />
              <circle cx="40" cy="59" r="7" fill="var(--primary-foreground)" opacity="0.9" />
              <text x="56" y="54" fontSize="7" fontWeight="700" fill="var(--primary-foreground)" fontFamily="Sora, sans-serif">
                CPSS
              </text>
              <text x="56" y="68" fontSize="4.5" fill="var(--primary-foreground)" opacity="0.75" fontFamily="Manrope, sans-serif">
                Safe Community
              </text>
              <circle cx="206" cy="59" r="8" fill="var(--primary-foreground)" opacity="0.25" />

              <rect x="16" y="100" width="208" height="96" rx="14" fill="var(--muted)" />
              <rect x="40" y="122" width="160" height="3" rx="1.5" fill="var(--border)" />
              <circle cx="120" cy="158" r="24" fill="var(--primary)" opacity="0.12" stroke="var(--primary)" strokeWidth="1.5" />
              <path d="M112 158 l5 5.5 l11 -12" stroke="var(--primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

              <rect x="16" y="208" width="100" height="54" rx="14" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
              <rect x="30" y="222" width="24" height="24" rx="8" fill="var(--primary)" />
              <text x="62" y="239" fontSize="5.5" fontWeight="700" fill="var(--foreground)" fontFamily="Sora, sans-serif">
                Report
              </text>
              <text x="62" y="250" fontSize="4" fill="var(--muted-foreground)" fontFamily="Manrope, sans-serif">
                Submit incident
              </text>
              <rect x="124" y="208" width="100" height="54" rx="14" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
              <rect x="138" y="222" width="24" height="24" rx="8" fill="var(--primary)" />
              <text x="170" y="239" fontSize="5.5" fontWeight="700" fill="var(--foreground)" fontFamily="Sora, sans-serif">
                Alerts
              </text>
              <text x="170" y="250" fontSize="4" fill="var(--muted-foreground)" fontFamily="Manrope, sans-serif">
                Emergency
              </text>

              <rect x="16" y="274" width="208" height="120" rx="14" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
              <text x="32" y="296" fontSize="5" fontWeight="700" fill="var(--primary)" fontFamily="Sora, sans-serif">
                RECENT UPDATES
              </text>
              <rect x="32" y="308" width="176" height="22" rx="6" fill="var(--muted)" />
              <rect x="32" y="338" width="176" height="22" rx="6" fill="var(--muted)" />
              <rect x="32" y="368" width="176" height="22" rx="6" fill="var(--muted)" />

              <rect x="16" y="408" width="208" height="44" rx="22" fill="var(--primary)" />
              <text x="78" y="435" fontSize="6.5" fontWeight="700" fill="var(--primary-foreground)" fontFamily="Sora, sans-serif">
                REPORT NOW
              </text>

              <rect x="80" y="462" width="80" height="4" rx="2" fill="var(--border)" />
              <rect x="110" y="465" width="20" height="2" rx="1" fill="var(--primary)" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileApp;