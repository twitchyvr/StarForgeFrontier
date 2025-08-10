/**
 * Faction HUD Adapter
 * Adapts the existing faction system to work with the new HUD panels
 */

class FactionHUDAdapter {
  constructor() {
    this.isInitialized = false;
    this.factionsData = [];
    this.init();
  }
  
  init() {
    // Listen for HUD events
    document.addEventListener('hud:faction:show', () => this.onPanelShow());
    document.addEventListener('hud:faction:hide', () => this.onPanelHide());
    document.addEventListener('hud:faction:fullscreen', () => this.onFullscreenRequest());
    
    // Listen for faction data updates
    document.addEventListener('factionsUpdated', (e) => this.updateFactionsData(e.detail));
    
    this.isInitialized = true;
  }
  
  onPanelShow() {
    this.loadFactionContent();
    this.refreshFactionData();
  }
  
  onPanelHide() {
    // Cleanup or save state if needed
  }
  
  onFullscreenRequest() {
    // Open the original faction modal for full functionality
    if (typeof window.factionUI !== 'undefined' && window.factionUI.togglePanel) {
      window.factionUI.togglePanel();
    } else {
      // Fallback to original faction panel
      const originalPanel = document.getElementById('factionPanel');
      if (originalPanel) {
        originalPanel.classList.remove('hidden');
      }
    }
  }
  
  loadFactionContent() {
    const content = this.generateCompactFactionList();
    window.hudController.updatePanelContent('faction', content);
  }
  
  updateFactionsData(data) {
    this.factionsData = data || [];
    if (window.hudController.isVisible('faction')) {
      this.loadFactionContent();
    }
    
    // Update badge count
    const hostileFactions = this.factionsData.filter(f => f.reputation < -500).length;
    window.hudController.setBadge('faction', hostileFactions);
  }
  
  generateCompactFactionList() {
    if (!this.factionsData || this.factionsData.length === 0) {
      return '<div class="hud-text-center hud-opacity-75">No faction data available</div>';
    }
    
    const sortedFactions = [...this.factionsData].sort((a, b) => b.reputation - a.reputation);
    
    let html = '<div class="faction-list">';
    
    sortedFactions.forEach(faction => {
      const repLevel = this.getReputationLevel(faction.reputation);
      const repColor = this.getReputationColor(faction.reputation);
      
      html += `
        <div class="faction-item" data-faction-id="${faction.id}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; color: white; font-size: 13px;">${faction.name}</div>
              <div style="font-size: 10px; color: var(--hud-text-secondary); text-transform: uppercase;">
                ${faction.type || 'Unknown'}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: ${repColor}; font-size: 14px;">
                ${faction.reputation}
              </div>
              <div style="font-size: 9px; color: ${repColor}; text-transform: uppercase;">
                ${repLevel}
              </div>
            </div>
          </div>
          <div style="margin-top: 6px;">
            <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; background: ${repColor}; width: ${this.getReputationBarWidth(faction.reputation)}%; transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Add quick actions
    html += `
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button class="guild-action-btn" onclick="window.factionHUDAdapter.openFullInterface()" style="flex: 1;">
          Full View
        </button>
        <button class="guild-action-btn" onclick="window.factionHUDAdapter.refreshFactionData()" style="width: auto; padding: 8px;">
          🔄
        </button>
      </div>
    `;
    
    return html;
  }
  
  getReputationLevel(rep) {
    if (rep >= 1000) return 'Allied';
    if (rep >= 500) return 'Friendly';
    if (rep >= 100) return 'Cordial';
    if (rep >= -100) return 'Neutral';
    if (rep >= -500) return 'Unfriendly';
    if (rep >= -1000) return 'Hostile';
    return 'Enemy';
  }
  
  getReputationColor(rep) {
    if (rep >= 500) return '#28a745';
    if (rep >= 100) return '#20c997';
    if (rep >= -100) return '#6c757d';
    if (rep >= -500) return '#fd7e14';
    return '#dc3545';
  }
  
  getReputationBarWidth(rep) {
    // Normalize reputation to 0-100% scale
    const normalizedRep = Math.max(0, Math.min(100, (rep + 1000) / 20));
    return normalizedRep;
  }
  
  refreshFactionData() {
    // Trigger faction data refresh
    if (typeof window.socket !== 'undefined') {
      window.socket.emit('requestFactionUpdate');
    }
    
    // Visual feedback
    const refreshBtn = document.querySelector('#factionRefresh');
    if (refreshBtn) {
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshBtn.style.transform = '';
      }, 300);
    }
  }
  
  openFullInterface() {
    window.hudController.hidePanel('faction');
    this.onFullscreenRequest();
  }
}

// Initialize the adapter
window.factionHUDAdapter = new FactionHUDAdapter();

// Handle clicks on faction items
document.addEventListener('click', (e) => {
  const factionItem = e.target.closest('.faction-item[data-faction-id]');
  if (factionItem) {
    const factionId = factionItem.dataset.factionId;
    // You can add faction-specific actions here
    console.log('Clicked faction:', factionId);
  }
});