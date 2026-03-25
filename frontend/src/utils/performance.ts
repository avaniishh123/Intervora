/**
 * Performance monitoring utilities for tracking app performance
 */

// Track component render times
export const measureRender = (componentName: string, callback: () => void) => {
  if (import.meta.env.DEV) {
    const start = performance.now();
    callback();
    const end = performance.now();
    console.log(`[Performance] ${componentName} rendered in ${(end - start).toFixed(2)}ms`);
  } else {
    callback();
  }
};

// Track API call times
export const measureApiCall = async <T>(
  apiName: string,
  apiCall: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await apiCall();
    const end = performance.now();
    
    if (import.meta.env.DEV) {
      console.log(`[Performance] API ${apiName} completed in ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const end = performance.now();
    
    if (import.meta.env.DEV) {
      console.error(`[Performance] API ${apiName} failed after ${(end - start).toFixed(2)}ms`);
    }
    
    throw error;
  }
};

// Report Web Vitals
export const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS(onPerfEntry);
      onINP(onPerfEntry); // INP replaced FID in web-vitals v3
      onFCP(onPerfEntry);
      onLCP(onPerfEntry);
      onTTFB(onPerfEntry);
    });
  }
};

// Image lazy loading helper
export const lazyLoadImage = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
};

// Debounce helper for performance optimization
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle helper for performance optimization
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Check if browser supports WebP
export const supportsWebP = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

// Preload critical resources
export const preloadResource = (href: string, as: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
};

// Monitor memory usage (Chrome only)
export const getMemoryUsage = (): number | null => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  }
  return null;
};

// Log performance metrics in development
export const logPerformanceMetrics = () => {
  if (import.meta.env.DEV && window.performance) {
    const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (perfData) {
      console.group('🚀 Performance Metrics');
      console.log(`DNS Lookup: ${(perfData.domainLookupEnd - perfData.domainLookupStart).toFixed(2)}ms`);
      console.log(`TCP Connection: ${(perfData.connectEnd - perfData.connectStart).toFixed(2)}ms`);
      console.log(`Request Time: ${(perfData.responseStart - perfData.requestStart).toFixed(2)}ms`);
      console.log(`Response Time: ${(perfData.responseEnd - perfData.responseStart).toFixed(2)}ms`);
      console.log(`DOM Interactive: ${(perfData.domInteractive - perfData.fetchStart).toFixed(2)}ms`);
      console.log(`DOM Complete: ${(perfData.domComplete - perfData.fetchStart).toFixed(2)}ms`);
      console.log(`Load Complete: ${(perfData.loadEventEnd - perfData.loadEventStart).toFixed(2)}ms`);
      console.log(`Total Load Time: ${(perfData.loadEventEnd - perfData.fetchStart).toFixed(2)}ms`);
      console.groupEnd();
    }
  }
};
