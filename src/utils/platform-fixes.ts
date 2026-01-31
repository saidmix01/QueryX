import { type } from '@tauri-apps/api/os';
import '../linux-fix.css';

let isLinuxCache: boolean | null = null;

export const isLinux = async (): Promise<boolean> => {
  if (isLinuxCache !== null) return isLinuxCache;
  
  try {
    const osType = await type();
    isLinuxCache = osType === 'Linux';
  } catch (e) {
    console.warn('Failed to detect OS via Tauri API, falling back to UserAgent', e);
    isLinuxCache = navigator.userAgent.includes('Linux');
  }
  return isLinuxCache || false;
};

export const applyLinuxFixes = async () => {
  if (await isLinux()) {
    console.log('Applying Linux-specific fixes...');
    
    // Add class for CSS overrides
    document.body.classList.add('is-linux');
    document.documentElement.classList.add('is-linux'); // Add to html as well
    
    // Force solid background on body
    document.body.style.backgroundColor = '#0f0f0f';
    
    // Remove invisible overlays loop
    setInterval(() => {
      // Find elements that are fixed and transparent
      const invisibleFixed = document.querySelectorAll('div[style*="position: fixed"][style*="opacity: 0"]');
      invisibleFixed.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      
      // Also check computed styles for rigorous detection
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(el => {
         const style = window.getComputedStyle(el);
         if (style.position === 'fixed' && style.opacity === '0' && style.zIndex !== 'auto' && parseInt(style.zIndex) > 100) {
             el.style.display = 'none';
         }
      });

    }, 2000); // Check every 2 seconds
  }
};
