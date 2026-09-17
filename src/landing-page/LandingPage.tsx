import React from 'react';
import Header from './Header';
import Footer from './Footer';
import Hero from './Hero';
import Initiatives from './Initiatives';
import Services from './Services';
import HowItWorks from './HowItWorks';
import Stats from './Stats';
import About from './About';
import MobileApp from './MobileApp';
import Contact from './Contact';
import ChatBot from './ChatBot';
import { useScrollReveal, useScrollProgress, useStaggerAnimation } from './hooks';

interface LandingPageProps {
  onNavigateToLogin?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  useScrollReveal();
  useScrollProgress();
  useStaggerAnimation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-32 focus:z-[70] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-2xl"
      >
        Skip to main content
      </a>

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1" aria-hidden="true">
        <div id="scrollProgress" className="h-full w-0 bg-primary transition-[width] duration-150 ease-out" />
      </div>

      <Header onNavigateToLogin={onNavigateToLogin} />

      <main id="main-content">
        <Hero />
        <Initiatives />
        <Services />
        <HowItWorks />
        <Stats />
        <About />
        <MobileApp />
        <Contact />
      </main>

      <Footer />

      <div
        id="toastContainer"
        className="fixed right-4 top-36 z-[70] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      />

      <ChatBot />
    </div>
  );
};

export default LandingPage;