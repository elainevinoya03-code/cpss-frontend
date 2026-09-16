import React, { useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import Hero from './Hero';
import Initiatives from './Initiatives';
import Services from './Services';
import HowItWorks from './HowItWorks';
import Stats from './Stats';
import About from './About';
import MobileApp from './MobileApp';
import Updates from './Updates';
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
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress-bar" id="scrollProgress"></div>
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
        <Updates />
        <Contact />
      </main>

      <Footer />

      <div className="toast-container" id="toastContainer" aria-live="polite" aria-atomic="true"></div>

      <ChatBot />
    </>
  );
};

export default LandingPage;