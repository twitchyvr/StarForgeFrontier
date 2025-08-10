/**
 * UI Settings System for StarForgeFrontier
 * Provides comprehensive UI customization options
 */

class UISettingsManager {
  constructor() {
    this.settings = this.getDefaultSettings();
    this.presets = this.getDefaultPresets();
    this.uiElements = this.getUIElementsMap();
    
    this.init();
  }
  
  getDefaultSettings() {
    return {
      // UI Element Visibility
      minimap: { visible: true, opacity: 100 },
      compass: { visible: true, opacity: 100 }, // If compass exists
      resourceBar: { visible: true, opacity: 100 },
      shipStats: { visible: true, opacity: 100 },
      controlHints: { visible: true, opacity: 100 },
      targetInfo: { visible: true, opacity: 100, autoHide: false },
      buttonLabels: { visible: true, opacity: 100 },
      combatLog: { visible: true, opacity: 100 },
      onlineStatus: { visible: true, opacity: 100 },
      mainHud: { visible: true, opacity: 100 },
      quickActions: { visible: true, opacity: 100 },
      hudPanels: { visible: true, opacity: 100 },
      
      // HUD Panel positions
      guildButton: { position: 'left', visible: true },
      skillsButton: { position: 'right', visible: true },
      factionButton: { position: 'right', visible: true },
      researchButton: { position: 'top', visible: true },
      tradingButton: { position: 'bottom', visible: true },
      
      // Global settings
      currentPreset: 'standard'
    };
  }
  
  getDefaultPresets() {
    return {
      minimal: {
        minimap: { visible: false, opacity: 80 },
        compass: { visible: false, opacity: 80 },
        resourceBar: { visible: true, opacity: 90 },
        shipStats: { visible: false, opacity: 80 },
        controlHints: { visible: false, opacity: 80 },
        targetInfo: { visible: true, opacity: 90, autoHide: true },
        buttonLabels: { visible: false, opacity: 80 },
        combatLog: { visible: false, opacity: 80 },
        onlineStatus: { visible: false, opacity: 80 },
        mainHud: { visible: true, opacity: 90 },
        quickActions: { visible: true, opacity: 90 },
        hudPanels: { visible: true, opacity: 90 }
      },
      
      standard: {
        minimap: { visible: true, opacity: 100 },
        compass: { visible: true, opacity: 100 },
        resourceBar: { visible: true, opacity: 100 },
        shipStats: { visible: true, opacity: 100 },
        controlHints: { visible: true, opacity: 100 },
        targetInfo: { visible: true, opacity: 100, autoHide: false },
        buttonLabels: { visible: true, opacity: 100 },
        combatLog: { visible: true, opacity: 100 },
        onlineStatus: { visible: true, opacity: 100 },
        mainHud: { visible: true, opacity: 100 },
        quickActions: { visible: true, opacity: 100 },
        hudPanels: { visible: true, opacity: 100 }
      },
      
      full: {
        minimap: { visible: true, opacity: 100 },
        compass: { visible: true, opacity: 100 },
        resourceBar: { visible: true, opacity: 100 },
        shipStats: { visible: true, opacity: 100 },
        controlHints: { visible: true, opacity: 100 },
        targetInfo: { visible: true, opacity: 100, autoHide: false },
        buttonLabels: { visible: true, opacity: 100 },
        combatLog: { visible: true, opacity: 100 },
        onlineStatus: { visible: true, opacity: 100 },
        mainHud: { visible: true, opacity: 100 },
        quickActions: { visible: true, opacity: 100 },
        hudPanels: { visible: true, opacity: 100 }
      }
    };
  }
  
  getUIElementsMap() {
    return {
      minimap: {
        selector: '#minimap',
        name: 'Minimap',
        description: 'Shows nearby players and objects'
      },
      compass: {
        selector: '#compass, .compass', // In case compass exists
        name: 'Compass',
        description: 'Shows directional orientation'
      },
      resourceBar: {
        selector: '.player-stats',
        name: 'Resource Bar',
        description: 'Shows resources, level, and position'
      },
      shipStats: {
        selector: '.ship-stats, .combat-stats',
        name: 'Ship Stats',
        description: 'Shows ship properties and health'
      },
      controlHints: {
        selector: '#controls',
        name: 'Control Hints',
        description: 'Shows keyboard controls help'
      },
      targetInfo: {
        selector: '.weapon-status',
        name: 'Target Info',
        description: 'Shows selected target and weapon status'
      },
      buttonLabels: {
        selector: 'body',
        name: 'Button Labels',
        description: 'Shows text labels on buttons',
        special: 'buttonLabels'
      },
      combatLog: {
        selector: '#combatLogPanel',
        name: 'Combat Log',
        description: 'Shows combat events and messages'
      },
      onlineStatus: {
        selector: '#onlineStatus',
        name: 'Online Status',
        description: 'Shows number of online players'
      },
      mainHud: {
        selector: '#hud',
        name: 'Main HUD',
        description: 'Primary game interface'
      },
      quickActions: {
        selector: '.quick-actions',
        name: 'Quick Actions',
        description: 'Shop and module buttons'
      },
      hudPanels: {
        selector: '.hud-toggle-container',
        name: 'HUD Panel Toggles',
        description: 'Side panel toggle buttons'
      }
    };
  }
  
  init() {
    this.loadSettings();
    this.createSettingsPanel();
    this.applySettings();
    this.setupEventListeners();
  }
  
  loadSettings() {
    const savedSettings = localStorage.getItem('starforge_ui_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        this.settings = { ...this.settings, ...parsed };
      } catch (e) {
        console.warn('Failed to load UI settings:', e);
      }
    }
  }
  
  saveSettings() {
    localStorage.setItem('starforge_ui_settings', JSON.stringify(this.settings));
  }
  
  createSettingsPanel() {
    // Create the settings panel HTML
    const panelHTML = `
      <div class="hud-panel-header">
        <span class="hud-panel-title">UI Customization</span>
        <div class="hud-panel-controls">
          <button class="hud-control-btn" id="uiSettingsReset" title="Reset to Default">🔄</button>
          <button class="hud-control-btn danger" id="uiSettingsClose" title="Close">×</button>
        </div>
      </div>
      <div class="hud-panel-content hud-scrollbar">
        <!-- Presets Section -->
        <div class="settings-section">
          <div class="settings-section-title">UI Presets</div>
          <div class="preset-controls">
            <button class="preset-btn" data-preset="minimal">Minimal</button>
            <button class="preset-btn" data-preset="standard">Standard</button>
            <button class="preset-btn" data-preset="full">Full</button>
          </div>
        </div>
        
        <!-- UI Elements Section -->
        <div class="settings-section">
          <div class="settings-section-title">UI Elements</div>
          <div id="uiElementSettings">
            <!-- Will be populated dynamically -->
          </div>
        </div>
        
        <!-- Import/Export Section -->
        <div class="settings-section">
          <div class="settings-section-title">Settings Management</div>
          <div class="settings-actions">
            <button class="settings-action-btn success" id="exportSettings">Export</button>
            <div class="file-input-wrapper">
              <input type="file" id="importSettings" class="file-input" accept=".json">
              <label for="importSettings" class="file-input-label">Import</label>
            </div>
            <button class="settings-action-btn danger" id="resetSettings">Reset All</button>
          </div>
        </div>
      </div>
    `;
    
    // Create the panel element
    const panel = document.createElement('div');
    panel.className = 'hud-panel right ui-settings-panel';
    panel.id = 'uiSettingsPanel';
    panel.innerHTML = panelHTML;
    
    // Add to hud container
    const hudContainer = document.querySelector('.hud-container');
    if (hudContainer) {
      hudContainer.appendChild(panel);
    }
    
    // Add toggle button
    this.createToggleButton();
    
    // Populate UI element settings
    this.populateUIElementSettings();
    
    // Register with HUD controller
    if (window.hudController) {
      window.hudController.registerPanel({
        id: 'uiSettings',
        toggleId: 'uiSettingsToggle',
        panelId: 'uiSettingsPanel',
        position: 'right',
        fullscreenFallback: false
      });
    }
  }
  
  createToggleButton() {
    // Add the settings toggle button to the HUD
    const toggleContainer = document.querySelector('.hud-toggles-right');
    if (toggleContainer) {
      const toggleButton = document.createElement('div');
      toggleButton.className = 'hud-toggle-btn';
      toggleButton.id = 'uiSettingsToggle';
      toggleButton.innerHTML = `
        <span class="hud-toggle-icon">⚙️</span>
        <span class="hud-toggle-label">UI Settings</span>
      `;
      toggleContainer.appendChild(toggleButton);
    }
  }
  
  populateUIElementSettings() {
    const container = document.getElementById('uiElementSettings');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(this.uiElements).forEach(elementKey => {
      const element = this.uiElements[elementKey];
      const setting = this.settings[elementKey];
      
      const settingHTML = `
        <div class="setting-item" data-element="${elementKey}">
          <div>
            <div class="setting-label">${element.name}</div>
            <div style="font-size: 11px; color: var(--hud-text-secondary); margin-top: 2px;">
              ${element.description}
            </div>
          </div>
          <div>
            <div class="toggle-switch ${setting.visible ? 'active' : ''}" data-element="${elementKey}"></div>
            <div class="opacity-control" style="margin-top: 8px; ${!setting.visible ? 'opacity: 0.5; pointer-events: none;' : ''}">
              <input type="range" class="opacity-slider" min="10" max="100" step="10" 
                     value="${setting.opacity}" data-element="${elementKey}">
              <span class="opacity-value">${setting.opacity}%</span>
            </div>
          </div>
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', settingHTML);
    });
  }
  
  setupEventListeners() {
    // Settings panel toggle
    document.addEventListener('click', (e) => {
      if (e.target.id === 'uiSettingsToggle' || e.target.closest('#uiSettingsToggle')) {
        if (window.hudController) {
          window.hudController.togglePanel('uiSettings');
        }
      }
    });
    
    // Close button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'uiSettingsClose') {
        if (window.hudController) {
          window.hudController.hidePanel('uiSettings');
        }
      }
    });
    
    // Preset buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('preset-btn')) {
        const preset = e.target.dataset.preset;
        this.applyPreset(preset);
      }
    });
    
    // Toggle switches
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('toggle-switch')) {
        const elementKey = e.target.dataset.element;
        this.toggleElementVisibility(elementKey);
      }
    });
    
    // Opacity sliders
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('opacity-slider')) {
        const elementKey = e.target.dataset.element;
        const opacity = parseInt(e.target.value);
        this.setElementOpacity(elementKey, opacity);
      }
    });
    
    // Export settings
    document.addEventListener('click', (e) => {
      if (e.target.id === 'exportSettings') {
        this.exportSettings();
      }
    });
    
    // Import settings
    document.addEventListener('change', (e) => {
      if (e.target.id === 'importSettings') {
        this.importSettings(e.target.files[0]);
      }
    });
    
    // Reset settings
    document.addEventListener('click', (e) => {
      if (e.target.id === 'resetSettings' || e.target.id === 'uiSettingsReset') {
        this.resetSettings();
      }
    });
  }
  
  toggleElementVisibility(elementKey) {
    const setting = this.settings[elementKey];
    setting.visible = !setting.visible;
    
    this.applyElementSetting(elementKey);
    this.updateSettingUI(elementKey);
    this.saveSettings();
  }
  
  setElementOpacity(elementKey, opacity) {
    const setting = this.settings[elementKey];
    setting.opacity = opacity;
    
    this.applyElementSetting(elementKey);
    this.updateOpacityDisplay(elementKey);
    this.saveSettings();
  }
  
  applyElementSetting(elementKey) {
    const element = this.uiElements[elementKey];
    const setting = this.settings[elementKey];
    
    if (element.special === 'buttonLabels') {
      // Special handling for button labels
      document.body.classList.toggle('hide-button-labels', !setting.visible);
    } else {
      // Standard element handling
      const domElements = document.querySelectorAll(element.selector);
      domElements.forEach(el => {
        if (setting.visible) {
          el.classList.remove('ui-hidden');
          // Remove old opacity classes
          for (let i = 10; i <= 100; i += 10) {
            el.classList.remove(`ui-opacity-${i}`);
          }
          // Add new opacity class
          el.classList.add(`ui-opacity-${setting.opacity}`);
        } else {
          el.classList.add('ui-hidden');
        }
      });
    }
  }
  
  applySettings() {
    Object.keys(this.uiElements).forEach(elementKey => {
      this.applyElementSetting(elementKey);
    });
    this.updatePresetUI();
  }
  
  applyPreset(presetName) {
    if (this.presets[presetName]) {
      this.settings = { ...this.settings, ...this.presets[presetName] };
      this.settings.currentPreset = presetName;
      
      this.applySettings();
      this.populateUIElementSettings();
      this.saveSettings();
    }
  }
  
  updateSettingUI(elementKey) {
    const setting = this.settings[elementKey];
    const toggleSwitch = document.querySelector(`.toggle-switch[data-element="${elementKey}"]`);
    const opacityControl = toggleSwitch?.parentElement.querySelector('.opacity-control');
    
    if (toggleSwitch) {
      toggleSwitch.classList.toggle('active', setting.visible);
    }
    
    if (opacityControl) {
      opacityControl.style.opacity = setting.visible ? '1' : '0.5';
      opacityControl.style.pointerEvents = setting.visible ? 'auto' : 'none';
    }
  }
  
  updateOpacityDisplay(elementKey) {
    const setting = this.settings[elementKey];
    const opacityValue = document.querySelector(`.opacity-slider[data-element="${elementKey}"]`)
      ?.parentElement.querySelector('.opacity-value');
    
    if (opacityValue) {
      opacityValue.textContent = `${setting.opacity}%`;
    }
  }
  
  updatePresetUI() {
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this.settings.currentPreset);
    });
  }
  
  resetSettings() {
    if (confirm('Reset all UI settings to default? This cannot be undone.')) {
      this.settings = this.getDefaultSettings();
      this.applySettings();
      this.populateUIElementSettings();
      this.saveSettings();
    }
  }
  
  exportSettings() {
    const dataStr = JSON.stringify(this.settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'starforge-ui-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  importSettings(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        this.settings = { ...this.getDefaultSettings(), ...imported };
        this.applySettings();
        this.populateUIElementSettings();
        this.saveSettings();
        
        alert('Settings imported successfully!');
      } catch (error) {
        alert('Failed to import settings. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }
}

// Initialize UI Settings Manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait for HUD Controller to be ready
  if (window.hudController) {
    window.uiSettingsManager = new UISettingsManager();
  } else {
    // Wait for HUD Controller
    const checkHudController = setInterval(() => {
      if (window.hudController) {
        clearInterval(checkHudController);
        window.uiSettingsManager = new UISettingsManager();
      }
    }, 100);
  }
});

// Export for global access
window.UISettingsManager = UISettingsManager;