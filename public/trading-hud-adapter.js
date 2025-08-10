/**
 * Trading HUD Adapter
 * Adapts the existing trading system to work with the new HUD panels
 */

class TradingHUDAdapter {
  constructor() {
    this.isInitialized = false;
    this.currentTab = 'stations';
    this.nearbyStations = [];
    this.marketData = {};
    this.activeContracts = [];
    this.init();
  }
  
  init() {
    // Listen for HUD events
    document.addEventListener('hud:trading:show', () => this.onPanelShow());
    document.addEventListener('hud:trading:hide', () => this.onPanelHide());
    document.addEventListener('hud:trading:fullscreen', () => this.onFullscreenRequest());
    
    // Listen for trading data updates
    document.addEventListener('tradingStationsUpdated', (e) => this.updateStationsData(e.detail));
    document.addEventListener('marketDataUpdated', (e) => this.updateMarketData(e.detail));
    document.addEventListener('contractsUpdated', (e) => this.updateContractsData(e.detail));
    
    this.setupEventListeners();
    this.isInitialized = true;
  }
  
  setupEventListeners() {
    // Handle tab clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('trading-tab')) {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      }
    });
    
    // Handle expand button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'tradingExpand') {
        this.onFullscreenRequest();
      }
    });
  }
  
  onPanelShow() {
    this.loadTradingContent();
    this.refreshTradingData();
  }
  
  onPanelHide() {
    // Cleanup if needed
  }
  
  onFullscreenRequest() {
    // Open the original trading interface for full functionality
    if (typeof window.tradingUI !== 'undefined' && window.tradingUI.togglePanel) {
      window.tradingUI.togglePanel();
    } else {
      // Fallback to original trading panel
      const originalPanel = document.getElementById('tradingPanel');
      if (originalPanel) {
        originalPanel.classList.remove('hidden');
      }
    }
  }
  
  loadTradingContent() {
    const content = this.generateTradingContent();
    window.hudController.updatePanelContent('trading', content);
  }
  
  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab appearance
    const tabs = document.querySelectorAll('#tradingHudPanel .trading-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update content
    this.loadTradingContent();
  }
  
  updateStationsData(data) {
    this.nearbyStations = data || [];
    if (window.hudController.isVisible('trading') && this.currentTab === 'stations') {
      this.loadTradingContent();
    }
    
    // Update badge with nearby stations count
    const inRangeStations = this.nearbyStations.filter(s => s.inRange).length;
    window.hudController.setBadge('trading', inRangeStations);
  }
  
  updateMarketData(data) {
    this.marketData = data || {};
    if (window.hudController.isVisible('trading') && this.currentTab === 'market') {
      this.loadTradingContent();
    }
  }
  
  updateContractsData(data) {
    this.activeContracts = data || [];
    if (window.hudController.isVisible('trading') && this.currentTab === 'contracts') {
      this.loadTradingContent();
    }
  }
  
  generateTradingContent() {
    switch(this.currentTab) {
      case 'stations':
        return this.generateStationsContent();
      case 'market':
        return this.generateMarketContent();
      case 'contracts':
        return this.generateContractsContent();
      default:
        return '<div class="hud-text-center">Invalid tab</div>';
    }
  }
  
  generateStationsContent() {
    if (!this.nearbyStations || this.nearbyStations.length === 0) {
      return `
        <div class="hud-text-center hud-opacity-75" style="padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 8px;">🏭</div>
          <div style="font-size: 12px;">No nearby trading stations</div>
          <div style="font-size: 10px; margin-top: 4px;">Explore sectors to find trading opportunities</div>
        </div>
      `;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    
    // Sort stations by distance or in-range status
    const sortedStations = [...this.nearbyStations].sort((a, b) => {
      if (a.inRange && !b.inRange) return -1;
      if (!a.inRange && b.inRange) return 1;
      return (a.distance || 0) - (b.distance || 0);
    });
    
    sortedStations.forEach(station => {
      const statusColor = station.inRange ? '#28a745' : '#fd7e14';
      const statusText = station.inRange ? 'IN RANGE' : `${station.distance}km`;
      
      html += `
        <div class="trading-station-compact" style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 2px solid ${statusColor}; cursor: pointer;" onclick="window.tradingHUDAdapter.selectStation('${station.id}')">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-weight: 600; font-size: 12px; color: white;">${station.name}</div>
            <div style="font-size: 9px; color: ${statusColor}; font-weight: 600;">${statusText}</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 10px; color: var(--hud-text-secondary);">${station.type || 'Trading Station'}</div>
            <div style="font-size: 10px; color: var(--hud-text-secondary);">${station.sector}</div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Add quick action buttons
    html += `
      <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button class="guild-action-btn" onclick="window.tradingHUDAdapter.quickTrade()" style="flex: 1; font-size: 11px;" ${sortedStations.filter(s => s.inRange).length === 0 ? 'disabled' : ''}>
          Quick Trade
        </button>
        <button class="guild-action-btn" onclick="window.tradingHUDAdapter.refreshTradingData()" style="width: auto; padding: 8px; font-size: 11px;">
          🔄
        </button>
      </div>
    `;
    
    return html;
  }
  
  generateMarketContent() {
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    
    if (!this.marketData || Object.keys(this.marketData).length === 0) {
      html += `
        <div class="hud-text-center hud-opacity-75" style="padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 8px;">📈</div>
          <div style="font-size: 12px;">No market data available</div>
        </div>
      `;
    } else {
      // Show top trading commodities
      const commodities = Object.entries(this.marketData).slice(0, 4);
      
      commodities.forEach(([commodity, data]) => {
        const priceChange = data.priceChange || 0;
        const changeColor = priceChange >= 0 ? '#28a745' : '#dc3545';
        const changeSymbol = priceChange >= 0 ? '+' : '';
        
        html += `
          <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-weight: 600; font-size: 12px; color: white;">${commodity}</div>
              <div style="color: ${changeColor}; font-size: 11px; font-weight: 600;">
                ${changeSymbol}${priceChange}%
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: var(--hud-text-secondary);">
              <span>Buy: ${data.buyPrice || 'N/A'}</span>
              <span>Sell: ${data.sellPrice || 'N/A'}</span>
              <span>Vol: ${data.volume || '0'}</span>
            </div>
          </div>
        `;
      });
    }
    
    html += '</div>';
    
    // Add market actions
    html += `
      <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button class="guild-action-btn" onclick="window.tradingHUDAdapter.openFullInterface()" style="flex: 1; font-size: 11px;">
          Market Orders
        </button>
        <button class="guild-action-btn" onclick="window.tradingHUDAdapter.refreshTradingData()" style="width: auto; padding: 8px; font-size: 11px;">
          🔄
        </button>
      </div>
    `;
    
    return html;
  }
  
  generateContractsContent() {
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    
    if (!this.activeContracts || this.activeContracts.length === 0) {
      html += `
        <div class="hud-text-center hud-opacity-75" style="padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 8px;">📋</div>
          <div style="font-size: 12px;">No active contracts</div>
          <div style="font-size: 10px; margin-top: 4px;">Visit trading stations to find contracts</div>
        </div>
      `;
    } else {
      this.activeContracts.slice(0, 3).forEach(contract => {
        const progressPercent = contract.progress || 0;
        const rewardColor = this.getContractRewardColor(contract.reward);
        
        html += `
          <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 2px solid ${rewardColor};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="font-weight: 600; font-size: 11px; color: white;">${contract.title}</div>
              <div style="font-size: 10px; color: ${rewardColor}; font-weight: 600;">
                ${contract.reward} credits
              </div>
            </div>
            <div style="font-size: 9px; color: var(--hud-text-secondary); margin-bottom: 6px;">
              ${contract.description}
            </div>
            <div style="margin-bottom: 4px;">
              <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div style="height: 100%; background: ${rewardColor}; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--hud-text-secondary);">
              <span>Progress: ${progressPercent}%</span>
              <span>${contract.deadline || 'No deadline'}</span>
            </div>
          </div>
        `;
      });
    }
    
    html += '</div>';
    
    // Add contract actions
    html += `
      <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button class="guild-action-btn" onclick="window.tradingHUDAdapter.openFullInterface()" style="flex: 1; font-size: 11px;">
          All Contracts
        </button>
        <button class="guild-action-btn" onclick="window.tradingHUDAdapter.refreshTradingData()" style="width: auto; padding: 8px; font-size: 11px;">
          🔄
        </button>
      </div>
    `;
    
    return html;
  }
  
  getContractRewardColor(reward) {
    if (reward >= 10000) return '#ffd700';
    if (reward >= 5000) return '#ff8c00';
    if (reward >= 1000) return '#32cd32';
    return '#87ceeb';
  }
  
  selectStation(stationId) {
    // Handle station selection
    console.log('Selected station:', stationId);
    // This could open a quick trading interface or navigate to the station
  }
  
  quickTrade() {
    // Open a quick trade dialog for nearby stations
    if (typeof window.tradingUI !== 'undefined' && window.tradingUI.showQuickTrade) {
      window.tradingUI.showQuickTrade();
    }
  }
  
  refreshTradingData() {
    // Trigger trading data refresh
    if (typeof window.socket !== 'undefined') {
      window.socket.emit('requestTradingUpdate');
    }
    
    // Visual feedback
    const refreshBtn = document.querySelector('#tradingRefresh');
    if (refreshBtn) {
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshBtn.style.transform = '';
      }, 300);
    }
  }
  
  openFullInterface() {
    window.hudController.hidePanel('trading');
    this.onFullscreenRequest();
  }
}

// Initialize the adapter
window.tradingHUDAdapter = new TradingHUDAdapter();