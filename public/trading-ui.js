/**
 * Trading UI System for StarForgeFrontier
 * Comprehensive trading interface including stations, market orders, and contracts
 */

class TradingUI {
  constructor() {
    this.isInitialized = false;
    this.currentStation = null;
    this.nearbyStations = [];
    this.playerOrders = [];
    this.activeContracts = [];
    this.availableContracts = [];
    this.marketData = new Map();
    this.selectedOreType = null;
    this.tradingMode = 'station'; // 'station', 'market', 'contracts'
    this.priceCharts = new Map();
    this.updateInterval = null;
    
    // Trading configuration
    this.config = {
      maxTradingDistance: 100, // Maximum distance to interact with station
      updateFrequency: 5000,   // Update market data every 5 seconds
      chartPoints: 20,         // Number of price history points to show
      animationDuration: 300   // UI animation duration in ms
    };

    this.init();
  }

  /**
   * Initialize the trading UI system
   */
  init() {
    if (this.isInitialized) return;
    
    this.createTradingInterface();
    this.setupEventListeners();
    this.startDataUpdates();
    this.isInitialized = true;
    
    console.log('Trading UI system initialized');
  }

  /**
   * Create the main trading interface
   */
  createTradingInterface() {
    // Main trading panel
    const tradingPanel = document.createElement('div');
    tradingPanel.id = 'tradingPanel';
    tradingPanel.className = 'trading-panel hidden';
    tradingPanel.innerHTML = this.getTradingPanelHTML();
    document.body.appendChild(tradingPanel);

    // Trading HUD overlay
    const tradingHUD = document.createElement('div');
    tradingHUD.id = 'tradingHUD';
    tradingHUD.className = 'trading-hud';
    tradingHUD.innerHTML = this.getTradingHUDHTML();
    document.body.appendChild(tradingHUD);

    // Station proximity indicator
    const stationIndicator = document.createElement('div');
    stationIndicator.id = 'stationProximity';
    stationIndicator.className = 'station-proximity hidden';
    stationIndicator.innerHTML = this.getStationProximityHTML();
    document.body.appendChild(stationIndicator);

    // Quick trade overlay
    const quickTrade = document.createElement('div');
    quickTrade.id = 'quickTradeOverlay';
    quickTrade.className = 'quick-trade-overlay hidden';
    quickTrade.innerHTML = this.getQuickTradeHTML();
    document.body.appendChild(quickTrade);

    // Trading notifications
    const tradingNotifications = document.createElement('div');
    tradingNotifications.id = 'tradingNotifications';
    tradingNotifications.className = 'trading-notifications';
    document.body.appendChild(tradingNotifications);
  }

  /**
   * Get main trading panel HTML
   */
  getTradingPanelHTML() {
    return `
      <div class="trading-header">
        <div class="trading-tabs">
          <button class="trading-tab active" data-mode="station">
            <i class="tab-icon">🏪</i>
            <span>Trading Stations</span>
          </button>
          <button class="trading-tab" data-mode="market">
            <i class="tab-icon">📊</i>
            <span>Market Orders</span>
          </button>
          <button class="trading-tab" data-mode="contracts">
            <i class="tab-icon">📋</i>
            <span>Contracts</span>
          </button>
        </div>
        <button id="closeTradingPanel" class="close-btn">×</button>
      </div>

      <div class="trading-content">
        <!-- Station Trading Interface -->
        <div id="stationTrading" class="trading-section active">
          <div class="station-selector">
            <div class="section-header">
              <h3>Nearby Trading Stations</h3>
              <button id="refreshStations" class="refresh-btn">🔄</button>
            </div>
            <div id="stationList" class="station-list"></div>
          </div>

          <div class="station-interface" id="stationInterface">
            <div class="station-header">
              <div class="station-info">
                <h3 id="currentStationName">Select a Station</h3>
                <p id="currentStationDescription"></p>
                <div class="station-stats">
                  <span id="stationDistance"></span>
                  <span id="stationType"></span>
                </div>
              </div>
            </div>

            <div class="station-inventory">
              <div class="inventory-header">
                <h4>Station Inventory</h4>
                <div class="view-toggle">
                  <button class="view-btn active" data-view="grid">Grid</button>
                  <button class="view-btn" data-view="list">List</button>
                </div>
              </div>
              <div id="stationInventory" class="inventory-grid"></div>
            </div>

            <div class="trade-interface">
              <div class="trade-controls">
                <div class="ore-selector">
                  <label>Selected Item:</label>
                  <select id="selectedOre">
                    <option value="">Choose an item...</option>
                  </select>
                </div>
                
                <div class="quantity-controls">
                  <label>Quantity:</label>
                  <div class="quantity-input">
                    <button id="decreaseQty" class="qty-btn">-</button>
                    <input id="tradeQuantity" type="number" min="1" max="9999" value="1">
                    <button id="increaseQty" class="qty-btn">+</button>
                  </div>
                  <div class="quantity-presets">
                    <button class="qty-preset" data-percent="25">25%</button>
                    <button class="qty-preset" data-percent="50">50%</button>
                    <button class="qty-preset" data-percent="100">Max</button>
                  </div>
                </div>

                <div class="trade-summary">
                  <div class="price-info">
                    <div class="buy-price">
                      <label>Station Buys:</label>
                      <span id="stationBuyPrice">--</span> per unit
                    </div>
                    <div class="sell-price">
                      <label>Station Sells:</label>
                      <span id="stationSellPrice">--</span> per unit
                    </div>
                  </div>
                  <div class="total-calculation">
                    <div class="total-buy">
                      <label>You Receive:</label>
                      <span id="totalBuyValue">0</span> credits
                    </div>
                    <div class="total-sell">
                      <label>You Pay:</label>
                      <span id="totalSellValue">0</span> credits
                    </div>
                  </div>
                </div>

                <div class="trade-actions">
                  <button id="sellToStation" class="trade-btn sell-btn" disabled>
                    Sell to Station
                  </button>
                  <button id="buyFromStation" class="trade-btn buy-btn" disabled>
                    Buy from Station
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Market Trading Interface -->
        <div id="marketTrading" class="trading-section">
          <div class="market-overview">
            <div class="section-header">
              <h3>Market Overview</h3>
              <select id="marketOreFilter">
                <option value="">All Ores</option>
              </select>
            </div>
            <div id="marketSummary" class="market-summary"></div>
          </div>

          <div class="market-interface">
            <div class="order-book">
              <h4>Order Book</h4>
              <div class="order-book-content">
                <div class="buy-orders">
                  <h5 class="order-type-header">Buy Orders</h5>
                  <div id="buyOrdersList" class="orders-list"></div>
                </div>
                <div class="sell-orders">
                  <h5 class="order-type-header">Sell Orders</h5>
                  <div id="sellOrdersList" class="orders-list"></div>
                </div>
              </div>
            </div>

            <div class="create-order">
              <h4>Create Order</h4>
              <div class="order-form">
                <div class="order-type-selector">
                  <button class="order-type-btn active" data-type="buy">Buy Order</button>
                  <button class="order-type-btn" data-type="sell">Sell Order</button>
                </div>
                
                <div class="order-inputs">
                  <select id="orderOreType">
                    <option value="">Select Ore Type</option>
                  </select>
                  <input id="orderQuantity" type="number" placeholder="Quantity" min="1">
                  <input id="orderPrice" type="number" placeholder="Price per unit" min="1" step="0.01">
                  <select id="orderStation">
                    <option value="">Select Station</option>
                  </select>
                </div>

                <div class="order-summary">
                  <div class="order-total">Total: <span id="orderTotal">0</span> credits</div>
                  <button id="submitOrder" class="submit-order-btn" disabled>Place Order</button>
                </div>
              </div>
            </div>

            <div class="price-chart">
              <h4>Price History</h4>
              <canvas id="priceChart" width="400" height="200"></canvas>
            </div>
          </div>

          <div class="player-orders">
            <div class="section-header">
              <h4>Your Active Orders</h4>
              <button id="refreshOrders" class="refresh-btn">🔄</button>
            </div>
            <div id="activeOrdersList" class="active-orders-list"></div>
          </div>
        </div>

        <!-- Contracts Interface -->
        <div id="contractTrading" class="trading-section">
          <div class="contracts-overview">
            <div class="section-header">
              <h3>Available Contracts</h3>
              <div class="contract-filters">
                <select id="riskFilter">
                  <option value="">All Risk Levels</option>
                  <option value="1">Safe Route</option>
                  <option value="2">Standard Route</option>
                  <option value="3">Dangerous Route</option>
                  <option value="4">Extreme Route</option>
                  <option value="5">Suicide Mission</option>
                </select>
                <select id="rewardFilter">
                  <option value="">All Rewards</option>
                  <option value="1000">1000+ Credits</option>
                  <option value="5000">5000+ Credits</option>
                  <option value="10000">10000+ Credits</option>
                </select>
              </div>
            </div>
            <div id="availableContractsList" class="contracts-list"></div>
          </div>

          <div class="active-contracts">
            <div class="section-header">
              <h3>Your Active Contracts</h3>
              <button id="refreshContracts" class="refresh-btn">🔄</button>
            </div>
            <div id="activeContractsList" class="active-contracts-list"></div>
          </div>

          <div class="contract-details" id="contractDetails">
            <h4>Contract Details</h4>
            <div id="contractDetailsContent">
              <p>Select a contract to view details</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get trading HUD HTML
   */
  getTradingHUDHTML() {
    return `
      <div class="cargo-display">
        <div class="cargo-header">
          <span class="cargo-icon">📦</span>
          <span class="cargo-label">Cargo Hold</span>
        </div>
        <div class="cargo-stats">
          <span id="cargoUsed">0</span>/<span id="cargoCapacity">1000</span>
        </div>
        <div class="cargo-items" id="cargoItems"></div>
      </div>

      <div class="trading-quick-access">
        <button id="openTrading" class="quick-trade-btn" disabled>
          <span class="btn-icon">💰</span>
          <span class="btn-text">Trade</span>
        </button>
        
        <button id="openContracts" class="quick-contracts-btn">
          <span class="btn-icon">📋</span>
          <span class="btn-text">Contracts</span>
        </button>
      </div>

      <div class="trading-alerts" id="tradingAlerts"></div>
    `;
  }

  /**
   * Get station proximity indicator HTML
   */
  getStationProximityHTML() {
    return `
      <div class="proximity-content">
        <div class="station-icon">🏪</div>
        <div class="station-details">
          <h4 id="proximityStationName">Trading Station</h4>
          <p id="proximityStationDistance">Distance: 0</p>
          <button id="dockStation" class="dock-btn">Dock & Trade</button>
        </div>
      </div>
    `;
  }

  /**
   * Get quick trade overlay HTML
   */
  getQuickTradeHTML() {
    return `
      <div class="quick-trade-content">
        <div class="quick-trade-header">
          <h3>Quick Trade</h3>
          <button id="closeQuickTrade" class="close-btn">×</button>
        </div>
        <div class="quick-trade-tabs">
          <button class="quick-tab active" data-action="buy">Quick Buy</button>
          <button class="quick-tab" data-action="sell">Quick Sell</button>
        </div>
        <div class="quick-trade-body">
          <select id="quickOreSelect">
            <option value="">Select item...</option>
          </select>
          <input id="quickQuantity" type="number" placeholder="Quantity" min="1">
          <div class="quick-price-info">
            <span id="quickPricePerUnit">Price: --</span>
            <span id="quickTotalPrice">Total: --</span>
          </div>
          <button id="executeQuickTrade" class="execute-btn" disabled>Execute Trade</button>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for trading interface
   */
  setupEventListeners() {
    // Main trading panel controls
    document.addEventListener('click', (e) => {
      if (e.target.matches('.trading-tab')) {
        this.switchTradingMode(e.target.dataset.mode);
      }
      
      if (e.target.id === 'closeTradingPanel') {
        this.closeTradingPanel();
      }
      
      if (e.target.id === 'openTrading') {
        this.openTradingPanel('station');
      }
      
      if (e.target.id === 'openContracts') {
        this.openTradingPanel('contracts');
      }

      // Station interface controls
      if (e.target.matches('.station-item')) {
        this.selectStation(e.target.dataset.stationId);
      }

      if (e.target.matches('.inventory-item')) {
        this.selectOreType(e.target.dataset.oreType);
      }

      if (e.target.id === 'sellToStation') {
        this.executeTrade('sell');
      }

      if (e.target.id === 'buyFromStation') {
        this.executeTrade('buy');
      }

      if (e.target.id === 'refreshStations') {
        this.refreshStations();
      }

      // Quantity controls
      if (e.target.id === 'increaseQty') {
        this.adjustQuantity(1);
      }

      if (e.target.id === 'decreaseQty') {
        this.adjustQuantity(-1);
      }

      if (e.target.matches('.qty-preset')) {
        this.setQuantityPreset(parseInt(e.target.dataset.percent));
      }

      // Market interface controls
      if (e.target.matches('.order-type-btn')) {
        this.switchOrderType(e.target.dataset.type);
      }

      if (e.target.id === 'submitOrder') {
        this.submitMarketOrder();
      }

      if (e.target.matches('.cancel-order-btn')) {
        this.cancelOrder(e.target.dataset.orderId);
      }

      // Contract controls
      if (e.target.matches('.accept-contract-btn')) {
        this.acceptContract(e.target.dataset.contractId);
      }

      if (e.target.matches('.complete-contract-btn')) {
        this.completeContract(e.target.dataset.contractId);
      }

      if (e.target.matches('.contract-item')) {
        this.showContractDetails(e.target.dataset.contractId);
      }

      // Station proximity
      if (e.target.id === 'dockStation') {
        this.dockAtStation();
      }

      // Quick trade
      if (e.target.id === 'closeQuickTrade') {
        this.closeQuickTrade();
      }

      if (e.target.id === 'executeQuickTrade') {
        this.executeQuickTrade();
      }

      if (e.target.matches('.quick-tab')) {
        this.switchQuickTradeAction(e.target.dataset.action);
      }
    });

    // Input event listeners
    document.addEventListener('input', (e) => {
      if (e.target.id === 'tradeQuantity') {
        this.updateTradeCalculations();
      }

      if (e.target.id === 'selectedOre') {
        this.selectOreType(e.target.value);
      }

      if (e.target.id === 'orderQuantity' || e.target.id === 'orderPrice') {
        this.updateOrderTotal();
      }

      if (e.target.id === 'quickQuantity') {
        this.updateQuickTradeInfo();
      }

      if (e.target.id === 'marketOreFilter') {
        this.filterMarketData(e.target.value);
      }

      if (e.target.id === 'riskFilter' || e.target.id === 'rewardFilter') {
        this.filterContracts();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!document.getElementById('tradingPanel').classList.contains('hidden')) {
          this.closeTradingPanel();
        }
        if (!document.getElementById('quickTradeOverlay').classList.contains('hidden')) {
          this.closeQuickTrade();
        }
      }

      if (e.key === 'T' && !e.ctrlKey && !e.altKey) {
        if (this.nearbyStations.length > 0) {
          this.openTradingPanel('station');
        }
      }

      if (e.key === 'M' && !e.ctrlKey && !e.altKey) {
        this.openTradingPanel('market');
      }

      if (e.key === 'C' && !e.ctrlKey && !e.altKey) {
        this.openTradingPanel('contracts');
      }
    });
  }

  /**
   * Start periodic data updates
   */
  startDataUpdates() {
    this.updateInterval = setInterval(() => {
      this.updateTradingData();
    }, this.config.updateFrequency);

    // Initial update
    this.updateTradingData();
  }

  /**
   * Update all trading-related data
   */
  async updateTradingData() {
    try {
      await Promise.all([
        this.updateNearbyStations(),
        this.updatePlayerOrders(),
        this.updateActiveContracts(),
        this.updateAvailableContracts(),
        this.updateCargoDisplay()
      ]);
    } catch (error) {
      console.error('Error updating trading data:', error);
    }
  }

  /**
   * Update nearby stations based on player position
   */
  async updateNearbyStations() {
    if (!window.gameClient?.myId || !window.gameClient?.players) return;

    const player = window.gameClient.players[window.gameClient.myId];
    if (!player) return;

    const sectorX = Math.floor(player.x / 1000);
    const sectorY = Math.floor(player.y / 1000);

    try {
      const response = await fetch(`/api/trading/stations/${sectorX}/${sectorY}`);
      const stations = await response.json();
      
      this.nearbyStations = stations.map(station => ({
        ...station,
        distance: this.calculateDistance(player, station)
      })).filter(station => station.distance <= this.config.maxTradingDistance);

      this.updateStationsList();
      this.updateStationProximity(player);
    } catch (error) {
      console.error('Error updating nearby stations:', error);
    }
  }

  /**
   * Calculate distance between player and station
   */
  calculateDistance(player, station) {
    const dx = player.x - station.x;
    const dy = player.y - station.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update stations list in UI
   */
  updateStationsList() {
    const stationList = document.getElementById('stationList');
    if (!stationList) return;

    if (this.nearbyStations.length === 0) {
      stationList.innerHTML = '<div class="no-stations">No trading stations in range</div>';
      return;
    }

    stationList.innerHTML = this.nearbyStations.map(station => `
      <div class="station-item ${station.id === this.currentStation?.id ? 'selected' : ''}" 
           data-station-id="${station.id}">
        <div class="station-icon">${this.getStationTypeIcon(station.station_type)}</div>
        <div class="station-details">
          <h4>${station.station_name}</h4>
          <p class="station-type">${station.station_type}</p>
          <p class="station-distance">${Math.round(station.distance)} units</p>
        </div>
        <div class="station-status ${station.distance <= 50 ? 'in-range' : 'out-range'}">
          ${station.distance <= 50 ? 'In Range' : 'Too Far'}
        </div>
      </div>
    `).join('');
  }

  /**
   * Update station proximity indicator
   */
  updateStationProximity(player) {
    const proximityElement = document.getElementById('stationProximity');
    const tradingBtn = document.getElementById('openTrading');
    
    if (!proximityElement || !tradingBtn) return;

    const nearestStation = this.nearbyStations
      .filter(s => s.distance <= 100)
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearestStation) {
      document.getElementById('proximityStationName').textContent = nearestStation.station_name;
      document.getElementById('proximityStationDistance').textContent = 
        `Distance: ${Math.round(nearestStation.distance)} units`;
      
      proximityElement.classList.remove('hidden');
      tradingBtn.disabled = false;
      
      if (nearestStation.distance <= 50) {
        proximityElement.classList.add('in-range');
      } else {
        proximityElement.classList.remove('in-range');
      }
    } else {
      proximityElement.classList.add('hidden');
      tradingBtn.disabled = true;
    }
  }

  /**
   * Get station type icon
   */
  getStationTypeIcon(stationType) {
    const icons = {
      'MINING_DEPOT': '⛏️',
      'RESEARCH_STATION': '🔬',
      'FUEL_DEPOT': '⛽',
      'TRADE_HUB': '🏪',
      'SALVAGE_YARD': '🔧',
      'LUXURY_TRADER': '💎'
    };
    return icons[stationType] || '🏪';
  }

  /**
   * Switch trading mode (station/market/contracts)
   */
  switchTradingMode(mode) {
    this.tradingMode = mode;
    
    // Update tab appearance
    document.querySelectorAll('.trading-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // Update sections visibility
    document.querySelectorAll('.trading-section').forEach(section => {
      section.classList.remove('active');
    });
    
    const sectionIds = {
      station: 'stationTrading',
      market: 'marketTrading',
      contracts: 'contractTrading'
    };
    
    const activeSection = document.getElementById(sectionIds[mode]);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    // Load mode-specific data
    this.loadModeData(mode);
  }

  /**
   * Load data specific to trading mode
   */
  async loadModeData(mode) {
    switch (mode) {
      case 'station':
        await this.updateNearbyStations();
        break;
      case 'market':
        await this.updateMarketData();
        break;
      case 'contracts':
        await this.updateContractData();
        break;
    }
  }

  /**
   * Open trading panel
   */
  openTradingPanel(mode = 'station') {
    const panel = document.getElementById('tradingPanel');
    if (panel) {
      panel.classList.remove('hidden');
      this.switchTradingMode(mode);
    }
  }

  /**
   * Close trading panel
   */
  closeTradingPanel() {
    const panel = document.getElementById('tradingPanel');
    if (panel) {
      panel.classList.add('hidden');
    }
  }

  /**
   * Select a trading station
   */
  async selectStation(stationId) {
    try {
      const response = await fetch(`/api/trading/station/${stationId}`);
      const stationData = await response.json();
      
      this.currentStation = stationData;
      this.updateStationInterface();
      this.updateStationsList(); // Refresh to show selection
    } catch (error) {
      console.error('Error selecting station:', error);
      this.showNotification('Error loading station data', 'error');
    }
  }

  /**
   * Update station interface with current station data
   */
  updateStationInterface() {
    if (!this.currentStation) return;

    const nameEl = document.getElementById('currentStationName');
    const descEl = document.getElementById('currentStationDescription');
    const distanceEl = document.getElementById('stationDistance');
    const typeEl = document.getElementById('stationType');
    const inventoryEl = document.getElementById('stationInventory');
    const oreSelect = document.getElementById('selectedOre');

    if (nameEl) nameEl.textContent = this.currentStation.station_name;
    if (descEl) descEl.textContent = this.getStationDescription(this.currentStation.station_type);
    if (distanceEl) distanceEl.textContent = `Distance: ${Math.round(this.currentStation.distance)} units`;
    if (typeEl) typeEl.textContent = this.currentStation.station_type;

    // Update inventory display
    if (inventoryEl && this.currentStation.inventory) {
      inventoryEl.innerHTML = this.currentStation.inventory.map(item => `
        <div class="inventory-item ${this.selectedOreType === item.oreType ? 'selected' : ''}" 
             data-ore-type="${item.oreType}">
          <div class="ore-icon">${this.getOreIcon(item.oreType)}</div>
          <div class="ore-info">
            <h5>${item.oreName}</h5>
            <div class="ore-stats">
              <span class="stock">Stock: ${item.quantity}/${item.maxQuantity}</span>
              <span class="status ${item.stockStatus.toLowerCase().replace(' ', '-')}">${item.stockStatus}</span>
            </div>
          </div>
          <div class="ore-prices">
            <div class="buy-price">Buy: ${item.buyPrice}</div>
            <div class="sell-price">Sell: ${item.sellPrice}</div>
          </div>
        </div>
      `).join('');

      // Update ore selector
      if (oreSelect) {
        oreSelect.innerHTML = '<option value="">Choose an item...</option>' +
          this.currentStation.inventory.map(item => 
            `<option value="${item.oreType}">${item.oreName}</option>`
          ).join('');
      }
    }
  }

  /**
   * Get station description
   */
  getStationDescription(stationType) {
    const descriptions = {
      'MINING_DEPOT': 'Specialized in raw ore processing and trading',
      'RESEARCH_STATION': 'Advanced technology and exotic matter trading',
      'FUEL_DEPOT': 'Energy and fuel trading hub',
      'TRADE_HUB': 'General trading post for all goods',
      'SALVAGE_YARD': 'Buys damaged goods, sells reclaimed materials',
      'LUXURY_TRADER': 'High-end rare materials and components'
    };
    return descriptions[stationType] || 'Trading station';
  }

  /**
   * Get ore type icon
   */
  getOreIcon(oreType) {
    const icons = {
      'IRON': '⚫',
      'COPPER': '🟤',
      'SILVER': '⚪',
      'GOLD': '🟡',
      'PLATINUM': '💎',
      'TITANIUM': '🔘',
      'URANIUM': '☢️',
      'CRYSTAL': '💠',
      'QUANTUM': '⚡',
      'DARK_MATTER': '🌌'
    };
    return icons[oreType] || '⚪';
  }

  /**
   * Select ore type for trading
   */
  selectOreType(oreType) {
    this.selectedOreType = oreType;
    
    // Update UI selection
    document.querySelectorAll('.inventory-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.oreType === oreType);
    });

    const oreSelect = document.getElementById('selectedOre');
    if (oreSelect) {
      oreSelect.value = oreType;
    }

    this.updateTradeCalculations();
  }

  /**
   * Update trade calculations
   */
  updateTradeCalculations() {
    if (!this.currentStation || !this.selectedOreType) {
      this.clearTradeCalculations();
      return;
    }

    const item = this.currentStation.inventory.find(i => i.oreType === this.selectedOreType);
    if (!item) {
      this.clearTradeCalculations();
      return;
    }

    const quantityEl = document.getElementById('tradeQuantity');
    const quantity = parseInt(quantityEl?.value || 0);

    const stationBuyPriceEl = document.getElementById('stationBuyPrice');
    const stationSellPriceEl = document.getElementById('stationSellPrice');
    const totalBuyValueEl = document.getElementById('totalBuyValue');
    const totalSellValueEl = document.getElementById('totalSellValue');
    const sellBtn = document.getElementById('sellToStation');
    const buyBtn = document.getElementById('buyFromStation');

    if (stationBuyPriceEl) stationBuyPriceEl.textContent = item.buyPrice;
    if (stationSellPriceEl) stationSellPriceEl.textContent = item.sellPrice;
    if (totalBuyValueEl) totalBuyValueEl.textContent = (item.buyPrice * quantity).toLocaleString();
    if (totalSellValueEl) totalSellValueEl.textContent = (item.sellPrice * quantity).toLocaleString();

    // Enable/disable trade buttons based on availability and player resources
    const playerHasOre = this.getPlayerOreQuantity(this.selectedOreType) >= quantity;
    const stationHasStock = item.quantity >= quantity;
    const playerHasCredits = (window.gameClient?.myResources || 0) >= (item.sellPrice * quantity);

    if (sellBtn) {
      sellBtn.disabled = !playerHasOre || quantity <= 0;
    }
    
    if (buyBtn) {
      buyBtn.disabled = !stationHasStock || !playerHasCredits || quantity <= 0;
    }
  }

  /**
   * Clear trade calculations
   */
  clearTradeCalculations() {
    const elements = [
      'stationBuyPrice', 'stationSellPrice', 
      'totalBuyValue', 'totalSellValue'
    ];
    
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '--';
    });

    const sellBtn = document.getElementById('sellToStation');
    const buyBtn = document.getElementById('buyFromStation');
    
    if (sellBtn) sellBtn.disabled = true;
    if (buyBtn) buyBtn.disabled = true;
  }

  /**
   * Get player ore quantity
   */
  getPlayerOreQuantity(oreType) {
    if (!window.gameClient?.playerInventory) return 0;
    return window.gameClient.playerInventory.get(oreType) || 0;
  }

  /**
   * Adjust quantity input
   */
  adjustQuantity(delta) {
    const quantityEl = document.getElementById('tradeQuantity');
    if (!quantityEl) return;

    const currentValue = parseInt(quantityEl.value) || 0;
    const newValue = Math.max(1, currentValue + delta);
    quantityEl.value = newValue;
    this.updateTradeCalculations();
  }

  /**
   * Set quantity preset
   */
  setQuantityPreset(percent) {
    if (!this.currentStation || !this.selectedOreType) return;

    const item = this.currentStation.inventory.find(i => i.oreType === this.selectedOreType);
    if (!item) return;

    const quantityEl = document.getElementById('tradeQuantity');
    if (!quantityEl) return;

    let maxQuantity;
    if (percent === 100) {
      // For selling, use player's ore quantity
      // For buying, use station's available stock or player's credit limit
      const playerOre = this.getPlayerOreQuantity(this.selectedOreType);
      const playerCredits = window.gameClient?.myResources || 0;
      const maxAffordable = Math.floor(playerCredits / item.sellPrice);
      maxQuantity = Math.min(playerOre, item.quantity, maxAffordable);
    } else {
      maxQuantity = Math.floor((item.quantity * percent) / 100);
    }

    quantityEl.value = Math.max(1, maxQuantity);
    this.updateTradeCalculations();
  }

  /**
   * Execute trade transaction
   */
  async executeTrade(action) {
    if (!this.currentStation || !this.selectedOreType) return;

    const quantityEl = document.getElementById('tradeQuantity');
    const quantity = parseInt(quantityEl?.value || 0);

    if (quantity <= 0) {
      this.showNotification('Please enter a valid quantity', 'error');
      return;
    }

    try {
      const endpoint = action === 'buy' ? '/api/trading/buy' : '/api/trading/sell';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: window.gameClient?.myId,
          stationId: this.currentStation.id,
          oreType: this.selectedOreType,
          quantity: quantity
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        const actionText = action === 'buy' ? 'Bought' : 'Sold';
        this.showNotification(
          `${actionText} ${result.quantity} ${this.selectedOreType} for ${result.totalPrice} credits`,
          'success'
        );
        
        // Refresh station data and update UI
        await this.selectStation(this.currentStation.id);
        this.updateCargoDisplay();
      } else {
        this.showNotification(result.error || 'Trade failed', 'error');
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      this.showNotification('Trade failed due to connection error', 'error');
    }
  }

  /**
   * Update market data and interface
   */
  async updateMarketData() {
    try {
      // This would fetch market data from the server
      // Implementation depends on the market system endpoints
      console.log('Updating market data...');
    } catch (error) {
      console.error('Error updating market data:', error);
    }
  }

  /**
   * Update contract data and interface
   */
  async updateContractData() {
    try {
      await Promise.all([
        this.updateAvailableContracts(),
        this.updateActiveContracts()
      ]);
    } catch (error) {
      console.error('Error updating contract data:', error);
    }
  }

  /**
   * Update available contracts
   */
  async updateAvailableContracts() {
    try {
      const response = await fetch('/api/contracts/available');
      const contracts = await response.json();
      this.availableContracts = contracts;
      this.updateAvailableContractsList();
    } catch (error) {
      console.error('Error updating available contracts:', error);
    }
  }

  /**
   * Update active contracts
   */
  async updateActiveContracts() {
    if (!window.gameClient?.myId) return;

    try {
      const response = await fetch(`/api/contracts/player/${window.gameClient.myId}`);
      const contracts = await response.json();
      this.activeContracts = contracts;
      this.updateActiveContractsList();
    } catch (error) {
      console.error('Error updating active contracts:', error);
    }
  }

  /**
   * Update available contracts list
   */
  updateAvailableContractsList() {
    const listEl = document.getElementById('availableContractsList');
    if (!listEl || !this.availableContracts) return;

    if (this.availableContracts.length === 0) {
      listEl.innerHTML = '<div class="no-contracts">No contracts available</div>';
      return;
    }

    listEl.innerHTML = this.availableContracts.map(contract => `
      <div class="contract-item" data-contract-id="${contract.id}">
        <div class="contract-header">
          <div class="contract-title">${contract.title}</div>
          <div class="contract-reward">${contract.reward.toLocaleString()} credits</div>
        </div>
        <div class="contract-details">
          <div class="contract-cargo">${contract.cargoType}: ${contract.cargoQuantity}</div>
          <div class="contract-route">
            ${contract.originStation} → ${contract.destinationStation}
          </div>
          <div class="contract-deadline">
            Deadline: ${new Date(contract.deadline).toLocaleDateString()}
          </div>
        </div>
        <div class="contract-footer">
          <span class="risk-level risk-${contract.riskLevel}">${this.getRiskLevelName(contract.riskLevel)}</span>
          <button class="accept-contract-btn" data-contract-id="${contract.id}">Accept</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update active contracts list
   */
  updateActiveContractsList() {
    const listEl = document.getElementById('activeContractsList');
    if (!listEl || !this.activeContracts) return;

    if (this.activeContracts.length === 0) {
      listEl.innerHTML = '<div class="no-contracts">No active contracts</div>';
      return;
    }

    listEl.innerHTML = this.activeContracts.map(contract => `
      <div class="active-contract-item">
        <div class="contract-header">
          <div class="contract-title">${contract.title}</div>
          <div class="contract-status ${contract.status}">${contract.status}</div>
        </div>
        <div class="contract-progress">
          <div class="progress-info">
            <span>Progress: ${contract.progress}%</span>
            <span>Remaining: ${this.formatTimeRemaining(contract.timeRemaining)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${contract.progress}%"></div>
          </div>
        </div>
        <div class="contract-actions">
          ${contract.status === 'ready_to_complete' ? 
            `<button class="complete-contract-btn" data-contract-id="${contract.id}">Complete</button>` : 
            ''}
        </div>
      </div>
    `).join('');
  }

  /**
   * Get risk level name
   */
  getRiskLevelName(riskLevel) {
    const names = {
      1: 'Safe Route',
      2: 'Standard Route',
      3: 'Dangerous Route',
      4: 'Extreme Route',
      5: 'Suicide Mission'
    };
    return names[riskLevel] || 'Unknown';
  }

  /**
   * Format time remaining
   */
  formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  /**
   * Update cargo display
   */
  updateCargoDisplay() {
    const cargoUsedEl = document.getElementById('cargoUsed');
    const cargoCapacityEl = document.getElementById('cargoCapacity');
    const cargoItemsEl = document.getElementById('cargoItems');

    if (!cargoUsedEl || !cargoCapacityEl) return;

    // This should be integrated with the player's ship data
    const cargoData = this.getPlayerCargoData();
    
    cargoUsedEl.textContent = cargoData.used;
    cargoCapacityEl.textContent = cargoData.capacity;

    if (cargoItemsEl) {
      cargoItemsEl.innerHTML = cargoData.items.map(item => `
        <div class="cargo-item">
          <span class="cargo-ore-icon">${this.getOreIcon(item.type)}</span>
          <span class="cargo-quantity">${item.quantity}</span>
        </div>
      `).join('');
    }
  }

  /**
   * Get player cargo data
   */
  getPlayerCargoData() {
    const inventory = window.gameClient?.playerInventory || new Map();
    const items = [];
    let totalUsed = 0;

    for (const [oreType, quantity] of inventory.entries()) {
      if (quantity > 0) {
        items.push({ type: oreType, quantity });
        totalUsed += quantity;
      }
    }

    return {
      used: totalUsed,
      capacity: window.gameClient?.shipProperties?.cargoCapacity || 1000,
      items
    };
  }

  /**
   * Update player orders
   */
  async updatePlayerOrders() {
    if (!window.gameClient?.myId) return;

    try {
      const response = await fetch(`/api/trading/orders/${window.gameClient.myId}`);
      const orders = await response.json();
      this.playerOrders = orders;
      this.updatePlayerOrdersList();
    } catch (error) {
      console.error('Error updating player orders:', error);
    }
  }

  /**
   * Update player orders list
   */
  updatePlayerOrdersList() {
    const listEl = document.getElementById('activeOrdersList');
    if (!listEl || !this.playerOrders) return;

    if (this.playerOrders.length === 0) {
      listEl.innerHTML = '<div class="no-orders">No active orders</div>';
      return;
    }

    listEl.innerHTML = this.playerOrders.map(order => `
      <div class="order-item">
        <div class="order-info">
          <span class="order-type ${order.orderType}">${order.orderType.toUpperCase()}</span>
          <span class="order-ore">${order.oreType}</span>
          <span class="order-quantity">${order.quantity}</span>
          <span class="order-price">${order.pricePerUnit} each</span>
        </div>
        <div class="order-actions">
          <button class="cancel-order-btn" data-order-id="${order.id}">Cancel</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Refresh stations list
   */
  async refreshStations() {
    await this.updateNearbyStations();
    this.showNotification('Stations updated', 'info');
  }

  /**
   * Dock at nearest station
   */
  dockAtStation() {
    const nearestStation = this.nearbyStations
      .filter(s => s.distance <= 50)
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearestStation) {
      this.selectStation(nearestStation.id);
      this.openTradingPanel('station');
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const container = document.getElementById('tradingNotifications');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `trading-notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Remove event listeners and UI elements
    const elements = ['tradingPanel', 'tradingHUD', 'stationProximity', 'quickTradeOverlay'];
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    this.isInitialized = false;
  }
}

// Export for use in other modules
window.TradingUI = TradingUI;