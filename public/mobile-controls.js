// Mobile Touch Controls and PWA Integration for StarForge Frontier

class MobileControls {
  constructor() {
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isMobile = this.detectMobile();
    this.virtualControls = null;
    this.touchStates = new Map();
    this.gestureData = { start: null, current: null };
    this.vibrationEnabled = 'vibrate' in navigator;
    this.orientationLocked = false;
    
    this.init();
  }
  
  detectMobile() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/.test(userAgent) ||
           (window.innerWidth <= 768 && 'ontouchstart' in window);
  }
  
  init() {
    if (this.isMobile || this.isTouch) {
      this.setupMobileUI();
      this.setupTouchControls();
      this.setupGestureHandling();
      this.setupVibration();
      this.setupOrientationHandling();
      this.setupPWAFeatures();
      
      // Add mobile CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'mobile.css';
      document.head.appendChild(link);
    }
    
    this.setupPWARegistration();
  }
  
  setupMobileUI() {
    document.body.classList.add('mobile-device');
    
    // Create mobile control overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    overlay.innerHTML = `
      <!-- Virtual D-pad -->
      <div class="virtual-dpad">
        <div class="dpad-container">
          <button class="dpad-button dpad-up" data-direction="up">↑</button>
          <button class="dpad-button dpad-down" data-direction="down">↓</button>
          <button class="dpad-button dpad-left" data-direction="left">←</button>
          <button class="dpad-button dpad-right" data-direction="right">→</button>
          <div class="dpad-center"></div>
        </div>
      </div>
      
      <!-- Action buttons -->
      <div class="mobile-action-buttons">
        <button class="mobile-action-btn" id="mobileShoot">⚡</button>
        <button class="mobile-action-btn" id="mobileTarget">🎯</button>
        <button class="mobile-action-btn primary" id="mobileBoost">🚀</button>
      </div>
      
      <!-- Menu toggle -->
      <button class="mobile-menu-toggle" id="mobileMenuToggle">☰</button>
      
      <!-- Slide-out menu -->
      <div class="mobile-menu" id="mobileMenu">
        <button class="mobile-menu-item" data-action="ship-editor">🔧 Ship Designer</button>
        <button class="mobile-menu-item" data-action="trading">💼 Trading</button>
        <button class="mobile-menu-item" data-action="galaxy">🌌 Galaxy Map</button>
        <button class="mobile-menu-item" data-action="skills">⭐ Skills</button>
        <button class="mobile-menu-item" data-action="guilds">🏛️ Guilds</button>
        <button class="mobile-menu-item" data-action="research">🧪 Research</button>
        <button class="mobile-menu-item" data-action="factions">⚔️ Factions</button>
        <button class="mobile-menu-item" data-action="settings">⚙️ Settings</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.virtualControls = overlay;
    
    this.bindMobileControls();
  }
  
  bindMobileControls() {
    // D-pad controls
    const dpadButtons = document.querySelectorAll('.dpad-button');
    dpadButtons.forEach(button => {
      button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const direction = button.dataset.direction;
        this.handleDirectionInput(direction, true);
        this.vibrate([10]);
      });
      
      button.addEventListener('touchend', (e) => {
        e.preventDefault();
        const direction = button.dataset.direction;
        this.handleDirectionInput(direction, false);
      });
    });
    
    // Action buttons
    document.getElementById('mobileShoot')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleAction('shoot');
      this.vibrate([30]);
    });
    
    document.getElementById('mobileTarget')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleAction('target');
      this.vibrate([20]);
    });
    
    document.getElementById('mobileBoost')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleAction('boost');
      this.vibrate([50]);
    });
    
    // Menu toggle
    document.getElementById('mobileMenuToggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMobileMenu();
      this.vibrate([15]);
    });
    
    // Menu items
    document.querySelectorAll('.mobile-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const action = item.dataset.action;
        this.handleMenuAction(action);
        this.vibrate([25]);
      });
    });
  }
  
  setupTouchControls() {
    const canvas = document.getElementById('game');
    if (!canvas) return;
    
    // Multi-touch support
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    
    // Prevent default touch behaviors
    document.addEventListener('touchstart', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }
  
  handleTouchStart(e) {
    e.preventDefault();
    
    for (let touch of e.changedTouches) {
      this.touchStates.set(touch.identifier, {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now()
      });
    }
    
    if (e.touches.length === 1) {
      // Single touch - potential tap or drag
      this.gestureData.start = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    } else if (e.touches.length === 2) {
      // Two finger gesture - zoom or rotate
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      this.gestureData.pinchStart = distance;
      this.gestureData.rotationStart = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );
    }
  }
  
  handleTouchMove(e) {
    e.preventDefault();
    
    for (let touch of e.changedTouches) {
      const touchState = this.touchStates.get(touch.identifier);
      if (touchState) {
        touchState.currentX = touch.clientX;
        touchState.currentY = touch.clientY;
      }
    }
    
    if (e.touches.length === 1 && this.gestureData.start) {
      // Single finger drag
      const deltaX = e.touches[0].clientX - this.gestureData.start.x;
      const deltaY = e.touches[0].clientY - this.gestureData.start.y;
      
      // Camera panning
      this.handleCameraPan(deltaX, deltaY);
      
    } else if (e.touches.length === 2) {
      // Two finger gestures
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      if (this.gestureData.pinchStart) {
        // Pinch zoom
        const scale = distance / this.gestureData.pinchStart;
        this.handlePinchZoom(scale);
      }
      
      // Rotation
      const rotation = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );
      
      if (this.gestureData.rotationStart !== undefined) {
        const rotationDelta = rotation - this.gestureData.rotationStart;
        this.handleRotation(rotationDelta);
      }
    }
  }
  
  handleTouchEnd(e) {
    e.preventDefault();
    
    for (let touch of e.changedTouches) {
      const touchState = this.touchStates.get(touch.identifier);
      if (touchState) {
        const duration = Date.now() - touchState.startTime;
        const distance = Math.sqrt(
          Math.pow(touch.clientX - touchState.startX, 2) +
          Math.pow(touch.clientY - touchState.startY, 2)
        );
        
        // Detect tap vs drag
        if (duration < 300 && distance < 10) {
          this.handleTap(touch.clientX, touch.clientY);
        }
        
        this.touchStates.delete(touch.identifier);
      }
    }
    
    // Reset gesture data
    this.gestureData = { start: null, current: null };
  }
  
  setupGestureHandling() {
    // Gesture recognition for common game actions
    this.gestureRecognizer = {
      swipeThreshold: 50,
      swipeTimeLimit: 300,
      
      recognizeSwipe: (startX, startY, endX, endY, duration) => {
        if (duration > this.gestureRecognizer.swipeTimeLimit) return null;
        
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance < this.gestureRecognizer.swipeThreshold) return null;
        
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        if (angle >= -45 && angle <= 45) return 'right';
        if (angle >= 45 && angle <= 135) return 'down';
        if (angle >= 135 || angle <= -135) return 'left';
        if (angle >= -135 && angle <= -45) return 'up';
        
        return null;
      }
    };
  }
  
  setupVibration() {
    this.vibrationPatterns = {
      tap: [10],
      shoot: [30],
      hit: [50, 50, 50],
      levelUp: [100, 100, 100, 100, 100],
      death: [200, 100, 200],
      notification: [25, 50, 25]
    };
  }
  
  vibrate(pattern) {
    if (this.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }
  
  setupOrientationHandling() {
    if ('screen' in window && 'orientation' in screen) {
      // Try to lock to landscape for better gameplay
      this.lockOrientation('landscape-primary');
    }
    
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    });
    
    // Handle device motion for ship control (optional)
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this));
    }
  }
  
  lockOrientation(orientation) {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock(orientation)
        .then(() => {
          this.orientationLocked = true;
          console.log('Orientation locked to', orientation);
        })
        .catch((error) => {
          console.log('Orientation lock failed:', error);
        });
    }
  }
  
  handleOrientationChange() {
    // Recalculate UI positions and canvas size
    setTimeout(() => {
      this.updateCanvasSize();
      this.repositionMobileUI();
    }, 200);
  }
  
  handleDeviceMotion(event) {
    // Optional: Use device motion for ship steering
    if (this.motionControlEnabled && event.accelerationIncludingGravity) {
      const x = event.accelerationIncludingGravity.x;
      const y = event.accelerationIncludingGravity.y;
      
      // Convert to ship movement (optional feature)
      this.handleMotionSteering(x, y);
    }
  }
  
  setupPWAFeatures() {
    // Setup PWA-specific features
    this.setupInstallPrompt();
    this.setupNotifications();
    this.setupBackground();
  }
  
  setupInstallPrompt() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show custom install button
      this.showInstallButton(() => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
            this.vibrate([100, 50, 100]);
          }
          deferredPrompt = null;
        });
      });
    });
    
    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.vibrate(this.vibrationPatterns.levelUp);
      this.showNotification('StarForge Frontier installed successfully!');
    });
  }
  
  setupNotifications() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      // Request notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          console.log('Notification permission:', permission);
        });
      }
      
      // Setup push notification handling
      this.setupPushNotifications();
    }
  }
  
  setupPushNotifications() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        return registration.pushManager.getSubscription();
      }).then((subscription) => {
        if (subscription === null) {
          // User is not subscribed, offer to subscribe
          this.offerPushSubscription();
        } else {
          // User is subscribed
          console.log('User is already subscribed to push notifications');
        }
      });
    }
  }
  
  setupBackground() {
    // Background sync for offline actions
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Register for background sync
        this.backgroundSync = registration.sync;
      });
    }
  }
  
  setupPWARegistration() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration);
          
          // Update available
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateNotification();
              }
            });
          });
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
      
      // Handle messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          this.showUpdateNotification();
        }
      });
    }
  }
  
  // Game integration methods
  handleDirectionInput(direction, pressed) {
    const event = new CustomEvent('mobileDirection', {
      detail: { direction, pressed }
    });
    window.dispatchEvent(event);
  }
  
  handleAction(action) {
    const event = new CustomEvent('mobileAction', {
      detail: { action }
    });
    window.dispatchEvent(event);
  }
  
  handleTap(x, y) {
    const canvas = document.getElementById('game');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = x - rect.left;
      const canvasY = y - rect.top;
      
      const event = new CustomEvent('mobileTap', {
        detail: { x: canvasX, y: canvasY }
      });
      window.dispatchEvent(event);
    }
  }
  
  handleCameraPan(deltaX, deltaY) {
    const event = new CustomEvent('mobilePan', {
      detail: { deltaX, deltaY }
    });
    window.dispatchEvent(event);
  }
  
  handlePinchZoom(scale) {
    const event = new CustomEvent('mobileZoom', {
      detail: { scale }
    });
    window.dispatchEvent(event);
  }
  
  handleRotation(rotation) {
    const event = new CustomEvent('mobileRotation', {
      detail: { rotation }
    });
    window.dispatchEvent(event);
  }
  
  handleMenuAction(action) {
    // Convert menu actions to keyboard events
    const keyMap = {
      'ship-editor': 'KeyB',
      'trading': 'KeyT',
      'galaxy': 'KeyG',
      'skills': 'KeyK',
      'guilds': 'KeyU',
      'research': 'KeyR',
      'factions': 'KeyF',
      'settings': 'Escape'
    };
    
    const keyCode = keyMap[action];
    if (keyCode) {
      const event = new KeyboardEvent('keydown', {
        code: keyCode,
        key: keyCode.replace('Key', '').toLowerCase()
      });
      window.dispatchEvent(event);
    }
    
    this.toggleMobileMenu();
  }
  
  toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
      menu.classList.toggle('open');
    }
  }
  
  // UI helper methods
  updateCanvasSize() {
    const canvas = document.getElementById('game');
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Notify game of resize
      const event = new CustomEvent('mobileResize', {
        detail: { width: window.innerWidth, height: window.innerHeight }
      });
      window.dispatchEvent(event);
    }
  }
  
  repositionMobileUI() {
    // Adjust UI positions based on orientation and safe areas
    if (this.virtualControls) {
      const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0');
      const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
      
      // Adjust for safe areas
      this.virtualControls.style.paddingTop = safeAreaTop + 'px';
      this.virtualControls.style.paddingBottom = safeAreaBottom + 'px';
    }
  }
  
  showInstallButton(onInstall) {
    const installButton = document.createElement('button');
    installButton.textContent = 'Install StarForge';
    installButton.className = 'mobile-menu-item install-btn';
    installButton.onclick = onInstall;
    
    const menu = document.getElementById('mobileMenu');
    if (menu) {
      menu.appendChild(installButton);
    }
  }
  
  showUpdateNotification() {
    if (Notification.permission === 'granted') {
      new Notification('StarForge Frontier', {
        body: 'A new version is available! Restart to update.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'update-available'
      });
    }
  }
  
  showNotification(message, options = {}) {
    if (Notification.permission === 'granted') {
      new Notification('StarForge Frontier', {
        body: message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: this.vibrationPatterns.notification,
        ...options
      });
    }
  }
  
  offerPushSubscription() {
    // Show UI to enable push notifications
    const subscribeButton = document.createElement('button');
    subscribeButton.textContent = 'Enable Notifications';
    subscribeButton.className = 'mobile-menu-item';
    subscribeButton.onclick = () => this.subscribeToPush();
    
    const menu = document.getElementById('mobileMenu');
    if (menu) {
      menu.appendChild(subscribeButton);
    }
  }
  
  async subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'YOUR_VAPID_PUBLIC_KEY' // Replace with actual VAPID key
        )
      });
      
      // Send subscription to server
      await fetch('/api/subscribe-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      
      this.showNotification('Push notifications enabled!');
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  }
  
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Initialize mobile controls when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.mobileControls = new MobileControls();
  });
} else {
  window.mobileControls = new MobileControls();
}

// Export for use in other scripts
window.MobileControls = MobileControls;