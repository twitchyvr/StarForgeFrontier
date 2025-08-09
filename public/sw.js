// StarForge Frontier Service Worker
const CACHE_NAME = 'starforge-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Essential files for offline functionality
const ESSENTIAL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/client-enhanced.js',
  '/ship-editor.css',
  '/ship-editor.js',
  '/trading-ui.css',
  '/trading-ui.js',
  '/faction-ui.css',
  '/faction-ui.js',
  '/skill-system.css',
  '/skill-system.js',
  '/guild-system.css',
  '/guild-system.js',
  '/hazard-system.css',
  '/hazard-system.js',
  '/research-system.css',
  '/research-system.js',
  '/galaxy-ui.js',
  '/manifest.json',
  OFFLINE_URL
];

// Game assets for caching
const GAME_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching essential files');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content or network
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If we get a valid response, clone and cache it
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache, then offline page
          return caches.match(request)
            .then(cachedResponse => {
              return cachedResponse || caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // Handle WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    // Let WebSocket requests pass through
    return;
  }

  // Handle API requests with cache-first strategy for game data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Serve from cache and update in background
            fetch(request)
              .then(response => {
                if (response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME)
                    .then(cache => cache.put(request, responseClone));
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(request)
            .then(response => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            })
            .catch(() => {
              // Return offline indicator for API requests
              return new Response(JSON.stringify({
                error: 'Offline',
                message: 'No network connection available'
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (request.destination === 'image' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request)
            .then(response => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
        .catch(() => {
          // For images, return a placeholder
          if (request.destination === 'image') {
            return new Response('', { status: 204 });
          }
          throw new Error('Network unavailable');
        })
    );
    return;
  }

  // Default: try network first, then cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'game-actions') {
    event.waitUntil(syncGameActions());
  } else if (event.tag === 'chat-messages') {
    event.waitUntil(syncChatMessages());
  }
});

// Push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event.data?.text());
  
  let notificationData;
  try {
    notificationData = event.data ? event.data.json() : {};
  } catch (e) {
    notificationData = { title: 'StarForge Frontier', body: 'New game event!' };
  }

  const options = {
    body: notificationData.body || 'New game event!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open Game',
        icon: '/icons/action-open.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/action-dismiss.png'
      }
    ],
    requireInteraction: true,
    tag: notificationData.tag || 'starforge-notification'
  };

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'StarForge Frontier',
      options
    )
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise open new window
        if (clients.openWindow) {
          const url = event.notification.data?.url || '/';
          return clients.openWindow(url);
        }
      })
  );
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_GAME_DATA') {
    // Cache game data for offline use
    const gameData = event.data.data;
    caches.open(CACHE_NAME)
      .then(cache => {
        cache.put('/api/game-state', new Response(JSON.stringify(gameData)));
      });
  }
});

// Helper functions
async function syncGameActions() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const offlineActions = await cache.match('/offline-actions');
    
    if (offlineActions) {
      const actions = await offlineActions.json();
      
      for (const action of actions) {
        try {
          await fetch('/api/sync-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action)
          });
        } catch (error) {
          console.error('[SW] Failed to sync action:', error);
        }
      }
      
      // Clear synced actions
      await cache.delete('/offline-actions');
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

async function syncChatMessages() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const offlineMessages = await cache.match('/offline-messages');
    
    if (offlineMessages) {
      const messages = await offlineMessages.json();
      
      for (const message of messages) {
        try {
          await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
          });
        } catch (error) {
          console.error('[SW] Failed to sync message:', error);
        }
      }
      
      // Clear synced messages
      await cache.delete('/offline-messages');
    }
  } catch (error) {
    console.error('[SW] Message sync failed:', error);
  }
}

console.log('[SW] Service worker loaded successfully');