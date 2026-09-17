import { useEffect } from 'react';
import { useRevealOnScroll } from '../hooks/use-reveal';

export const useScrollReveal = useRevealOnScroll;

export const useScrollProgress = () => {
  useEffect(() => {
    const progressBar = document.getElementById('scrollProgress');
    if (!progressBar) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = `${progress}%`;
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
};

export const useStaggerAnimation = () => {
  useEffect(() => {
    const staggerGroups = document.querySelectorAll('.stagger-children');
    if (staggerGroups.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    staggerGroups.forEach((group) => observer.observe(group));
    return () => observer.disconnect();
  }, []);
};