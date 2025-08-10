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
    this.collapsedStates = this.loadCollapsedStates();
    
    this.init();
    this.setupEventListeners();
    this.setupResponsiveHandling();
    this.initializeCollapsiblePanels();
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
      isCollapsed: this.collapsedStates[config.id] || false,
      toggleElement: document.getElementById(config.toggleId),
      panelElement: document.getElementById(config.panelId),
      closeButton: document.getElementById(`${config.id}Close`),
      expandButton: document.getElementById(`${config.id}Expand`),
      collapseButton: null, // Will be created dynamically
      badge: document.getElementById(`${config.id}Badge`)
    };
    
    this.panels.set(config.id, panel);
    this.setupPanelEventListeners(panel);
    this.addCollapseButton(panel);
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
        case 'KeyH':
          e.preventDefault();
          this.toggleAllPanels();
          break;
        case 'KeyC':
          if (e.ctrlKey) {
            e.preventDefault();
            this.collapseAllPanels();
          }
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

  // =====================================
  // COLLAPSIBLE PANEL FUNCTIONALITY
  // =====================================

  loadCollapsedStates() {
    try {
      const stored = localStorage.getItem('starforge-panel-states');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.warn('Failed to load panel states from localStorage:', e);
      return {};
    }
  }

  saveCollapsedStates() {
    try {
      localStorage.setItem('starforge-panel-states', JSON.stringify(this.collapsedStates));
    } catch (e) {
      console.warn('Failed to save panel states to localStorage:', e);
    }
  }

  addCollapseButton(panel) {
    if (!panel.panelElement) return;

    const header = panel.panelElement.querySelector('.hud-panel-header');
    if (!header) return;

    const controls = header.querySelector('.hud-panel-controls');
    if (!controls) return;

    // Create collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'hud-control-btn collapse-btn';
    collapseBtn.title = panel.isCollapsed ? 'Expand' : 'Collapse';
    collapseBtn.innerHTML = panel.isCollapsed ? '📄' : '➖';
    
    // Insert before close button
    const closeBtn = controls.querySelector('.danger');
    if (closeBtn) {
      controls.insertBefore(collapseBtn, closeBtn);
    } else {
      controls.appendChild(collapseBtn);
    }

    panel.collapseButton = collapseBtn;

    // Add event listener
    collapseBtn.addEventListener('click', () => {
      this.togglePanelCollapse(panel.id);
    });

    // Apply initial collapsed state
    if (panel.isCollapsed) {
      this.applyCollapsedState(panel);
    }
  }

  togglePanelCollapse(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    panel.isCollapsed = !panel.isCollapsed;
    this.collapsedStates[panelId] = panel.isCollapsed;
    this.saveCollapsedStates();

    // Update collapse button
    if (panel.collapseButton) {
      panel.collapseButton.innerHTML = panel.isCollapsed ? '📄' : '➖';
      panel.collapseButton.title = panel.isCollapsed ? 'Expand' : 'Collapse';
    }

    // Apply/remove collapsed state
    if (panel.isCollapsed) {
      this.applyCollapsedState(panel);
    } else {
      this.removeCollapsedState(panel);
    }
  }

  applyCollapsedState(panel) {
    if (!panel.panelElement) return;

    panel.panelElement.classList.add('collapsed');
    
    // Hide content but keep header visible
    const content = panel.panelElement.querySelector('.hud-panel-content');
    if (content) {
      content.style.display = 'none';
    }

    // Trigger panel-specific collapse logic
    this.triggerPanelEvent(panel.id, 'collapse');
  }

  removeCollapsedState(panel) {
    if (!panel.panelElement) return;

    panel.panelElement.classList.remove('collapsed');
    
    // Show content
    const content = panel.panelElement.querySelector('.hud-panel-content');
    if (content) {
      content.style.display = '';
    }

    // Trigger panel-specific expand logic
    this.triggerPanelEvent(panel.id, 'expand');
  }

  collapseAllPanels() {
    this.panels.forEach((panel, panelId) => {
      if (!panel.isCollapsed) {
        this.togglePanelCollapse(panelId);
      }
    });
    
    // Also collapse main HUD elements
    this.collapseMainHUDElements();
  }

  expandAllPanels() {
    this.panels.forEach((panel, panelId) => {
      if (panel.isCollapsed) {
        this.togglePanelCollapse(panelId);
      }
    });
    
    // Also expand main HUD elements
    this.expandMainHUDElements();
  }

  toggleAllPanels() {
    const hasAnyExpanded = Array.from(this.panels.values()).some(panel => !panel.isCollapsed);
    
    if (hasAnyExpanded) {
      this.collapseAllPanels();
    } else {
      this.expandAllPanels();
    }
  }

  initializeCollapsiblePanels() {
    // Initialize main HUD element collapse functionality
    this.initializeMainHUDCollapse();
    
    // Initialize target info auto-hide
    this.initializeTargetInfoAutoHide();
  }

  initializeMainHUDCollapse() {
    // Player stats collapse
    this.addMainHUDCollapseButton('player-stats', 'Player Stats');
    
    // Ship stats collapse
    this.addMainHUDCollapseButton('ship-stats', 'Ship Stats');
    
    // Combat stats collapse
    this.addMainHUDCollapseButton('combat-stats', 'Combat Stats');
    
    // Quick actions collapse
    this.addMainHUDCollapseButton('quick-actions', 'Actions');
    
    // Controls panel collapse
    this.addControlsPanelCollapse();
  }

  addMainHUDCollapseButton(sectionClass, title) {
    const section = document.querySelector(`.hud-section.${sectionClass}`);
    if (!section) return;

    const isCollapsed = this.collapsedStates[sectionClass] || false;

    // Create header if it doesn't exist
    let header = section.querySelector('.hud-section-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'hud-section-header';
      
      const titleEl = document.createElement('span');
      titleEl.className = 'hud-section-title';
      titleEl.textContent = title;
      
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'hud-section-collapse-btn';
      collapseBtn.innerHTML = isCollapsed ? '📊' : '➖';
      collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
      
      header.appendChild(titleEl);
      header.appendChild(collapseBtn);
      
      section.insertBefore(header, section.firstChild);
      
      // Add click handler
      collapseBtn.addEventListener('click', () => {
        const currentlyCollapsed = section.classList.contains('collapsed');
        
        if (currentlyCollapsed) {
          section.classList.remove('collapsed');
          collapseBtn.innerHTML = '➖';
          collapseBtn.title = 'Collapse';
          this.collapsedStates[sectionClass] = false;
        } else {
          section.classList.add('collapsed');
          collapseBtn.innerHTML = '📊';
          collapseBtn.title = 'Expand';
          this.collapsedStates[sectionClass] = true;
        }
        
        this.saveCollapsedStates();
      });
      
      // Apply initial collapsed state
      if (isCollapsed) {
        section.classList.add('collapsed');
      }
    }
  }

  addControlsPanelCollapse() {
    const controlsPanel = document.getElementById('controls');
    if (!controlsPanel) return;

    const isCollapsed = this.collapsedStates['controls'] || false;

    // Create hamburger menu for collapsed state
    if (!document.getElementById('controls-hamburger')) {
      const hamburger = document.createElement('div');
      hamburger.id = 'controls-hamburger';
      hamburger.className = 'controls-hamburger';
      hamburger.innerHTML = `
        <div class="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="hamburger-label">Controls</span>
      `;
      
      hamburger.style.display = isCollapsed ? 'flex' : 'none';
      controlsPanel.parentNode.insertBefore(hamburger, controlsPanel);
      
      // Add click handler to toggle
      hamburger.addEventListener('click', () => {
        this.toggleControlsPanel();
      });
    }

    // Create collapse button for controls panel
    let collapseBtn = controlsPanel.querySelector('.controls-collapse-btn');
    if (!collapseBtn) {
      collapseBtn = document.createElement('button');
      collapseBtn.className = 'controls-collapse-btn';
      collapseBtn.innerHTML = '✕';
      collapseBtn.title = 'Collapse to hamburger menu';
      
      const title = controlsPanel.querySelector('.help-title');
      if (title) {
        title.appendChild(collapseBtn);
      }
      
      collapseBtn.addEventListener('click', () => {
        this.toggleControlsPanel();
      });
    }

    // Apply initial state
    if (isCollapsed) {
      controlsPanel.style.display = 'none';
    }
  }

  toggleControlsPanel() {
    const controlsPanel = document.getElementById('controls');
    const hamburger = document.getElementById('controls-hamburger');
    
    if (!controlsPanel || !hamburger) return;

    const isCurrentlyCollapsed = controlsPanel.style.display === 'none';
    
    if (isCurrentlyCollapsed) {
      controlsPanel.style.display = '';
      hamburger.style.display = 'none';
      this.collapsedStates['controls'] = false;
    } else {
      controlsPanel.style.display = 'none';
      hamburger.style.display = 'flex';
      this.collapsedStates['controls'] = true;
    }
    
    this.saveCollapsedStates();
  }

  initializeTargetInfoAutoHide() {
    // Monitor target name changes to auto-hide/show
    const targetNameEl = document.getElementById('selectedTargetName');
    if (!targetNameEl) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const hasTarget = targetNameEl.textContent.trim() !== 'No Target';
          const weaponStatus = document.querySelector('.hud-section.weapon-status');
          
          if (weaponStatus) {
            if (hasTarget) {
              weaponStatus.classList.remove('auto-hidden');
            } else {
              weaponStatus.classList.add('auto-hidden');
            }
          }
        }
      });
    });

    observer.observe(targetNameEl, { 
      childList: true, 
      characterData: true, 
      subtree: true 
    });

    // Initial check
    const hasTarget = targetNameEl.textContent.trim() !== 'No Target';
    const weaponStatus = document.querySelector('.hud-section.weapon-status');
    if (weaponStatus && !hasTarget) {
      weaponStatus.classList.add('auto-hidden');
    }
  }

  collapseMainHUDElements() {
    ['player-stats', 'ship-stats', 'combat-stats', 'quick-actions'].forEach(sectionClass => {
      const section = document.querySelector(`.hud-section.${sectionClass}`);
      const btn = section?.querySelector('.hud-section-collapse-btn');
      
      if (section && !section.classList.contains('collapsed')) {
        btn?.click();
      }
    });
    
    // Collapse controls to hamburger
    const controlsPanel = document.getElementById('controls');
    if (controlsPanel && controlsPanel.style.display !== 'none') {
      this.toggleControlsPanel();
    }
  }

  expandMainHUDElements() {
    ['player-stats', 'ship-stats', 'combat-stats', 'quick-actions'].forEach(sectionClass => {
      const section = document.querySelector(`.hud-section.${sectionClass}`);
      const btn = section?.querySelector('.hud-section-collapse-btn');
      
      if (section && section.classList.contains('collapsed')) {
        btn?.click();
      }
    });
    
    // Expand controls from hamburger
    const controlsPanel = document.getElementById('controls');
    if (controlsPanel && controlsPanel.style.display === 'none') {
      this.toggleControlsPanel();
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