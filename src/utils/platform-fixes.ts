import { type } from '@tauri-apps/api/os';
import '../linux-fix.css';

let isLinuxCache: boolean | null = null;

// Synchronous heuristic check for immediate application
const isLinuxUserAgent = () => navigator.userAgent.includes('Linux');

export const isLinux = async (): Promise<boolean> => {
  if (isLinuxCache !== null) return isLinuxCache;
  
  try {
    const osType = await type();
    isLinuxCache = osType === 'Linux';
  } catch (e) {
    console.warn('Failed to detect OS via Tauri API, falling back to UserAgent', e);
    isLinuxCache = isLinuxUserAgent();
  }
  return isLinuxCache || false;
};

export const applyLinuxFixes = async () => {
  // 1. Optimistic apply (Synchronous) to prevent FOUC/flashes
  if (isLinuxUserAgent()) {
      document.body.classList.add('is-linux');
      document.documentElement.classList.add('is-linux');
      document.body.style.backgroundColor = '#0b0f0c';
  }

  // 2. Confirm with robust check
  const confirmLinux = await isLinux();
  
  if (confirmLinux) {
    console.log('Applying Linux-specific fixes (Confirmed)...');
    
    // Ensure classes are present (in case UserAgent failed but API succeeded)
    document.body.classList.add('is-linux');
    document.documentElement.classList.add('is-linux');
    
    // Force solid background color immediately
    document.body.style.backgroundColor = '#0b0f0c'; // Matches user preference
    
    // 3. Monitor and remove problematic overlays
    const removeProblematicElements = () => {
      // Remove invisible overlays that might block clicks
      const invisibleFixed = document.querySelectorAll('div[style*="position: fixed"][style*="opacity: 0"]');
      invisibleFixed.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Scan for any fixed full-screen elements with low opacity or transparency
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(el => {
         const style = window.getComputedStyle(el);
         
         // Detect potential click blockers: fixed position, covering most of screen, invisible-ish
         if (style.position === 'fixed' && 
            (style.opacity === '0' || style.visibility === 'hidden' || style.pointerEvents === 'none') && 
            parseInt(style.zIndex) > 50) {
             // Only hide if it looks like a generic overlay, not a functional modal
             // This is a heuristic, but "opacity: 0" fixed elements are usually the culprit
             if (style.opacity === '0') {
                 el.style.display = 'none';
             }
         }
      });
    };

    // Run immediately
    removeProblematicElements();
    
    // Run periodically to catch dynamically added overlays
    setInterval(removeProblematicElements, 2000);
    
    // 4. Force pointer-events: auto on root elements to ensure clicks are captured
    document.documentElement.style.pointerEvents = 'auto';
    document.body.style.pointerEvents = 'auto';
    const root = document.getElementById('root');
    if (root) {
        root.style.pointerEvents = 'auto';
    }
  } else {
      // Revert if we guessed wrong (unlikely)
      if (isLinuxUserAgent()) {
          document.body.classList.remove('is-linux');
          document.documentElement.classList.remove('is-linux');
          document.body.style.backgroundColor = '';
      }
  }
};
