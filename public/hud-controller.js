/**
 * HUD Controller for StarForgeFrontier
 * Manages the new HUD panel system that replaces modal overlays
 */

class HUDController {
  constructor() {
    this.panels = new Map();
    this.activePanel = null;
    this.isFullscreenMode = false;
    this.mobileMode = window.innerWidth <= 768;
    
    this.init();
    this.setupEventListeners();
    this.setupResponsiveHandling();
  }
  
  init() {
    // Initialize all HUD panels
    const panelConfigs = [
      { id: 'faction', toggleId: 'factionToggle', panelId: 'factionHudPanel', position: 'right', fullscreenFallback: true },
      { id: 'guild', toggleId: 'guildToggle', panelId: 'guildHudPanel', position: 'left', fullscreenFallback: true },
      { id: 'skills', toggleId: 'skillsToggle', panelId: 'skillsHudPanel', position: 'right', fullscreenFallback: true },
      { id: 'research', toggleId: 'researchToggle', panelId: 'researchHudPanel', position: 'top', fullscreenFallback: true },
      { id: 'trading', toggleId: 'tradingToggle', panelId: 'tradingHudPanel', position: 'bottom', fullscreenFallback: true },
      { id: 'shop', toggleId: 'shopToggleNew', panelId: 'shopHudPanel', position: 'bottom', fullscreenFallback: false }
    ];
    
    panelConfigs.forEach(config => {
      this.registerPanel(config);
    });
  }
  
  registerPanel(config) {
    const panel = {
      ...config,
      isVisible: false,
      isFullscreen: false,
      toggleElement: document.getElementById(config.toggleId),
      panelElement: document.getElementById(config.panelId),
      closeButton: document.getElementById(`${config.id}Close`),
      expandButton: document.getElementById(`${config.id}Expand`),
      badge: document.getElementById(`${config.id}Badge`)
    };
    
    this.panels.set(config.id, panel);
    this.setupPanelEventListeners(panel);
  }
  
  setupPanelEventListeners(panel) {
    // Toggle button
    if (panel.toggleElement) {
      panel.toggleElement.addEventListener('click', () => {
        this.togglePanel(panel.id);
      });
    }
    
    // Close button
    if (panel.closeButton) {
      panel.closeButton.addEventListener('click', () => {
        this.hidePanel(panel.id);
      });
    }
    
    // Expand button (for fullscreen mode)
    if (panel.expandButton) {
      panel.expandButton.addEventListener('click', () => {
        this.toggleFullscreen(panel.id);
      });
    }
    
    // Handle clicks outside panel to close on mobile
    if (this.mobileMode) {
      document.addEventListener('click', (e) => {
        if (panel.isVisible && 
            !panel.panelElement.contains(e.target) && 
            !panel.toggleElement.contains(e.target)) {
          this.hidePanel(panel.id);
        }
      });
    }
  }
  
  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch(e.code) {
        case 'KeyF':
          if (!e.shiftKey) this.togglePanel('faction');
          break;
        case 'KeyU':
          this.togglePanel('guild');
          break;
        case 'KeyK':
          this.togglePanel('skills');
          break;
        case 'KeyR':
          this.togglePanel('research');
          break;
        case 'KeyT':
          this.togglePanel('trading');
          break;
        case 'Tab':
          e.preventDefault();
          this.togglePanel('shop');
          break;
        case 'Escape':
          this.hideAllPanels();
          break;
      }
    });
    
    // Handle window focus/blur for performance
    window.addEventListener('blur', () => {
      this.pauseAnimations();
    });
    
    window.addEventListener('focus', () => {
      this.resumeAnimations();
    });
  }
  
  setupResponsiveHandling() {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    mediaQuery.addListener((e) => {
      this.mobileMode = e.matches;
      this.handleMobileTransition();
    });
  }
  
  handleMobileTransition() {
    if (this.mobileMode) {
      // On mobile, only allow one panel at a time
      const visiblePanels = Array.from(this.panels.values()).filter(p => p.isVisible);
      if (visiblePanels.length > 1) {
        visiblePanels.slice(1).forEach(panel => {
          this.hidePanel(panel.id);
        });
      }
    }
  }
  
  togglePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    if (panel.isVisible) {
      this.hidePanel(panelId);
    } else {
      this.showPanel(panelId);
    }
  }
  
  showPanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || panel.isVisible) return;
    
    // On mobile or when explicitly requested, hide other panels
    if (this.mobileMode || this.isFullscreenMode) {
      this.hideAllPanels();
    }
    
    // Show the panel
    panel.isVisible = true;
    panel.panelElement.classList.add('visible');
    panel.toggleElement?.classList.add('active');
    
    // Update active panel
    this.activePanel = panelId;
    
    // Trigger panel-specific show logic
    this.triggerPanelEvent(panelId, 'show');
    
    // Add to game state if needed
    if (typeof window.gameState !== 'undefined') {
      window.gameState.activeHUDPanels = window.gameState.activeHUDPanels || [];
      if (!window.gameState.activeHUDPanels.includes(panelId)) {
        window.gameState.activeHUDPanels.push(panelId);
      }
    }
  }
  
  hidePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.isVisible) return;
    
    // Hide the panel
    panel.isVisible = false;
    panel.panelElement.classList.remove('visible');
    panel.toggleElement?.classList.remove('active');
    
    // Update active panel
    if (this.activePanel === panelId) {
      this.activePanel = null;
    }
    
    // Trigger panel-specific hide logic
    this.triggerPanelEvent(panelId, 'hide');
    
    // Remove from game state
    if (typeof window.gameState !== 'undefined' && window.gameState.activeHUDPanels) {
      const index = window.gameState.activeHUDPanels.indexOf(panelId);
      if (index > -1) {
        window.gameState.activeHUDPanels.splice(index, 1);
      }
    }
  }
  
  hideAllPanels() {
    this.panels.forEach((panel, panelId) => {
      if (panel.isVisible) {
        this.hidePanel(panelId);
      }
    });
  }
  
  toggleFullscreen(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.fullscreenFallback) return;
    
    // For panels that support fullscreen, we'll trigger the original modal
    this.triggerPanelEvent(panelId, 'fullscreen');
  }
  
  setBadge(panelId, count) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.badge) return;
    
    if (count > 0) {
      panel.badge.textContent = count > 99 ? '99+' : count;
      panel.badge.classList.add('visible');
    } else {
      panel.badge.classList.remove('visible');
    }
  }
  
  triggerPanelEvent(panelId, event) {
    // Dispatch custom events for panel-specific JavaScript to handle
    const customEvent = new CustomEvent(`hud:${panelId}:${event}`, {
      detail: { panelId, event }
    });
    
    document.dispatchEvent(customEvent);
  }
  
  pauseAnimations() {
    document.body.classList.add('hud-paused');
  }
  
  resumeAnimations() {
    document.body.classList.remove('hud-paused');
  }
  
  // Public API methods
  isVisible(panelId) {
    const panel = this.panels.get(panelId);
    return panel ? panel.isVisible : false;
  }
  
  getPanelElement(panelId) {
    const panel = this.panels.get(panelId);
    return panel ? panel.panelElement : null;
  }
  
  getContentElement(panelId) {
    const panelElement = this.getPanelElement(panelId);
    return panelElement ? panelElement.querySelector('.hud-panel-content') : null;
  }
  
  updatePanelContent(panelId, content) {
    const contentElement = this.getContentElement(panelId);
    if (contentElement) {
      const targetDiv = contentElement.querySelector(`#${panelId}Content`);
      if (targetDiv) {
        if (typeof content === 'string') {
          targetDiv.innerHTML = content;
        } else {
          targetDiv.innerHTML = '';
          targetDiv.appendChild(content);
        }
      }
    }
  }
  
  // Utility method to maintain backward compatibility
  adaptLegacyPanelToHUD(legacyPanelId, hudPanelId) {
    const legacyPanel = document.getElementById(legacyPanelId);
    if (legacyPanel) {
      legacyPanel.style.display = 'none';
      
      // Listen for legacy panel show/hide events and redirect to HUD
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const isHidden = legacyPanel.classList.contains('hidden');
            if (!isHidden && !this.isVisible(hudPanelId)) {
              this.showPanel(hudPanelId);
            } else if (isHidden && this.isVisible(hudPanelId)) {
              this.hidePanel(hudPanelId);
            }
          }
        });
      });
      
      observer.observe(legacyPanel, { attributes: true });
    }
  }
}

// Global HUD Controller instance
window.hudController = new HUDController();

// Backward compatibility helpers
window.showHUDPanel = (panelId) => window.hudController.showPanel(panelId);
window.hideHUDPanel = (panelId) => window.hudController.hidePanel(panelId);
window.toggleHUDPanel = (panelId) => window.hudController.togglePanel(panelId);
window.setHUDBadge = (panelId, count) => window.hudController.setBadge(panelId, count);

// Integration helpers for existing systems
document.addEventListener('DOMContentLoaded', () => {
  // Redirect old shop toggle to new HUD system
  const oldShopToggle = document.getElementById('shopToggle');
  if (oldShopToggle) {
    oldShopToggle.addEventListener('click', () => {
      window.hudController.togglePanel('shop');
    });
  }
  
  // Redirect old ship editor toggle
  const oldShipEditorToggle = document.getElementById('shipEditorToggle');
  if (oldShipEditorToggle) {
    oldShipEditorToggle.addEventListener('click', () => {
      // Ship editor might need special handling - keep original behavior for now
      // But also trigger HUD panel if available
      if (window.hudController.panels.has('shipEditor')) {
        window.hudController.togglePanel('shipEditor');
      }
    });
  }
  
  // Set up legacy panel adapters
  window.hudController.adaptLegacyPanelToHUD('factionPanel', 'faction');
  window.hudController.adaptLegacyPanelToHUD('guildSystem', 'guild');
  window.hudController.adaptLegacyPanelToHUD('skillPanel', 'skills');
  window.hudController.adaptLegacyPanelToHUD('researchInterface', 'research');
  window.hudController.adaptLegacyPanelToHUD('tradingPanel', 'trading');
});