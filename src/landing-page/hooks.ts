import { useEffect } from 'react';

export const useScrollReveal = () => {
  useEffect(() => {
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-up, .reveal-scale');
    
    if (revealElements.length === 0) return;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealElements.forEach((el) => {
      revealObserver.observe(el);
    });

    return () => {
      revealElements.forEach((el) => {
        revealObserver.unobserve(el);
      });
    };
  }, []);
};

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
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
};

export const useStaggerAnimation = () => {
  useEffect(() => {
    const staggerGroups = document.querySelectorAll('.stagger-children');
    staggerGroups.forEach((group) => {
      const children = group.children;
      for (let i = 0; i < children.length; i++) {
        (children[i] as HTMLElement).style.setProperty('--stagger-delay', `${i * 0.1}s`);
      }
      
      const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            staggerObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      
      staggerObserver.observe(group);
    });
  }, []);
};