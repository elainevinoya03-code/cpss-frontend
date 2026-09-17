import React, { useEffect, useState } from 'react';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTheme } from '../hooks/use-theme';
import { cn } from '../lib/utils';

interface HeaderProps {
  scrollToSection?: (sectionId: string) => void;
  onNavigateToLogin?: () => void;
}

const NAV_ITEMS = [
  { id: 'hero', label: 'Home' },
  { id: 'about', label: 'About Us' },
  { id: 'services', label: 'Services' },
  { id: 'initiatives', label: 'Initiatives' },
  { id: 'contact', label: 'Contact Us' },
];

const Header: React.FC<HeaderProps> = ({ scrollToSection, onNavigateToLogin }) => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [active, setActive] = useState('hero');
  const { isDark, toggleTheme } = useTheme();
  const themeBtnRef = React.useRef<HTMLButtonElement>(null);

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    const root = document.documentElement;
    switch (size) {
      case 'small':
        root.style.fontSize = '14px';
        break;
      case 'medium':
        root.style.fontSize = '16px';
        break;
      case 'large':
        root.style.fontSize = '18px';
        break;
    }
  };

  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.id).filter((id) => id !== 'hero');
    const onScroll = () => {
      const marker = window.scrollY + window.innerHeight * 0.35;
      let current = 'hero';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= marker) current = id;
      }
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToSection = (id: string) => {
    if (id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setIsNavOpen(false);
      return;
    }
    if (scrollToSection) {
      scrollToSection(id);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
    setIsNavOpen(false);
  };

  const navLinkClass = (id: string) =>
    cn(
      'rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/40',
      active === id
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    );

  return (
    <header className="fixed inset-x-0 top-0 z-50" role="banner">
      {/* Government utility bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex h-8 w-full max-w-[100rem] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-primary-foreground/85">
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3" stroke="none" />
            </svg>
            <span className="truncate">GOVERNMENT OF THE PHILIPPINES</span>
          </div>
          <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-primary-foreground/80 sm:gap-3">
            <a href="#main-content" className="shrink-0 transition-colors hover:text-primary-foreground">
              Skip to main content
            </a>
            <span aria-hidden="true" className="text-primary-foreground/40">|</span>
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                className={cn(
                  'px-1 transition-colors hover:text-primary-foreground',
                  fontSize === 'small' && 'text-primary-foreground',
                )}
                data-size="small"
                aria-label="Decrease font size"
                onClick={() => handleFontSizeChange('small')}
              >
                A−
              </button>
              <button
                type="button"
                className={cn(
                  'px-1 transition-colors hover:text-primary-foreground',
                  fontSize === 'medium' && 'text-primary-foreground',
                )}
                data-size="medium"
                aria-label="Default font size"
                onClick={() => handleFontSizeChange('medium')}
              >
                A
              </button>
              <button
                type="button"
                className={cn(
                  'px-1 transition-colors hover:text-primary-foreground',
                  fontSize === 'large' && 'text-primary-foreground',
                )}
                data-size="large"
                aria-label="Increase font size"
                onClick={() => handleFontSizeChange('large')}
              >
                A+
              </button>
            </span>
            <span aria-hidden="true" className="hidden text-primary-foreground/40 sm:inline">|</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              English <ChevronDown size={11} className="opacity-60" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      {/* Fixed main navigation */}
        <div className="border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-full max-w-[100rem] items-center justify-between gap-3 px-5 sm:px-8 lg:h-24 lg:px-12">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/40"
              aria-label="Go to top"
            >
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform duration-500 hover:rotate-3 sm:size-12 lg:size-14">
                <img src="/logo.png" alt="" className="size-full object-contain" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="max-w-[190px] truncate font-display text-[0.8125rem] font-extrabold leading-tight tracking-[0.01em] sm:max-w-[230px] sm:text-sm lg:max-w-[300px] lg:text-base">
                  COMMUNITY POLICING &amp; SURVEILLANCE SYSTEM
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.625rem]">
                  <span className="hidden h-px w-4 bg-primary/40 sm:block" aria-hidden="true" />
                  Barangay Culiat · District 6
                </span>
              </span>
            </button>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={navLinkClass(item.id)}
                  onClick={() => goToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Button
                ref={themeBtnRef}
                variant="icon"
                size="icon"
                className="relative"
                onClick={() => toggleTheme(themeBtnRef.current)}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <Sun
                  className={cn(
                    'absolute inset-0 m-auto size-5 transition-all duration-700 [transition-timing-function:var(--ease-theme)]',
                    isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
                  )}
                />
                <Moon
                  className={cn(
                    'absolute inset-0 m-auto size-5 transition-all duration-700 [transition-timing-function:var(--ease-theme)]',
                    isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
                  )}
                />
              </Button>

              <div className="hidden items-center gap-2 lg:flex">
                {onNavigateToLogin && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onNavigateToLogin();
                      setIsNavOpen(false);
                    }}
                  >
                    Login
                  </Button>
                )}
                <Button onClick={() => goToSection('mobile-app')}>Report an Issue</Button>
              </div>

              <Button
                variant="icon"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsNavOpen((open) => !open)}
                aria-label={isNavOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isNavOpen}
              >
                {isNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Collapsible mobile menu */}
        <div
          className={cn(
            'overflow-hidden border-b border-border/70 bg-background/95 backdrop-blur-xl transition-all duration-500 lg:hidden',
            isNavOpen ? 'max-h-80' : 'max-h-0',
          )}
        >
          <nav className="space-y-1 px-5 py-4 sm:px-8" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'block w-full rounded-full px-4 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/40',
                  active === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                onClick={() => goToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              {onNavigateToLogin && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    onNavigateToLogin();
                    setIsNavOpen(false);
                  }}
                >
                  Login
                </Button>
              )}
              <Button className="w-full sm:w-auto" onClick={() => goToSection('mobile-app')}>
                Report an Issue
              </Button>
            </div>
          </nav>
        </div>
    </header>
  );
};

export default Header;