/**
 * ============================================================================
 * LINUX SAFETY MODE - Platform Detection and CSS Fixes
 * ============================================================================
 * 
 * This module provides:
 * 1. Robust Linux detection (Tauri API + UserAgent fallback)
 * 2. Immediate CSS class application (prevents FOUC)
 * 3. Runtime monitoring for problematic elements
 * 4. Guaranteed pointer-events and opacity fixes
 * 
 * CRITICAL: These fixes are ONLY applied on Linux to avoid affecting
 * Windows/macOS behavior.
 * ============================================================================
 */

import { type } from '@tauri-apps/api/os';
import '../linux-fix.css';

let isLinuxCache: boolean | null = null;

/**
 * Synchronous heuristic check for immediate application
 * Uses UserAgent as a fast first-pass detection
 */
const isLinuxUserAgent = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('linux') && !ua.includes('android');
};

/**
 * Robust Linux detection using Tauri API with UserAgent fallback
 * Caches result for performance
 */
export const isLinux = async (): Promise<boolean> => {
  // Return cached result if available
  if (isLinuxCache !== null) return isLinuxCache;
  
  try {
    // Primary detection: Tauri OS API (most reliable)
    const osType = await type();
    isLinuxCache = osType === 'Linux';
    
    if (isLinuxCache) {
      console.log('[Linux Detection] Confirmed via Tauri API: Linux');
    }
  } catch (e) {
    // Fallback: UserAgent detection (less reliable but synchronous)
    console.warn('[Linux Detection] Tauri API failed, using UserAgent fallback', e);
    isLinuxCache = isLinuxUserAgent();
    
    if (isLinuxCache) {
      console.log('[Linux Detection] Detected via UserAgent: Linux');
    }
  }
  
  return isLinuxCache || false;
};

/**
 * Apply Linux-specific CSS fixes immediately
 * This runs synchronously to prevent FOUC (Flash of Unstyled Content)
 */
const applyLinuxCSSImmediate = (): void => {
  // Add Linux class to root elements
  document.body.classList.add('is-linux');
  document.documentElement.classList.add('is-linux');
  
  // Force solid background color (prevents transparency artifacts)
  document.body.style.backgroundColor = '#0b0f0c';
  document.documentElement.style.backgroundColor = '#0b0f0c';
  
  // Force pointer-events on root elements (prevents click-through)
  document.documentElement.style.pointerEvents = 'auto';
  document.body.style.pointerEvents = 'auto';
  
  // Apply to root element if it exists
  // NOTE: Don't force opacity: 1 to allow animations to work
  const root = document.getElementById('root');
  if (root) {
    root.style.pointerEvents = 'auto';
    root.style.backgroundColor = '#0b0f0c';
    // Don't force opacity - allow animations/transitions to work
  }
  
  console.log('[Linux Fixes] Applied immediate CSS fixes');
};

/**
 * Remove problematic elements that might block clicks or cause rendering issues
 * Runs immediately and periodically to catch dynamically added elements
 */
const removeProblematicElements = (): void => {
  // 1. Remove invisible fixed overlays (common click blockers)
  const invisibleFixed = document.querySelectorAll(
    'div[style*="position: fixed"][style*="opacity: 0"], ' +
    'div[style*="position:fixed"][style*="opacity:0"]'
  );
  invisibleFixed.forEach(el => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.display = 'none';
    htmlEl.style.pointerEvents = 'none';
  });

  // 2. Scan for fixed elements with problematic opacity/visibility
  const allDivs = document.querySelectorAll('div');
  allDivs.forEach(el => {
    const style = window.getComputedStyle(el);
    const htmlEl = el as HTMLElement;
    
    // Detect potential click blockers:
    // - Fixed position
    // - Zero opacity (not animating, just invisible)
    // - High z-index (likely an overlay)
    // NOTE: We check for opacity === '0' (not < 0.1) to allow animations
    if (
      style.position === 'fixed' &&
      style.opacity === '0' &&
      parseInt(style.zIndex) > 50
    ) {
      // Only hide if opacity is exactly 0 AND not part of an animation
      // Check if element has transition/animation classes
      const hasAnimation = htmlEl.classList.contains('animate-') ||
                          htmlEl.classList.contains('framer-') ||
                          htmlEl.getAttribute('data-framer-name') !== null;
      
      if (!hasAnimation) {
        // Only hide if it's not animating (allows fade-out animations to complete)
        htmlEl.style.display = 'none';
        htmlEl.style.pointerEvents = 'none';
      } else {
        // If animating, just disable pointer events but allow animation
        htmlEl.style.pointerEvents = 'none';
      }
    }
  });

  // 3. Ensure all interactive elements have pointer-events: auto
  const interactiveSelectors = [
    'button:not([disabled])',
    'a',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[role="button"]',
    '[role="link"]',
    '[tabindex]',
  ].join(', ');
  
  const interactiveElements = document.querySelectorAll(interactiveSelectors);
  interactiveElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    const style = window.getComputedStyle(htmlEl);
    
    // Only override if pointer-events is currently none
    if (style.pointerEvents === 'none') {
      htmlEl.style.pointerEvents = 'auto';
    }
  });
};

/**
 * Main function to apply all Linux-specific fixes
 * 
 * Strategy:
 * 1. Apply fixes optimistically (synchronously) if UserAgent suggests Linux
 * 2. Confirm with robust Tauri API check
 * 3. Apply confirmed fixes or revert if detection was wrong
 * 4. Set up monitoring for dynamically added elements
 */
export const applyLinuxFixes = async (): Promise<void> => {
  // ========================================================================
  // STEP 1: Optimistic Application (Synchronous)
  // ========================================================================
  // Apply fixes immediately if UserAgent suggests Linux
  // This prevents FOUC and ensures fixes are active from the start
  if (isLinuxUserAgent()) {
    console.log('[Linux Fixes] UserAgent suggests Linux, applying optimistic fixes...');
    applyLinuxCSSImmediate();
  }

  // ========================================================================
  // STEP 2: Confirmed Application (Asynchronous)
  // ========================================================================
  // Confirm with robust Tauri API check
  const confirmLinux = await isLinux();
  
  if (confirmLinux) {
    console.log('[Linux Fixes] ✓ Linux confirmed, applying all fixes...');
    
    // Ensure classes are present (in case UserAgent failed but API succeeded)
    if (!document.body.classList.contains('is-linux')) {
      applyLinuxCSSImmediate();
    }
    
    // ====================================================================
    // STEP 3: Runtime Monitoring
    // ====================================================================
    // Remove problematic elements immediately
    removeProblematicElements();
    
    // Set up periodic monitoring for dynamically added elements
    // Check every 2 seconds for new problematic elements
    const monitoringInterval = setInterval(() => {
      removeProblematicElements();
    }, 2000);
    
    // Clean up interval when page unloads
    window.addEventListener('beforeunload', () => {
      clearInterval(monitoringInterval);
    });
    
    // ====================================================================
    // STEP 4: MutationObserver for Real-time Monitoring
    // ====================================================================
    // Watch for DOM changes and apply fixes to new elements
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true;
        }
      });
      
      if (shouldCheck) {
        // Debounce checks to avoid performance issues
        setTimeout(removeProblematicElements, 100);
      }
    });
    
    // Start observing the entire document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    
    console.log('[Linux Fixes] ✓ All fixes applied and monitoring active');
    console.log('[Linux Fixes] Window should now be visible, clickable, and stable');
    
  } else {
    // ====================================================================
    // STEP 5: Revert if Detection Was Wrong
    // ====================================================================
    // If we optimistically applied fixes but OS is not Linux, revert them
    if (isLinuxUserAgent()) {
      console.warn('[Linux Fixes] UserAgent suggested Linux but Tauri API says otherwise, reverting...');
      document.body.classList.remove('is-linux');
      document.documentElement.classList.remove('is-linux');
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
      document.documentElement.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
      
      const root = document.getElementById('root');
      if (root) {
        root.style.pointerEvents = '';
        root.style.backgroundColor = '';
        root.style.opacity = '';
      }
    }
  }
};
