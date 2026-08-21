// Performance optimization utilities and best practices

/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Request animation frame with cancellation support
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let ticking = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!ticking) {
      requestAnimationFrame(() => {
        func(...args);
        ticking = false;
      });
      ticking = true;
    }
  };
}

/**
 * Lazy load images with intersection observer
 */
export function lazyLoadImage(
  imgElement: HTMLImageElement,
  src: string,
  options?: IntersectionObserverInit
): void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        imgElement.src = src;
        imgElement.classList.remove('lazy');
        observer.unobserve(imgElement);
      }
    });
  }, options);
  
  observer.observe(imgElement);
}

/**
 * Preload critical resources
 */
export function preloadResources(resources: Array<{ href: string; as: string }>): void {
  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;
    document.head.appendChild(link);
  });
}

/**
 * Prefetch resources for likely navigation
 */
export function prefetchResources(urls: string[]): void {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Measure performance with performance marks
 */
export function measurePerformance(
  name: string,
  callback: () => void | Promise<void>
): void | Promise<void> {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  const measureName = `${name}-measure`;
  
  performance.mark(startMark);
  
  const result = callback();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      const measure = performance.getEntriesByName(measureName)[0];
      console.log(`${name} took ${measure.duration}ms`);
      performance.clearMarks(startMark, endMark);
      performance.clearMeasures(measureName);
    });
  } else {
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    const measure = performance.getEntriesByName(measureName)[0];
    console.log(`${name} took ${measure.duration}ms`);
    performance.clearMarks(startMark, endMark);
    performance.clearMeasures(measureName);
  }
}

/**
 * Check if network is slow (2G or slower)
 */
export function isSlowNetwork(): boolean {
  const connection = (navigator as any).connection;
  if (!connection) return false;
  
  return connection.effectiveType === '2g' || 
         connection.effectiveType === 'slow-2g' ||
         connection.saveData === true;
}

/**
 * Check if device has limited memory
 */
export function isLowMemoryDevice(): boolean {
  return (navigator as any).deviceMemory <= 2;
}

/**
 * Optimize image loading based on network conditions
 */
export function getOptimalImageQuality(): number {
  if (isSlowNetwork()) {
    return 0.6; // Lower quality for slow networks
  }
  if (isLowMemoryDevice()) {
    return 0.8; // Medium quality for low memory devices
  }
  return 1.0; // Full quality for capable devices
}

/**
 * Virtual scrolling helper for large lists
 */
export class VirtualScroller<T> {
  private items: T[];
  private itemHeight: number;
  private containerHeight: number;
  private scrollTop: number = 0;
  
  constructor(items: T[], itemHeight: number, containerHeight: number) {
    this.items = items;
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
  }
  
  getVisibleItems(): { items: T[]; startIndex: number; endIndex: number } {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const endIndex = Math.min(startIndex + visibleCount + 2, this.items.length);
    const adjustedStartIndex = Math.max(0, startIndex - 2);
    
    return {
      items: this.items.slice(adjustedStartIndex, endIndex),
      startIndex: adjustedStartIndex,
      endIndex
    };
  }
  
  setScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop;
  }
  
  setItems(items: T[]): void {
    this.items = items;
  }
  
  getTotalHeight(): number {
    return this.items.length * this.itemHeight;
  }
}

/**
 * Batch DOM updates to reduce reflows
 */
export function batchDOMUpdates(updates: Array<() => void>): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

/**
 * Detect idle time for background tasks
 */
export function requestIdleCallback(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if ('requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(callback, options);
  }
  // Fallback for browsers without requestIdleCallback
  return setTimeout(callback, options?.timeout || 50);
}

export function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Web Worker wrapper for offloading heavy computations
 */
export function createWebWorker<T, R>(
  workerFunction: (data: T) => R,
  workerName: string = 'worker'
): Worker {
  const workerCode = `
    self.onmessage = function(e) {
      const result = (${workerFunction.toString()})(e.data);
      self.postMessage(result);
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  
  return new Worker(workerUrl);
}

/**
 * Optimize list rendering with key strategies
 */
export function getOptimalListKey(item: any, index: number): string {
  // Prefer stable unique identifiers
  if (item.id) return `item-${item.id}`;
  if (item.key) return `item-${item.key}`;
  // Fallback to index (less optimal but functional)
  return `item-${index}`;
}

/**
 * Detect if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Lazy load components when they come into viewport
 */
export function useIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null;
  }
  
  return new IntersectionObserver(callback, options);
}

/**
 * Cache API wrapper for offline-first caching
 */
export class CacheManager {
  private cacheName: string;
  
  constructor(cacheName: string) {
    this.cacheName = cacheName;
  }
  
  async get(key: string): Promise<any> {
    const cache = await caches.open(this.cacheName);
    const response = await cache.match(key);
    return response ? response.json() : null;
  }
  
  async set(key: string, data: any): Promise<void> {
    const cache = await caches.open(this.cacheName);
    await cache.put(key, new Response(JSON.stringify(data)));
  }
  
  async delete(key: string): Promise<void> {
    const cache = await caches.open(this.cacheName);
    await cache.delete(key);
  }
  
  async clear(): Promise<void> {
    const cache = await caches.open(this.cacheName);
    const keys = await cache.keys();
    await Promise.all(keys.map(key => cache.delete(key)));
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }
  
  getAverageMetric(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }
  
  getMetricStats(name: string): { min: number; max: number; avg: number; count: number } {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = this.getAverageMetric(name);
    const count = values.length;
    
    return { min, max, avg, count };
  }
  
  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

/**
 * Optimize event listeners with passive option
 */
export function addPassiveEventListener(
  element: HTMLElement | Document | Window,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions
): void {
  element.addEventListener(event, handler, { passive: true, ...options });
}

/**
 * Font loading optimization
 */
export function preloadFonts(fontUrls: string[]): void {
  fontUrls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Critical CSS inlining helper
 */
export function inlineCriticalCSS(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Detect and handle low-end devices
 */
export function isLowEndDevice(): boolean {
  const connection = (navigator as any).connection;
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = (navigator as any).deviceMemory || 4;
  
  return (
    hardwareConcurrency <= 2 ||
    deviceMemory <= 2 ||
    (connection && (connection.effectiveType === '2g' || connection.saveData))
  );
}

/**
 * Adaptive quality based on device capabilities
 */
export function getAdaptiveQuality(): 'low' | 'medium' | 'high' {
  if (isLowEndDevice()) return 'low';
  if (isSlowNetwork()) return 'medium';
  return 'high';
}

/**
 * Defer non-critical JavaScript
 */
export function deferScript(src: string): void {
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  document.body.appendChild(script);
}

/**
 * Tree shaking helper for conditional imports
 */
export function dynamicImport<T>(modulePath: string): Promise<T> {
  return import(modulePath) as Promise<T>;
}