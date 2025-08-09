// Push Notification System for StarForge Frontier PWA

class PushNotificationManager {
  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    this.subscription = null;
    this.vapidPublicKey = 'BN4GvZtEZiZuqaaUvfKVBP4cHccCMDXHm-Lx7A-ZH-XlLQp_W9_hqYqvQoNgX3n_Kt-YnE_Nz0_vG-fzAHZQ8'; // Replace with actual key
    this.permissionState = Notification.permission;
    this.eventQueue = [];
    
    this.init();
  }
  
  async init() {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      this.registration = registration;
      
      // Check existing subscription
      this.subscription = await registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('User is already subscribed to push notifications');
        await this.sendSubscriptionToServer();
      }
      
      this.setupMessageHandling();
      this.setupGameEventListeners();
      
    } catch (error) {
      console.error('Push notification initialization failed:', error);
    }
  }
  
  async requestPermission() {
    if (this.permissionState === 'granted') {
      return true;
    }
    
    if (this.permissionState === 'denied') {
      console.warn('Push notifications are blocked by the user');
      return false;
    }
    
    try {
      this.permissionState = await Notification.requestPermission();
      return this.permissionState === 'granted';
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }
  
  async subscribe() {
    if (!await this.requestPermission()) {
      return false;
    }
    
    try {
      const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
      
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
      
      console.log('User subscribed to push notifications');
      await this.sendSubscriptionToServer();
      
      // Show success notification
      this.showLocalNotification(
        'Notifications Enabled!',
        'You\'ll now receive updates about guild events, research progress, and faction activities.',
        { tag: 'subscription-success' }
      );
      
      return true;
      
    } catch (error) {
      console.error('Push subscription failed:', error);
      return false;
    }
  }
  
  async unsubscribe() {
    if (!this.subscription) {
      return true;
    }
    
    try {
      const successful = await this.subscription.unsubscribe();
      
      if (successful) {
        this.subscription = null;
        await this.removeSubscriptionFromServer();
        console.log('User unsubscribed from push notifications');
      }
      
      return successful;
      
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      return false;
    }
  }
  
  async sendSubscriptionToServer() {
    if (!this.subscription) return;
    
    try {
      const response = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: this.subscription,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      console.log('Subscription sent to server successfully');
      
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }
  
  async removeSubscriptionFromServer() {
    try {
      await fetch('/api/push-unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription?.endpoint
        })
      });
      
      console.log('Subscription removed from server');
      
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }
  
  setupMessageHandling() {
    // Listen for messages from the service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'NOTIFICATION_CLICKED':
          this.handleNotificationClick(data);
          break;
        case 'PUSH_RECEIVED':
          this.handlePushMessage(data);
          break;
        case 'BACKGROUND_SYNC':
          this.handleBackgroundSync(data);
          break;
      }
    });
  }
  
  setupGameEventListeners() {
    // Listen for game events that should trigger notifications
    window.addEventListener('guildEvent', (e) => this.handleGuildEvent(e.detail));
    window.addEventListener('researchComplete', (e) => this.handleResearchEvent(e.detail));
    window.addEventListener('factionUpdate', (e) => this.handleFactionEvent(e.detail));
    window.addEventListener('tradeComplete', (e) => this.handleTradeEvent(e.detail));
    window.addEventListener('combatResult', (e) => this.handleCombatEvent(e.detail));
    window.addEventListener('playerLevelUp', (e) => this.handleLevelUpEvent(e.detail));
    window.addEventListener('achievementUnlocked', (e) => this.handleAchievementEvent(e.detail));
  }
  
  // Game event handlers
  handleGuildEvent(data) {
    const { type, guildName, message, priority = 'normal' } = data;
    
    const notifications = {
      'member_joined': {
        title: `Guild Update - ${guildName}`,
        body: `${data.playerName} has joined your guild!`,
        icon: '🏛️',
        tag: 'guild-member'
      },
      'member_left': {
        title: `Guild Update - ${guildName}`,
        body: `${data.playerName} has left your guild`,
        icon: '👋',
        tag: 'guild-member'
      },
      'war_declared': {
        title: `Guild War - ${guildName}`,
        body: `War has been declared against ${data.targetGuild}!`,
        icon: '⚔️',
        tag: 'guild-war',
        priority: 'high'
      },
      'mission_available': {
        title: `Guild Mission - ${guildName}`,
        body: `New guild mission available: ${data.missionName}`,
        icon: '🎯',
        tag: 'guild-mission'
      },
      'territory_captured': {
        title: `Territory Captured - ${guildName}`,
        body: `Your guild has captured ${data.territoryName}!`,
        icon: '🏆',
        tag: 'guild-victory'
      }
    };
    
    const notification = notifications[type];
    if (notification) {
      this.queueNotification(notification, priority);
    }
  }
  
  handleResearchEvent(data) {
    const { type, techName, timeRemaining, category } = data;
    
    const notifications = {
      'research_complete': {
        title: 'Research Complete!',
        body: `${techName} research has been completed`,
        icon: '🧪',
        tag: 'research-complete'
      },
      'research_available': {
        title: 'New Research Available',
        body: `You can now research ${techName} in ${category}`,
        icon: '🔬',
        tag: 'research-available'
      },
      'research_milestone': {
        title: 'Research Milestone',
        body: `${techName} is ${Math.round((1 - timeRemaining) * 100)}% complete`,
        icon: '📊',
        tag: 'research-progress'
      },
      'breakthrough': {
        title: 'Scientific Breakthrough!',
        body: `Your scientists have made a breakthrough in ${category}!`,
        icon: '💡',
        tag: 'research-breakthrough',
        priority: 'high'
      }
    };
    
    const notification = notifications[type];
    if (notification) {
      this.queueNotification(notification, data.priority || 'normal');
    }
  }
  
  handleFactionEvent(data) {
    const { type, factionName, reputation, message } = data;
    
    const notifications = {
      'reputation_changed': {
        title: `Faction Relations - ${factionName}`,
        body: `Your reputation with ${factionName} is now ${reputation}`,
        icon: reputation > 0 ? '👍' : '👎',
        tag: 'faction-reputation'
      },
      'war_declared': {
        title: `War Declaration - ${factionName}`,
        body: `${factionName} has declared war on you!`,
        icon: '⚔️',
        tag: 'faction-war',
        priority: 'high'
      },
      'alliance_formed': {
        title: `Alliance Formed - ${factionName}`,
        body: `You are now allied with ${factionName}`,
        icon: '🤝',
        tag: 'faction-alliance'
      },
      'trade_embargo': {
        title: `Trade Embargo - ${factionName}`,
        body: `${factionName} has placed a trade embargo on your goods`,
        icon: '🚫',
        tag: 'faction-embargo'
      },
      'bounty_placed': {
        title: `Bounty Alert - ${factionName}`,
        body: `${factionName} has placed a bounty on your head!`,
        icon: '💰',
        tag: 'faction-bounty',
        priority: 'high'
      }
    };
    
    const notification = notifications[type];
    if (notification) {
      this.queueNotification(notification, data.priority || 'normal');
    }
  }
  
  handleTradeEvent(data) {
    const { type, profit, itemName, stationName } = data;
    
    const notifications = {
      'trade_complete': {
        title: 'Trade Completed',
        body: `Sold ${itemName} for ${profit} credits at ${stationName}`,
        icon: '💰',
        tag: 'trade-success'
      },
      'market_crash': {
        title: 'Market Alert',
        body: `${itemName} prices have crashed at ${stationName}`,
        icon: '📉',
        tag: 'market-alert'
      },
      'high_demand': {
        title: 'High Demand Alert',
        body: `${itemName} is in high demand at ${stationName}`,
        icon: '📈',
        tag: 'market-opportunity'
      }
    };
    
    const notification = notifications[type];
    if (notification) {
      this.queueNotification(notification);
    }
  }
  
  handleCombatEvent(data) {
    const { type, enemy, damage, reward } = data;
    
    const notifications = {
      'victory': {
        title: 'Combat Victory!',
        body: `You defeated ${enemy} and earned ${reward} credits`,
        icon: '🏆',
        tag: 'combat-victory'
      },
      'defeat': {
        title: 'Combat Defeat',
        body: `You were defeated by ${enemy}`,
        icon: '💥',
        tag: 'combat-defeat'
      },
      'critical_damage': {
        title: 'Ship Damaged!',
        body: `Your ship has taken critical damage (${damage}% hull)`,
        icon: '⚠️',
        tag: 'ship-damage',
        priority: 'high'
      }
    };
    
    const notification = notifications[type];
    if (notification) {
      this.queueNotification(notification, data.priority || 'normal');
    }
  }
  
  handleLevelUpEvent(data) {
    this.queueNotification({
      title: 'Level Up!',
      body: `Congratulations! You reached level ${data.newLevel}`,
      icon: '⭐',
      tag: 'level-up'
    }, 'high');
  }
  
  handleAchievementEvent(data) {
    this.queueNotification({
      title: 'Achievement Unlocked!',
      body: `${data.name}: ${data.description}`,
      icon: '🏅',
      tag: 'achievement'
    }, 'high');
  }
  
  queueNotification(notification, priority = 'normal') {
    if (!this.subscription || this.permissionState !== 'granted') {
      // Store for later if user subscribes
      this.eventQueue.push({ ...notification, priority, timestamp: Date.now() });
      return;
    }
    
    // Send to server for push delivery
    this.sendPushNotification(notification, priority);
    
    // Also show local notification if app is open
    if (document.visibilityState === 'visible') {
      this.showLocalNotification(notification.title, notification.body, {
        icon: `/icons/notification-${notification.icon}.png`,
        tag: notification.tag
      });
    }
  }
  
  async sendPushNotification(notification, priority = 'normal') {
    try {
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: this.subscription,
          notification: notification,
          priority: priority
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send push notification: ${response.status}`);
      }
      
    } catch (error) {
      console.error('Failed to send push notification:', error);
      
      // Fallback to local notification
      this.showLocalNotification(notification.title, notification.body, {
        icon: `/icons/notification-icon.png`,
        tag: notification.tag
      });
    }
  }
  
  showLocalNotification(title, body, options = {}) {
    if (this.permissionState !== 'granted') {
      return;
    }
    
    const defaultOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      silent: false,
      ...options
    };
    
    new Notification(title, {
      body: body,
      ...defaultOptions
    });
  }
  
  handleNotificationClick(data) {
    const { tag, action, url } = data;
    
    // Handle different notification types
    switch (tag) {
      case 'guild-war':
      case 'guild-mission':
        this.openGuildInterface();
        break;
      case 'research-complete':
      case 'research-available':
        this.openResearchInterface();
        break;
      case 'faction-war':
      case 'faction-reputation':
        this.openFactionInterface();
        break;
      case 'market-alert':
      case 'trade-success':
        this.openTradingInterface();
        break;
      case 'combat-victory':
      case 'combat-defeat':
        this.focusGame();
        break;
      default:
        if (url) {
          window.location.href = url;
        } else {
          this.focusGame();
        }
    }
  }
  
  handlePushMessage(data) {
    // Handle incoming push messages
    console.log('Push message received:', data);
    
    // Update game state if necessary
    if (data.gameUpdate) {
      window.dispatchEvent(new CustomEvent('gameStateUpdate', {
        detail: data.gameUpdate
      }));
    }
  }
  
  handleBackgroundSync(data) {
    // Handle background sync events
    console.log('Background sync:', data);
    
    if (data.type === 'offline-actions') {
      this.processOfflineActions(data.actions);
    }
  }
  
  // UI integration methods
  openGuildInterface() {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyU',
      key: 'u'
    });
    window.dispatchEvent(event);
  }
  
  openResearchInterface() {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyR',
      key: 'r'
    });
    window.dispatchEvent(event);
  }
  
  openFactionInterface() {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyF',
      key: 'f'
    });
    window.dispatchEvent(event);
  }
  
  openTradingInterface() {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyT',
      key: 't'
    });
    window.dispatchEvent(event);
  }
  
  focusGame() {
    window.focus();
    const canvas = document.getElementById('game');
    if (canvas) {
      canvas.focus();
    }
  }
  
  // Utility methods
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
  
  // Settings and preferences
  updateNotificationPreferences(preferences) {
    const validPreferences = {
      guildEvents: true,
      researchUpdates: true,
      factionChanges: true,
      tradeAlerts: true,
      combatResults: true,
      achievements: true,
      ...preferences
    };
    
    localStorage.setItem('notificationPreferences', JSON.stringify(validPreferences));
    
    // Send to server
    fetch('/api/notification-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPreferences)
    });
  }
  
  getNotificationPreferences() {
    const stored = localStorage.getItem('notificationPreferences');
    return stored ? JSON.parse(stored) : {
      guildEvents: true,
      researchUpdates: true,
      factionChanges: true,
      tradeAlerts: true,
      combatResults: true,
      achievements: true
    };
  }
  
  // Public API
  getSubscriptionStatus() {
    return {
      isSupported: this.isSupported,
      isSubscribed: !!this.subscription,
      permission: this.permissionState,
      endpoint: this.subscription?.endpoint
    };
  }
  
  async testNotification() {
    this.showLocalNotification(
      'Test Notification',
      'StarForge Frontier notifications are working correctly!',
      { tag: 'test-notification' }
    );
  }
  
  getQueuedEvents() {
    return this.eventQueue;
  }
  
  clearEventQueue() {
    this.eventQueue = [];
  }
}

// Initialize push notification manager
window.addEventListener('DOMContentLoaded', () => {
  window.pushNotificationManager = new PushNotificationManager();
});

// Export for use in other modules
window.PushNotificationManager = PushNotificationManager;