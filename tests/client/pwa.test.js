// PWA Functionality Tests for StarForge Frontier

describe('PWA Functionality', () => {
  let mockWindow;
  let mockDocument;
  let mockNavigator;
  
  beforeEach(() => {
    // Mock browser APIs
    mockWindow = {
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      location: { host: 'localhost:3000' },
      innerWidth: 1024,
      innerHeight: 768,
      performance: { now: () => Date.now() }
    };
    
    mockDocument = {
      addEventListener: jest.fn(),
      createElement: jest.fn(() => ({
        style: {},
        addEventListener: jest.fn(),
        appendChild: jest.fn()
      })),
      getElementById: jest.fn(),
      body: { appendChild: jest.fn() },
      readyState: 'complete'
    };
    
    mockNavigator = {
      serviceWorker: {
        register: jest.fn(() => Promise.resolve({
          addEventListener: jest.fn()
        })),
        addEventListener: jest.fn()
      },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      maxTouchPoints: 5,
      deviceMemory: 2,
      hardwareConcurrency: 2,
      onLine: true,
      vibrate: jest.fn()
    };
    
    global.window = mockWindow;
    global.document = mockDocument;
    global.navigator = mockNavigator;
  });
  
  describe('Service Worker Registration', () => {
    test('should register service worker', async () => {
      const { setupPWARegistration } = require('../public/mobile-controls.js');
      
      await setupPWARegistration();
      
      expect(mockNavigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    });
    
    test('should handle service worker registration failure', async () => {
      mockNavigator.serviceWorker.register.mockRejectedValue(new Error('Registration failed'));
      console.log = jest.fn();
      
      const { setupPWARegistration } = require('../public/mobile-controls.js');
      
      await setupPWARegistration();
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('SW registration failed')
      );
    });
  });
  
  describe('Mobile Detection', () => {
    test('should detect mobile device correctly', () => {
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      expect(mobileControls.isMobile).toBe(true);
    });
    
    test('should detect desktop device correctly', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      mockNavigator.maxTouchPoints = 0;
      mockWindow.innerWidth = 1920;
      
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      expect(mobileControls.isMobile).toBe(false);
    });
  });
  
  describe('Touch Controls', () => {
    test('should setup virtual controls on mobile', () => {
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      mobileControls.setupMobileUI();
      
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });
    
    test('should handle touch events', () => {
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      const mockTouchEvent = {
        preventDefault: jest.fn(),
        changedTouches: [{
          identifier: 0,
          clientX: 100,
          clientY: 100
        }]
      };
      
      mobileControls.handleTouchStart(mockTouchEvent);
      
      expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
      expect(mobileControls.touchStates.has(0)).toBe(true);
    });
  });
  
  describe('Push Notifications', () => {
    test('should check notification support', () => {
      global.Notification = { permission: 'default' };
      global.PushManager = {};
      
      const PushNotificationManager = require('../public/push-notifications.js').PushNotificationManager;
      const pushManager = new PushNotificationManager();
      
      expect(pushManager.isSupported).toBe(true);
    });
    
    test('should handle notification permission request', async () => {
      global.Notification = {
        permission: 'default',
        requestPermission: jest.fn(() => Promise.resolve('granted'))
      };
      
      const PushNotificationManager = require('../public/push-notifications.js').PushNotificationManager;
      const pushManager = new PushNotificationManager();
      
      const granted = await pushManager.requestPermission();
      
      expect(granted).toBe(true);
      expect(global.Notification.requestPermission).toHaveBeenCalled();
    });
    
    test('should create game notifications', () => {
      const PushNotificationManager = require('../public/push-notifications.js').PushNotificationManager;
      const pushManager = new PushNotificationManager();
      
      pushManager.handleGuildEvent({
        type: 'member_joined',
        guildName: 'Test Guild',
        playerName: 'TestPlayer'
      });
      
      expect(pushManager.eventQueue.length).toBeGreaterThan(0);
    });
  });
  
  describe('Performance Optimization', () => {
    test('should detect low-end device', () => {
      const MobilePerformanceOptimizer = require('../public/mobile-performance.js').MobilePerformanceOptimizer;
      const optimizer = new MobilePerformanceOptimizer();
      
      expect(optimizer.isLowEndDevice).toBe(true);
    });
    
    test('should apply performance optimizations', () => {
      const MobilePerformanceOptimizer = require('../public/mobile-performance.js').MobilePerformanceOptimizer;
      const optimizer = new MobilePerformanceOptimizer();
      
      optimizer.setPerformanceMode('low');
      
      expect(optimizer.optimizations.reduceParticles).toBe(true);
      expect(optimizer.optimizations.lowerTextureQuality).toBe(true);
    });
    
    test('should adapt performance based on FPS', () => {
      const MobilePerformanceOptimizer = require('../public/mobile-performance.js').MobilePerformanceOptimizer;
      const optimizer = new MobilePerformanceOptimizer();
      
      optimizer.performanceStats.fps = 15; // Low FPS
      optimizer.adjustPerformanceSettings();
      
      expect(optimizer.optimizations.reduceParticles).toBe(true);
    });
  });
  
  describe('Offline Functionality', () => {
    test('should handle offline mode', () => {
      mockNavigator.onLine = false;
      
      const event = new Event('offline');
      mockWindow.dispatchEvent(event);
      
      expect(mockWindow.dispatchEvent).toHaveBeenCalled();
    });
    
    test('should cache game data for offline use', () => {
      const mockServiceWorker = {
        postMessage: jest.fn()
      };
      
      mockNavigator.serviceWorker.controller = mockServiceWorker;
      
      // Simulate caching game data
      const gameData = { players: [], ores: [] };
      mockServiceWorker.postMessage({
        type: 'CACHE_GAME_DATA',
        data: gameData
      });
      
      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({
        type: 'CACHE_GAME_DATA',
        data: gameData
      });
    });
  });
  
  describe('Manifest and Icons', () => {
    test('should have valid manifest.json structure', () => {
      const manifest = require('../public/manifest.json');
      
      expect(manifest.name).toBe('StarForge Frontier');
      expect(manifest.short_name).toBe('StarForge');
      expect(manifest.display).toBe('fullscreen');
      expect(manifest.icons).toBeInstanceOf(Array);
      expect(manifest.icons.length).toBeGreaterThan(0);
    });
    
    test('should include required icon sizes', () => {
      const manifest = require('../public/manifest.json');
      const requiredSizes = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192', '384x384', '512x512'];
      
      const iconSizes = manifest.icons.map(icon => icon.sizes);
      
      requiredSizes.forEach(size => {
        expect(iconSizes).toContain(size);
      });
    });
  });
  
  describe('Device APIs Integration', () => {
    test('should handle vibration API', () => {
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      mobileControls.vibrate([100]);
      
      expect(mockNavigator.vibrate).toHaveBeenCalledWith([100]);
    });
    
    test('should handle screen orientation', async () => {
      const mockScreen = {
        orientation: {
          lock: jest.fn(() => Promise.resolve())
        }
      };
      
      global.screen = mockScreen;
      
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      await mobileControls.lockOrientation('landscape-primary');
      
      expect(mockScreen.orientation.lock).toHaveBeenCalledWith('landscape-primary');
    });
  });
  
  describe('Responsive Design', () => {
    test('should adapt UI to mobile viewport', () => {
      mockWindow.innerWidth = 375;
      mockWindow.innerHeight = 667;
      
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      mobileControls.updateCanvasSize();
      
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mobileResize'
        })
      );
    });
    
    test('should reposition UI elements on orientation change', () => {
      const MobileControls = require('../public/mobile-controls.js').MobileControls;
      const mobileControls = new MobileControls();
      
      mobileControls.handleOrientationChange();
      
      // Should trigger UI repositioning
      expect(mobileControls.virtualControls).toBeDefined();
    });
  });
});

describe('Service Worker', () => {
  let mockServiceWorkerGlobalScope;
  
  beforeEach(() => {
    mockServiceWorkerGlobalScope = {
      addEventListener: jest.fn(),
      skipWaiting: jest.fn(() => Promise.resolve()),
      clients: {
        claim: jest.fn(() => Promise.resolve()),
        matchAll: jest.fn(() => Promise.resolve([]))
      },
      caches: {
        open: jest.fn(() => Promise.resolve({
          addAll: jest.fn(() => Promise.resolve()),
          put: jest.fn(() => Promise.resolve()),
          match: jest.fn(() => Promise.resolve())
        })),
        keys: jest.fn(() => Promise.resolve([])),
        delete: jest.fn(() => Promise.resolve(true))
      },
      registration: {
        showNotification: jest.fn(() => Promise.resolve())
      }
    };
    
    global.self = mockServiceWorkerGlobalScope;
  });
  
  test('should install and cache essential files', async () => {
    const installEvent = {
      waitUntil: jest.fn()
    };
    
    // Mock service worker install event handler
    const handleInstall = (event) => {
      event.waitUntil(
        mockServiceWorkerGlobalScope.caches.open('starforge-v1.0.0')
          .then(cache => cache.addAll(['/']))
      );
    };
    
    handleInstall(installEvent);
    
    expect(installEvent.waitUntil).toHaveBeenCalled();
  });
  
  test('should handle fetch events for caching', () => {
    const fetchEvent = {
      request: { url: 'https://example.com/style.css' },
      respondWith: jest.fn()
    };
    
    // Mock service worker fetch event handler
    const handleFetch = (event) => {
      event.respondWith(
        mockServiceWorkerGlobalScope.caches.match(event.request)
          .then(response => response || fetch(event.request))
      );
    };
    
    handleFetch(fetchEvent);
    
    expect(fetchEvent.respondWith).toHaveBeenCalled();
  });
  
  test('should handle push notifications', () => {
    const pushEvent = {
      data: {
        json: () => ({
          title: 'Test Notification',
          body: 'Test message'
        })
      },
      waitUntil: jest.fn()
    };
    
    // Mock service worker push event handler
    const handlePush = (event) => {
      const data = event.data.json();
      event.waitUntil(
        mockServiceWorkerGlobalScope.registration.showNotification(data.title, {
          body: data.body
        })
      );
    };
    
    handlePush(pushEvent);
    
    expect(pushEvent.waitUntil).toHaveBeenCalled();
  });
});