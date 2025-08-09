// Mobile Performance Optimization for StarForge Frontier

class MobilePerformanceOptimizer {
  constructor() {
    this.isLowEndDevice = this.detectLowEndDevice();
    this.currentPerformanceMode = 'auto';
    this.frameSkipCounter = 0;
    this.performanceStats = {
      fps: 60,
      drawCalls: 0,
      lastFrameTime: 0,
      avgFrameTime: 16.67 // Target 60 FPS
    };
    this.optimizations = {
      reduceParticles: false,
      skipNonEssentialAnimations: false,
      lowerTextureQuality: false,
      reduceDrawDistance: false,
      enableFrameSkipping: false,
      disableBloom: false,
      simplifyUI: false
    };
    
    this.init();
  }
  
  detectLowEndDevice() {
    // Detect low-end devices based on various metrics
    const memory = navigator.deviceMemory || 4; // Default to 4GB if not available
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for known low-end indicators
    const isLowEndCPU = hardwareConcurrency <= 2;
    const isLowEndRAM = memory <= 2;
    const isOldMobile = /android [1-6]|iphone os [1-9]|ipad.*os [1-9]/.test(userAgent);
    
    return isLowEndCPU || isLowEndRAM || isOldMobile;
  }
  
  init() {
    this.setupPerformanceMonitoring();
    this.applyInitialOptimizations();
    this.setupAdaptivePerformance();
    
    console.log(`Mobile Performance Optimizer initialized. Low-end device: ${this.isLowEndDevice}`);
  }
  
  setupPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measurePerformance = (timestamp) => {
      frameCount++;
      
      // Calculate frame time
      const frameTime = timestamp - this.performanceStats.lastFrameTime;
      this.performanceStats.lastFrameTime = timestamp;
      
      // Update average frame time (exponential moving average)
      this.performanceStats.avgFrameTime = 
        this.performanceStats.avgFrameTime * 0.9 + frameTime * 0.1;
      
      // Calculate FPS every second
      if (timestamp - lastTime >= 1000) {
        this.performanceStats.fps = frameCount * 1000 / (timestamp - lastTime);
        frameCount = 0;
        lastTime = timestamp;
        
        // Adaptive performance adjustment
        this.adjustPerformanceSettings();
      }
      
      requestAnimationFrame(measurePerformance);
    };
    
    requestAnimationFrame(measurePerformance);
  }
  
  applyInitialOptimizations() {
    if (this.isLowEndDevice) {
      this.enableOptimization('reduceParticles');
      this.enableOptimization('lowerTextureQuality');
      this.enableOptimization('simplifyUI');
      
      // Reduce animation frame rate for low-end devices
      this.setTargetFPS(30);
    }
    
    // Mobile-specific optimizations
    if (this.isMobile()) {
      this.optimizeForMobile();
    }
  }
  
  setupAdaptivePerformance() {
    // Monitor performance and adjust settings dynamically
    setInterval(() => {
      const currentFPS = this.performanceStats.fps;
      
      if (currentFPS < 20) {
        // Performance is very poor, enable aggressive optimizations
        this.setPerformanceMode('low');
      } else if (currentFPS < 30) {
        // Performance is poor, enable medium optimizations
        this.setPerformanceMode('medium');
      } else if (currentFPS > 50) {
        // Performance is good, reduce optimizations if any
        this.setPerformanceMode('high');
      }
    }, 5000); // Check every 5 seconds
  }
  
  adjustPerformanceSettings() {
    const fps = this.performanceStats.fps;
    const avgFrameTime = this.performanceStats.avgFrameTime;
    
    // If frame time is consistently high, enable optimizations
    if (avgFrameTime > 33) { // Below 30 FPS
      if (!this.optimizations.reduceParticles) {
        this.enableOptimization('reduceParticles');
        console.log('Enabled particle reduction due to low performance');
      }
      
      if (!this.optimizations.skipNonEssentialAnimations) {
        this.enableOptimization('skipNonEssentialAnimations');
        console.log('Disabled non-essential animations due to low performance');
      }
    }
    
    // If performance improves, gradually disable optimizations
    if (avgFrameTime < 20 && fps > 45) { // Above 45 FPS consistently
      if (this.optimizations.skipNonEssentialAnimations) {
        this.disableOptimization('skipNonEssentialAnimations');
        console.log('Re-enabled animations due to improved performance');
      }
    }
  }
  
  setPerformanceMode(mode) {
    if (this.currentPerformanceMode === mode) return;
    
    console.log(`Switching to ${mode} performance mode`);
    this.currentPerformanceMode = mode;
    
    switch (mode) {
      case 'low':
        this.enableOptimization('reduceParticles');
        this.enableOptimization('skipNonEssentialAnimations');
        this.enableOptimization('lowerTextureQuality');
        this.enableOptimization('reduceDrawDistance');
        this.enableOptimization('enableFrameSkipping');
        this.enableOptimization('disableBloom');
        this.enableOptimization('simplifyUI');
        this.setTargetFPS(30);
        break;
        
      case 'medium':
        this.enableOptimization('reduceParticles');
        this.enableOptimization('lowerTextureQuality');
        this.enableOptimization('simplifyUI');
        this.disableOptimization('skipNonEssentialAnimations');
        this.disableOptimization('enableFrameSkipping');
        this.disableOptimization('disableBloom');
        this.setTargetFPS(45);
        break;
        
      case 'high':
        this.disableOptimization('reduceParticles');
        this.disableOptimization('skipNonEssentialAnimations');
        this.disableOptimization('lowerTextureQuality');
        this.disableOptimization('reduceDrawDistance');
        this.disableOptimization('enableFrameSkipping');
        this.disableOptimization('disableBloom');
        this.disableOptimization('simplifyUI');
        this.setTargetFPS(60);
        break;
    }
    
    // Notify the game engine of performance mode change
    this.dispatchPerformanceEvent('modeChanged', { mode, optimizations: this.optimizations });
  }
  
  enableOptimization(name) {
    if (this.optimizations.hasOwnProperty(name)) {
      this.optimizations[name] = true;
      this.applyOptimization(name, true);
    }
  }
  
  disableOptimization(name) {
    if (this.optimizations.hasOwnProperty(name)) {
      this.optimizations[name] = false;
      this.applyOptimization(name, false);
    }
  }
  
  applyOptimization(name, enabled) {
    switch (name) {
      case 'reduceParticles':
        this.setMaxParticles(enabled ? 50 : 200);
        break;
        
      case 'skipNonEssentialAnimations':
        this.setAnimationQuality(enabled ? 'low' : 'high');
        break;
        
      case 'lowerTextureQuality':
        this.setTextureQuality(enabled ? 'low' : 'high');
        break;
        
      case 'reduceDrawDistance':
        this.setDrawDistance(enabled ? 500 : 1000);
        break;
        
      case 'enableFrameSkipping':
        this.setFrameSkipping(enabled);
        break;
        
      case 'disableBloom':
        this.setBloomEffect(!enabled);
        break;
        
      case 'simplifyUI':
        this.setUIComplexity(enabled ? 'simple' : 'full');
        break;
    }
    
    // Dispatch event for game engine to respond
    this.dispatchPerformanceEvent('optimizationChanged', { name, enabled });
  }
  
  setMaxParticles(maxCount) {
    this.dispatchPerformanceEvent('setMaxParticles', { maxCount });
  }
  
  setAnimationQuality(quality) {
    this.dispatchPerformanceEvent('setAnimationQuality', { quality });
  }
  
  setTextureQuality(quality) {
    this.dispatchPerformanceEvent('setTextureQuality', { quality });
  }
  
  setDrawDistance(distance) {
    this.dispatchPerformanceEvent('setDrawDistance', { distance });
  }
  
  setFrameSkipping(enabled) {
    this.frameSkippingEnabled = enabled;
    this.dispatchPerformanceEvent('setFrameSkipping', { enabled });
  }
  
  setBloomEffect(enabled) {
    this.dispatchPerformanceEvent('setBloomEffect', { enabled });
  }
  
  setUIComplexity(complexity) {
    const uiElements = document.querySelectorAll('.complex-ui');
    uiElements.forEach(el => {
      if (complexity === 'simple') {
        el.classList.add('simplified');
      } else {
        el.classList.remove('simplified');
      }
    });
    
    this.dispatchPerformanceEvent('setUIComplexity', { complexity });
  }
  
  setTargetFPS(fps) {
    this.targetFPS = fps;
    this.targetFrameTime = 1000 / fps;
    this.dispatchPerformanceEvent('setTargetFPS', { fps });
  }
  
  optimizeForMobile() {
    // Mobile-specific optimizations
    
    // Reduce precision for floating point calculations
    this.dispatchPerformanceEvent('setFloatPrecision', { precision: 'medium' });
    
    // Optimize touch event handling
    this.optimizeTouchEvents();
    
    // Reduce audio quality on mobile
    this.dispatchPerformanceEvent('setAudioQuality', { quality: 'compressed' });
    
    // Enable hardware acceleration hints
    this.enableHardwareAcceleration();
    
    // Optimize memory usage
    this.optimizeMemoryUsage();
  }
  
  optimizeTouchEvents() {
    // Use passive listeners where possible
    const passiveOptions = { passive: true };
    
    // Replace existing touch event listeners with optimized ones
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), passiveOptions);
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), passiveOptions);
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), passiveOptions);
  }
  
  handleTouchStart(e) {
    // Optimized touch start handling
    this.lastTouchTime = performance.now();
  }
  
  handleTouchMove(e) {
    // Throttle touch move events
    const now = performance.now();
    if (now - this.lastTouchTime < 16) return; // Limit to 60 FPS
    
    this.lastTouchTime = now;
  }
  
  handleTouchEnd(e) {
    // Optimized touch end handling
  }
  
  enableHardwareAcceleration() {
    // Apply CSS transforms that trigger hardware acceleration
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) {
      gameCanvas.style.transform = 'translateZ(0)';
      gameCanvas.style.willChange = 'transform';
    }
    
    // Enable hardware acceleration for UI elements
    const uiElements = document.querySelectorAll('.hud-section, .panel, .mobile-controls');
    uiElements.forEach(el => {
      el.style.transform = 'translateZ(0)';
      el.style.willChange = 'auto';
    });
  }
  
  optimizeMemoryUsage() {
    // Implement memory optimization strategies
    
    // Garbage collection hints
    if (window.gc && this.isLowEndDevice) {
      setInterval(() => {
        window.gc();
      }, 30000); // Force GC every 30 seconds on low-end devices
    }
    
    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (memoryUsage > 0.8) {
          console.warn('High memory usage detected:', memoryUsage);
          this.dispatchPerformanceEvent('highMemoryUsage', { usage: memoryUsage });
        }
      }, 10000);
    }
  }
  
  shouldSkipFrame() {
    if (!this.optimizations.enableFrameSkipping) return false;
    
    this.frameSkipCounter++;
    const skipEveryNthFrame = this.targetFPS === 30 ? 2 : 1;
    
    if (this.frameSkipCounter >= skipEveryNthFrame) {
      this.frameSkipCounter = 0;
      return true;
    }
    
    return false;
  }
  
  dispatchPerformanceEvent(type, data) {
    window.dispatchEvent(new CustomEvent('performanceOptimization', {
      detail: { type, data }
    }));
  }
  
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && 'ontouchstart' in window);
  }
  
  // Public API methods
  getPerformanceStats() {
    return { ...this.performanceStats };
  }
  
  getCurrentOptimizations() {
    return { ...this.optimizations };
  }
  
  setUserPreference(preference, value) {
    switch (preference) {
      case 'preferredFPS':
        this.setTargetFPS(value);
        break;
      case 'qualityLevel':
        this.setPerformanceMode(value);
        break;
      case 'particleEffects':
        if (value) {
          this.disableOptimization('reduceParticles');
        } else {
          this.enableOptimization('reduceParticles');
        }
        break;
    }
    
    // Save preference to localStorage
    localStorage.setItem(`pref_${preference}`, JSON.stringify(value));
  }
  
  getUserPreference(preference, defaultValue) {
    const stored = localStorage.getItem(`pref_${preference}`);
    return stored ? JSON.parse(stored) : defaultValue;
  }
  
  // Battery optimization
  setupBatteryOptimization() {
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        const handleBatteryLevel = () => {
          if (battery.level < 0.2) { // Below 20%
            this.setPerformanceMode('low');
            console.log('Low battery detected, switching to power saving mode');
          } else if (battery.level > 0.5 && !battery.charging) {
            this.setPerformanceMode('medium');
          }
        };
        
        battery.addEventListener('levelchange', handleBatteryLevel);
        battery.addEventListener('chargingchange', handleBatteryLevel);
        
        handleBatteryLevel(); // Initial check
      });
    }
  }
  
  // Network optimization
  setupNetworkOptimization() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      const handleConnectionChange = () => {
        const effectiveType = connection.effectiveType;
        
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          this.dispatchPerformanceEvent('setNetworkQuality', { quality: 'low' });
        } else if (effectiveType === '3g') {
          this.dispatchPerformanceEvent('setNetworkQuality', { quality: 'medium' });
        } else {
          this.dispatchPerformanceEvent('setNetworkQuality', { quality: 'high' });
        }
      };
      
      connection.addEventListener('change', handleConnectionChange);
      handleConnectionChange(); // Initial check
    }
  }
}

// Initialize performance optimizer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.mobilePerformanceOptimizer = new MobilePerformanceOptimizer();
  });
} else {
  window.mobilePerformanceOptimizer = new MobilePerformanceOptimizer();
}

// Export for use in other scripts
window.MobilePerformanceOptimizer = MobilePerformanceOptimizer;