/**
 * Galaxy UI Module for StarForgeFrontier
 * Handles galaxy map, warp controls, and sector navigation
 */

class GalaxyUI {
  constructor(gameClient) {
    this.gameClient = gameClient;
    this.isGalaxyMapOpen = false;
    this.currentSector = { x: 0, y: 0 };
    this.galaxyMapData = new Map();
    this.discoveredSectors = new Set();
    this.selectedWarpTarget = null;
    this.warpDestinations = [];
    this.currentWarpStatus = null;
    this.mapViewCenter = { x: 0, y: 0 };
    this.mapZoom = 1;
    this.sectorSize = 40; // Size of each sector cell in pixels
    
    // Biome color mapping
    this.biomeColors = {
      'Asteroid Field': '#8B7355',
      'Nebula': '#FF6B9D', 
      'Deep Space': '#1a1a2e',
      'Stellar Nursery': '#FFD700',
      'Ancient Ruins': '#4A90E2',
      'Black Hole Region': '#2C003E'
    };
    
    this.init();
  }

  /**
   * Initialize galaxy UI components
   */
  init() {
    this.createGalaxyMapModal();
    this.createWarpControls();
    this.createSectorHUD();
    this.createNavigationCompass();
    this.setupEventListeners();
    this.startWarpStatusUpdates();
  }

  /**
   * Create the galaxy map modal interface
   */
  createGalaxyMapModal() {
    const galaxyModal = document.createElement('div');
    galaxyModal.id = 'galaxyMapModal';
    galaxyModal.className = 'galaxy-modal hidden';
    
    galaxyModal.innerHTML = `
      <div class="galaxy-modal-content">
        <div class="galaxy-modal-header">
          <h2>Galaxy Map</h2>
          <div class="galaxy-controls">
            <button id="centerOnPlayer" class="galaxy-btn">Center on Player</button>
            <button id="closeGalaxyMap" class="close-btn">×</button>
          </div>
        </div>
        
        <div class="galaxy-map-container">
          <canvas id="galaxyMapCanvas" width="600" height="600"></canvas>
          <div class="galaxy-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #00ff00"></div>
              <span>Current Location</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #ffff00"></div>
              <span>Selected Target</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgba(255,255,255,0.3)"></div>
              <span>Discovered</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: rgba(100,100,100,0.5)"></div>
              <span>Undiscovered</span>
            </div>
          </div>
        </div>
        
        <div class="galaxy-sidebar">
          <div class="sector-info-panel">
            <h3>Sector Information</h3>
            <div id="selectedSectorInfo">
              <p>Click a sector to view details</p>
            </div>
          </div>
          
          <div class="warp-planning-panel">
            <h3>Warp Planning</h3>
            <div id="warpPlanningInfo">
              <div class="warp-stat">
                <span class="label">Distance:</span>
                <span id="warpDistance">-</span>
              </div>
              <div class="warp-stat">
                <span class="label">Fuel Cost:</span>
                <span id="warpFuelCost">-</span>
              </div>
              <div class="warp-stat">
                <span class="label">Travel Time:</span>
                <span id="warpTravelTime">-</span>
              </div>
              <div class="warp-buttons">
                <button id="initiateWarp" class="warp-btn primary" disabled>Initiate Warp</button>
                <button id="emergencyWarp" class="warp-btn emergency" disabled>Emergency Warp</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(galaxyModal);
    
    this.galaxyMapCanvas = document.getElementById('galaxyMapCanvas');
    this.galaxyMapCtx = this.galaxyMapCanvas.getContext('2d');
  }

  /**
   * Create warp drive controls in the main HUD
   */
  createWarpControls() {
    const warpControlsHTML = `
      <div class="hud-section warp-controls">
        <div class="warp-drive-status">
          <div class="stat-item">
            <span class="stat-label">Warp Fuel</span>
            <span id="warpFuel" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Drive Status</span>
            <span id="warpStatus" class="stat-value">Ready</span>
          </div>
        </div>
        <div class="warp-actions">
          <button id="openGalaxyMap" class="action-btn" title="Open Galaxy Map">
            <span class="btn-icon">🗺️</span>
            <span class="btn-text">Galaxy</span>
          </button>
          <button id="quickWarp" class="action-btn" title="Quick Warp">
            <span class="btn-icon">⚡</span>
            <span class="btn-text">Quick Warp</span>
          </button>
        </div>
      </div>
    `;
    
    // Insert after existing HUD sections
    const hudElement = document.getElementById('hud');
    const quickActionsSection = hudElement.querySelector('.quick-actions');
    quickActionsSection.insertAdjacentHTML('afterend', warpControlsHTML);
  }

  /**
   * Create sector information HUD
   */
  createSectorHUD() {
    const sectorHUDHTML = `
      <div class="hud-section sector-info">
        <div class="stat-item">
          <span class="stat-label">Current Sector</span>
          <span id="currentSectorCoords" class="stat-value">0, 0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Biome</span>
          <span id="currentBiome" class="stat-value">Unknown</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Resources</span>
          <span id="sectorResources" class="stat-value">0</span>
        </div>
      </div>
    `;
    
    const hudElement = document.getElementById('hud');
    const playerStatsSection = hudElement.querySelector('.player-stats');
    playerStatsSection.insertAdjacentHTML('afterend', sectorHUDHTML);
  }

  /**
   * Create navigation compass
   */
  createNavigationCompass() {
    const compassHTML = `
      <div id="navigationCompass" class="navigation-compass">
        <div class="compass-ring">
          <div class="compass-pointer" id="compassPointer"></div>
          <div class="compass-labels">
            <span class="compass-label north">N</span>
            <span class="compass-label east">E</span>
            <span class="compass-label south">S</span>
            <span class="compass-label west">W</span>
          </div>
        </div>
        <div class="compass-center">
          <span id="compassDirection">N</span>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', compassHTML);
  }

  /**
   * Setup event listeners for galaxy UI
   */
  setupEventListeners() {
    // Galaxy map controls
    document.getElementById('openGalaxyMap').addEventListener('click', () => {
      this.toggleGalaxyMap();
    });
    
    document.getElementById('closeGalaxyMap').addEventListener('click', () => {
      this.closeGalaxyMap();
    });
    
    document.getElementById('centerOnPlayer').addEventListener('click', () => {
      this.centerMapOnPlayer();
    });
    
    // Galaxy map canvas interactions
    this.galaxyMapCanvas.addEventListener('click', (e) => {
      this.handleGalaxyMapClick(e);
    });
    
    this.galaxyMapCanvas.addEventListener('mousemove', (e) => {
      this.handleGalaxyMapHover(e);
    });
    
    // Warp controls
    document.getElementById('quickWarp').addEventListener('click', () => {
      this.showQuickWarpOptions();
    });
    
    document.getElementById('initiateWarp').addEventListener('click', () => {
      this.initiateWarp(false);
    });
    
    document.getElementById('emergencyWarp').addEventListener('click', () => {
      this.initiateWarp(true);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        this.toggleGalaxyMap();
      } else if (e.key === 'Escape' && this.isGalaxyMapOpen) {
        this.closeGalaxyMap();
      }
    });
  }

  /**
   * Toggle galaxy map visibility
   */
  toggleGalaxyMap() {
    const modal = document.getElementById('galaxyMapModal');
    if (this.isGalaxyMapOpen) {
      this.closeGalaxyMap();
    } else {
      this.openGalaxyMap();
    }
  }

  /**
   * Open galaxy map
   */
  async openGalaxyMap() {
    const modal = document.getElementById('galaxyMapModal');
    modal.classList.remove('hidden');
    this.isGalaxyMapOpen = true;
    
    // Request galaxy map data from server
    await this.requestGalaxyMapData();
    await this.requestWarpTargets();
    
    // Center on player's current position
    this.centerMapOnPlayer();
    
    // Render the map
    this.renderGalaxyMap();
  }

  /**
   * Close galaxy map
   */
  closeGalaxyMap() {
    const modal = document.getElementById('galaxyMapModal');
    modal.classList.add('hidden');
    this.isGalaxyMapOpen = false;
    this.selectedWarpTarget = null;
  }

  /**
   * Center map view on player's current sector
   */
  centerMapOnPlayer() {
    this.mapViewCenter = { ...this.currentSector };
    if (this.isGalaxyMapOpen) {
      this.renderGalaxyMap();
    }
  }

  /**
   * Request galaxy map data from server
   */
  async requestGalaxyMapData() {
    if (this.gameClient.ws.readyState === WebSocket.OPEN) {
      this.gameClient.ws.send(JSON.stringify({
        type: 'request_galaxy_map',
        radius: 10 // Request 10x10 sector area around player
      }));
    }
  }

  /**
   * Request available warp targets
   */
  async requestWarpTargets() {
    if (this.gameClient.ws.readyState === WebSocket.OPEN) {
      this.gameClient.ws.send(JSON.stringify({
        type: 'request_warp_targets',
        maxRange: 8
      }));
    }
  }

  /**
   * Handle galaxy map data from server
   */
  handleGalaxyMapData(data) {
    this.galaxyMapData.clear();
    
    data.sectors.forEach(sector => {
      const key = `${sector.coordinates.x}_${sector.coordinates.y}`;
      this.galaxyMapData.set(key, sector);
      
      if (sector.isDiscovered) {
        this.discoveredSectors.add(key);
      }
    });
    
    if (this.isGalaxyMapOpen) {
      this.renderGalaxyMap();
    }
  }

  /**
   * Handle warp targets data from server
   */
  handleWarpTargetsData(data) {
    this.warpDestinations = data.destinations || [];
    this.warpDriveRating = data.warpDriveRating || {};
    
    // Update warp drive status display
    this.updateWarpDriveStatus();
    
    if (this.isGalaxyMapOpen) {
      this.renderGalaxyMap();
    }
  }

  /**
   * Render the galaxy map
   */
  renderGalaxyMap() {
    if (!this.galaxyMapCanvas) return;
    
    const ctx = this.galaxyMapCtx;
    const canvas = this.galaxyMapCanvas;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate drawing parameters
    const mapRadius = 10;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const sectorSize = this.sectorSize * this.mapZoom;
    
    // Draw grid
    this.drawGrid(ctx, centerX, centerY, sectorSize, mapRadius);
    
    // Draw sectors
    for (let x = this.mapViewCenter.x - mapRadius; x <= this.mapViewCenter.x + mapRadius; x++) {
      for (let y = this.mapViewCenter.y - mapRadius; y <= this.mapViewCenter.y + mapRadius; y++) {
        const sectorCoords = { x, y };
        const screenX = centerX + (x - this.mapViewCenter.x) * sectorSize;
        const screenY = centerY + (y - this.mapViewCenter.y) * sectorSize;
        
        this.drawSector(ctx, screenX, screenY, sectorSize, sectorCoords);
      }
    }
    
    // Draw warp range indicator
    this.drawWarpRange(ctx, centerX, centerY, sectorSize);
    
    // Draw legend and coordinates
    this.drawMapInfo(ctx);
  }

  /**
   * Draw grid lines on galaxy map
   */
  drawGrid(ctx, centerX, centerY, sectorSize, radius) {
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
    ctx.lineWidth = 1;
    
    for (let i = -radius; i <= radius; i++) {
      // Vertical lines
      const x = centerX + i * sectorSize;
      ctx.beginPath();
      ctx.moveTo(x, centerY - radius * sectorSize);
      ctx.lineTo(x, centerY + radius * sectorSize);
      ctx.stroke();
      
      // Horizontal lines
      const y = centerY + i * sectorSize;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * sectorSize, y);
      ctx.lineTo(centerX + radius * sectorSize, y);
      ctx.stroke();
    }
  }

  /**
   * Draw individual sector on galaxy map
   */
  drawSector(ctx, x, y, size, coords) {
    const sectorKey = `${coords.x}_${coords.y}`;
    const sector = this.galaxyMapData.get(sectorKey);
    const isCurrentSector = coords.x === this.currentSector.x && coords.y === this.currentSector.y;
    const isSelected = this.selectedWarpTarget && 
                     this.selectedWarpTarget.x === coords.x && 
                     this.selectedWarpTarget.y === coords.y;
    const isDiscovered = this.discoveredSectors.has(sectorKey);
    const isWarpable = this.warpDestinations.some(dest => 
      dest.coordinates.x === coords.x && dest.coordinates.y === coords.y
    );
    
    // Determine sector color
    let fillColor = 'rgba(100, 100, 100, 0.5)'; // Default undiscovered
    let strokeColor = 'rgba(255, 255, 255, 0.3)';
    
    if (sector && sector.biome) {
      fillColor = this.biomeColors[sector.biome.name] || fillColor;
      if (!isDiscovered) {
        // Dim undiscovered sectors
        fillColor = this.adjustColorAlpha(fillColor, 0.3);
      }
    }
    
    // Special colors for states
    if (isCurrentSector) {
      strokeColor = '#00ff00';
      ctx.lineWidth = 3;
    } else if (isSelected) {
      strokeColor = '#ffff00';
      ctx.lineWidth = 2;
    } else if (isWarpable) {
      strokeColor = 'rgba(0, 255, 255, 0.6)';
      ctx.lineWidth = 1;
    } else {
      ctx.lineWidth = 1;
    }
    
    // Draw sector background
    ctx.fillStyle = fillColor;
    ctx.fillRect(x - size/2, y - size/2, size, size);
    
    // Draw sector border
    ctx.strokeStyle = strokeColor;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    
    // Draw sector indicators
    if (sector && sector.playerCount > 0) {
      // Player indicator
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(x + size/2 - 4, y - size/2 + 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (isDiscovered && sector) {
      // Resource indicator (if sector has good resources)
      const resourceRating = this.calculateResourceRating(sector);
      if (resourceRating > 0.7) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(x - size/2 + 2, y + size/2 - 6, 4, 4);
      }
    }
    
    // Draw coordinates for current sector
    if (isCurrentSector) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${coords.x},${coords.y}`, x, y + size/2 + 12);
    }
  }

  /**
   * Draw warp range indicator
   */
  drawWarpRange(ctx, centerX, centerY, sectorSize) {
    if (!this.warpDriveRating || !this.warpDriveRating.maxRange) return;
    
    const maxRange = this.warpDriveRating.maxRange;
    const rangeRadius = maxRange * sectorSize;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, rangeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw map information and coordinates
   */
  drawMapInfo(ctx) {
    // Draw current view coordinates
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Map Center: (${this.mapViewCenter.x}, ${this.mapViewCenter.y})`, 10, 20);
    ctx.fillText(`Zoom: ${this.mapZoom.toFixed(1)}x`, 10, 35);
  }

  /**
   * Handle click on galaxy map
   */
  handleGalaxyMapClick(event) {
    const rect = this.galaxyMapCanvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Convert screen coordinates to sector coordinates
    const centerX = this.galaxyMapCanvas.width / 2;
    const centerY = this.galaxyMapCanvas.height / 2;
    const sectorSize = this.sectorSize * this.mapZoom;
    
    const sectorX = Math.floor(this.mapViewCenter.x + (clickX - centerX) / sectorSize + 0.5);
    const sectorY = Math.floor(this.mapViewCenter.y + (clickY - centerY) / sectorSize + 0.5);
    
    this.selectSector({ x: sectorX, y: sectorY });
  }

  /**
   * Handle hover on galaxy map
   */
  handleGalaxyMapHover(event) {
    const rect = this.galaxyMapCanvas.getBoundingClientRect();
    const hoverX = event.clientX - rect.left;
    const hoverY = event.clientY - rect.top;
    
    // Convert to sector coordinates
    const centerX = this.galaxyMapCanvas.width / 2;
    const centerY = this.galaxyMapCanvas.height / 2;
    const sectorSize = this.sectorSize * this.mapZoom;
    
    const sectorX = Math.floor(this.mapViewCenter.x + (hoverX - centerX) / sectorSize + 0.5);
    const sectorY = Math.floor(this.mapViewCenter.y + (hoverY - centerY) / sectorSize + 0.5);
    
    // Update cursor based on sector type
    const sectorKey = `${sectorX}_${sectorY}`;
    const isWarpable = this.warpDestinations.some(dest => 
      dest.coordinates.x === sectorX && dest.coordinates.y === sectorY
    );
    
    this.galaxyMapCanvas.style.cursor = isWarpable ? 'pointer' : 'default';
  }

  /**
   * Select a sector and show its information
   */
  selectSector(coords) {
    const sectorKey = `${coords.x}_${coords.y}`;
    const sector = this.galaxyMapData.get(sectorKey);
    const isWarpable = this.warpDestinations.some(dest => 
      dest.coordinates.x === coords.x && dest.coordinates.y === coords.y
    );
    
    // Update selected sector info
    const infoPanel = document.getElementById('selectedSectorInfo');
    
    if (sector) {
      const distance = Math.sqrt(
        (coords.x - this.currentSector.x) ** 2 + 
        (coords.y - this.currentSector.y) ** 2
      );
      
      infoPanel.innerHTML = `
        <div class="sector-detail">
          <h4>Sector (${coords.x}, ${coords.y})</h4>
          <div class="sector-biome" style="color: ${sector.biome?.color || '#fff'}">
            ${sector.biome?.name || 'Unknown Biome'}
          </div>
          <div class="sector-stats">
            <div>Distance: ${distance.toFixed(1)} sectors</div>
            <div>Players: ${sector.playerCount || 0}</div>
            <div>Status: ${this.discoveredSectors.has(sectorKey) ? 'Discovered' : 'Undiscovered'}</div>
          </div>
          ${sector.biome?.description ? `<p class="sector-description">${sector.biome.description}</p>` : ''}
        </div>
      `;
    } else {
      infoPanel.innerHTML = `
        <div class="sector-detail">
          <h4>Sector (${coords.x}, ${coords.y})</h4>
          <div class="sector-stats">
            <div>Status: Unexplored</div>
          </div>
        </div>
      `;
    }
    
    // Update warp planning if sector is warpable
    if (isWarpable) {
      this.selectedWarpTarget = coords;
      this.updateWarpPlanningInfo();
    } else {
      this.selectedWarpTarget = null;
      this.clearWarpPlanningInfo();
    }
    
    // Re-render map to show selection
    this.renderGalaxyMap();
  }

  /**
   * Update warp planning information
   */
  updateWarpPlanningInfo() {
    if (!this.selectedWarpTarget) return;
    
    const destination = this.warpDestinations.find(dest => 
      dest.coordinates.x === this.selectedWarpTarget.x && 
      dest.coordinates.y === this.selectedWarpTarget.y
    );
    
    if (destination) {
      document.getElementById('warpDistance').textContent = `${destination.distance.toFixed(1)} sectors`;
      document.getElementById('warpFuelCost').textContent = `${destination.fuelCost} units`;
      document.getElementById('warpTravelTime').textContent = `${(destination.travelTime / 1000).toFixed(1)}s`;
      
      // Enable warp buttons
      const initiateBtn = document.getElementById('initiateWarp');
      const emergencyBtn = document.getElementById('emergencyWarp');
      
      initiateBtn.disabled = !destination.canAfford;
      emergencyBtn.disabled = !destination.canAfford; // Will check emergency cost separately
      
      if (!destination.canAfford) {
        initiateBtn.title = `Need ${destination.fuelCost} fuel, have ${this.gameClient.myResources}`;
      } else {
        initiateBtn.title = 'Initiate standard warp';
        emergencyBtn.title = 'Instant warp (3x fuel cost)';
      }
    }
  }

  /**
   * Clear warp planning information
   */
  clearWarpPlanningInfo() {
    document.getElementById('warpDistance').textContent = '-';
    document.getElementById('warpFuelCost').textContent = '-';
    document.getElementById('warpTravelTime').textContent = '-';
    
    document.getElementById('initiateWarp').disabled = true;
    document.getElementById('emergencyWarp').disabled = true;
  }

  /**
   * Initiate warp to selected target
   */
  initiateWarp(isEmergency = false) {
    if (!this.selectedWarpTarget) return;
    
    if (this.gameClient.ws.readyState === WebSocket.OPEN) {
      this.gameClient.ws.send(JSON.stringify({
        type: 'initiate_warp',
        targetCoords: this.selectedWarpTarget,
        isEmergencyWarp: isEmergency
      }));
      
      // Show warp initiation feedback
      this.gameClient.showNotification(
        isEmergency ? 'Emergency warp initiated!' : 'Warp drive engaged!', 
        'info'
      );
      
      // Play warp charge sound
      if (window.playSound) {
        window.playSound('warpCharge');
      }
      
      // Close galaxy map
      this.closeGalaxyMap();
    }
  }

  /**
   * Show quick warp options
   */
  showQuickWarpOptions() {
    // Create quick warp modal with nearby interesting sectors
    const quickWarpModal = document.createElement('div');
    quickWarpModal.id = 'quickWarpModal';
    quickWarpModal.className = 'quick-warp-modal';
    
    const recommendations = this.getWarpRecommendations();
    
    quickWarpModal.innerHTML = `
      <div class="quick-warp-content">
        <div class="quick-warp-header">
          <h3>Quick Warp Destinations</h3>
          <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="quick-warp-options">
          ${recommendations.map(dest => `
            <div class="quick-warp-option" data-coords="${dest.coordinates.x},${dest.coordinates.y}">
              <div class="warp-option-info">
                <div class="warp-option-title">${dest.biome.name}</div>
                <div class="warp-option-coords">(${dest.coordinates.x}, ${dest.coordinates.y})</div>
                <div class="warp-option-distance">${dest.distance.toFixed(1)} sectors</div>
              </div>
              <div class="warp-option-cost">
                <div>${dest.fuelCost} fuel</div>
                <div>${(dest.travelTime / 1000).toFixed(1)}s</div>
              </div>
              <button class="quick-warp-btn" ${!dest.canAfford ? 'disabled' : ''}>
                Warp
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(quickWarpModal);
    
    // Add event listeners for quick warp options
    quickWarpModal.querySelectorAll('.quick-warp-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const coords = recommendations[index].coordinates;
        this.selectedWarpTarget = coords;
        this.initiateWarp(false);
        quickWarpModal.remove();
      });
    });
  }

  /**
   * Get warp recommendations based on different criteria
   */
  getWarpRecommendations() {
    const recommendations = [];
    
    // Add resource-rich sectors
    const resourceTargets = this.warpDestinations.filter(dest => 
      dest.biome.name.includes('Asteroid') || dest.biome.name.includes('Nursery')
    ).slice(0, 2);
    
    // Add exploration targets (undiscovered)
    const explorationTargets = this.warpDestinations.filter(dest => 
      !dest.isDiscovered
    ).slice(0, 2);
    
    // Add closest targets
    const nearbyTargets = this.warpDestinations.slice(0, 2);
    
    recommendations.push(...resourceTargets, ...explorationTargets, ...nearbyTargets);
    
    // Remove duplicates and limit to 5
    const unique = recommendations.filter((dest, index, self) => 
      index === self.findIndex(d => d.coordinates.x === dest.coordinates.x && d.coordinates.y === dest.coordinates.y)
    );
    
    return unique.slice(0, 5);
  }

  /**
   * Update current sector information
   */
  updateCurrentSector(coords, sectorData = null) {
    this.currentSector = coords;
    
    // Update sector HUD
    document.getElementById('currentSectorCoords').textContent = `${coords.x}, ${coords.y}`;
    
    if (sectorData) {
      document.getElementById('currentBiome').textContent = sectorData.biome?.name || 'Unknown';
      document.getElementById('sectorResources').textContent = sectorData.ores?.length || 0;
      
      // Update biome-specific background effects
      this.updateSectorBackground(sectorData.biome);
    }
    
    // Update navigation compass
    this.updateNavigationCompass();
  }

  /**
   * Update sector background effects based on biome
   */
  updateSectorBackground(biome) {
    if (!biome) return;
    
    const gameCanvas = document.getElementById('game');
    const biomeName = biome.name.toLowerCase().replace(/ /g, '-');
    
    // Remove existing biome classes
    gameCanvas.className = gameCanvas.className.replace(/biome-\S+/g, '');
    
    // Add new biome class
    gameCanvas.classList.add(`biome-${biomeName}`);
  }

  /**
   * Update navigation compass
   */
  updateNavigationCompass() {
    const pointer = document.getElementById('compassPointer');
    const directionText = document.getElementById('compassDirection');
    
    if (!this.selectedWarpTarget) {
      pointer.style.transform = 'rotate(0deg)';
      directionText.textContent = 'N';
      return;
    }
    
    // Calculate direction to warp target
    const dx = this.selectedWarpTarget.x - this.currentSector.x;
    const dy = this.selectedWarpTarget.y - this.currentSector.y;
    const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
    
    pointer.style.transform = `rotate(${angle}deg)`;
    
    // Update direction text
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const directionIndex = Math.round(angle / 45) % 8;
    directionText.textContent = directions[directionIndex] || 'N';
  }

  /**
   * Update warp drive status
   */
  updateWarpDriveStatus() {
    const statusEl = document.getElementById('warpStatus');
    const fuelEl = document.getElementById('warpFuel');
    
    if (this.currentWarpStatus && this.currentWarpStatus.isWarping) {
      statusEl.textContent = 'Warping';
      statusEl.style.color = '#ffff00';
      
      // Show warp progress
      const progress = Math.round(this.currentWarpStatus.progress * 100);
      statusEl.textContent = `Warping ${progress}%`;
    } else {
      statusEl.textContent = 'Ready';
      statusEl.style.color = '#00ff00';
    }
    
    // Update fuel display (using resources as fuel)
    fuelEl.textContent = this.gameClient.myResources?.toLocaleString() || '0';
  }

  /**
   * Handle warp status updates from server
   */
  handleWarpStatus(status) {
    this.currentWarpStatus = status;
    this.updateWarpDriveStatus();
    
    if (status.isWarping) {
      // Show warp progress notification
      this.showWarpProgress(status);
    }
  }

  /**
   * Show warp progress with visual effects
   */
  showWarpProgress(status) {
    // Create or update warp progress indicator
    let progressEl = document.getElementById('warpProgressBar');
    
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.id = 'warpProgressBar';
      progressEl.className = 'warp-progress-container';
      progressEl.innerHTML = `
        <div class="warp-progress-label">Warping to Sector (${status.toCoords.x}, ${status.toCoords.y})</div>
        <div class="warp-progress-bar">
          <div class="warp-progress-fill"></div>
        </div>
        <div class="warp-progress-time">${(status.remainingTime / 1000).toFixed(1)}s remaining</div>
        <button class="warp-cancel-btn" onclick="galaxyUI.cancelWarp()">Cancel Warp</button>
      `;
      document.body.appendChild(progressEl);
    }
    
    // Update progress
    const fillEl = progressEl.querySelector('.warp-progress-fill');
    const timeEl = progressEl.querySelector('.warp-progress-time');
    
    fillEl.style.width = `${status.progress * 100}%`;
    timeEl.textContent = `${(status.remainingTime / 1000).toFixed(1)}s remaining`;
    
    // Remove progress bar when warp completes
    if (status.progress >= 1) {
      setTimeout(() => {
        if (progressEl) progressEl.remove();
      }, 1000);
    }
  }

  /**
   * Cancel current warp
   */
  cancelWarp() {
    if (this.gameClient.ws.readyState === WebSocket.OPEN) {
      this.gameClient.ws.send(JSON.stringify({
        type: 'cancel_warp'
      }));
    }
  }

  /**
   * Handle warp completion
   */
  handleWarpCompletion(data) {
    // Update current sector
    this.updateCurrentSector(
      { x: data.newSector.coordinates.x, y: data.newSector.coordinates.y },
      data.newSector
    );
    
    // Show completion notification
    this.gameClient.showNotification(
      `Arrived in sector (${data.newSector.coordinates.x}, ${data.newSector.coordinates.y})`,
      'success'
    );
    
    // Add warp visual effect
    this.createWarpArrivalEffect();
    
    // Remove progress bar
    const progressEl = document.getElementById('warpProgressBar');
    if (progressEl) progressEl.remove();
    
    // Update galaxy map data
    this.requestGalaxyMapData();
  }

  /**
   * Create warp arrival visual effect
   */
  createWarpArrivalEffect() {
    // Create screen flash effect
    const flashOverlay = document.createElement('div');
    flashOverlay.className = 'warp-flash-overlay';
    document.body.appendChild(flashOverlay);
    
    setTimeout(() => {
      flashOverlay.remove();
    }, 500);
    
    // Trigger screen shake
    this.gameClient.triggerShake(15, 400);
    
    // Play warp jump sound
    if (window.playSound) {
      window.playSound('warpJump');
    }
    
    // Create particle burst effect
    this.createWarpParticles();
  }

  /**
   * Create warp particle effects
   */
  createWarpParticles() {
    const player = this.gameClient.players[this.gameClient.myId];
    if (!player) return;
    
    // Create warp-in particles
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 / 30) * i;
      const distance = 50 + Math.random() * 100;
      const speed = 2 + Math.random() * 3;
      
      this.gameClient.particleEffects.push({
        x: player.x + Math.cos(angle) * distance,
        y: player.y + Math.sin(angle) * distance,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        life: 1,
        color: '#00ffff',
        type: 'warp_arrival'
      });
    }
  }

  /**
   * Start periodic warp status updates
   */
  startWarpStatusUpdates() {
    setInterval(() => {
      if (this.gameClient.ws.readyState === WebSocket.OPEN) {
        this.gameClient.ws.send(JSON.stringify({
          type: 'request_warp_status'
        }));
      }
    }, 1000); // Check every second
  }

  /**
   * Calculate resource rating for a sector
   */
  calculateResourceRating(sector) {
    if (!sector.ores) return 0;
    
    const totalValue = sector.ores.reduce((sum, ore) => sum + (ore.value || 0), 0);
    const oreCount = sector.ores.length;
    
    // Normalize rating between 0 and 1
    return Math.min(1, (totalValue / 1000) * (oreCount / 20));
  }

  /**
   * Adjust color alpha for dimming undiscovered sectors
   */
  adjustColorAlpha(color, alpha) {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  /**
   * Update galaxy UI based on player movement
   */
  updateForPlayerPosition(x, y) {
    // Calculate current sector coordinates
    const sectorX = Math.floor((x + 1000) / 2000);
    const sectorY = Math.floor((y + 1000) / 2000);
    
    // Check if player changed sectors
    if (sectorX !== this.currentSector.x || sectorY !== this.currentSector.y) {
      this.updateCurrentSector({ x: sectorX, y: sectorY });
      
      // Request new sector info
      if (this.gameClient.ws.readyState === WebSocket.OPEN) {
        this.gameClient.ws.send(JSON.stringify({
          type: 'request_sector_info'
        }));
      }
      
      // Update galaxy map data around new position
      this.requestGalaxyMapData();
      this.requestWarpTargets();
    }
  }

  /**
   * Handle sector information update
   */
  handleSectorInfo(sectorData) {
    // Update current sector display
    document.getElementById('currentBiome').textContent = sectorData.biome?.name || 'Unknown';
    document.getElementById('sectorResources').textContent = sectorData.ores?.length || 0;
    
    // Update sector background
    this.updateSectorBackground(sectorData.biome);
    
    // Add sector to discovered sectors
    const sectorKey = `${sectorData.coordinates.x}_${sectorData.coordinates.y}`;
    this.discoveredSectors.add(sectorKey);
    this.galaxyMapData.set(sectorKey, sectorData);
  }

  /**
   * Create warp travel animation effect
   */
  createWarpTravelEffect(fromCoords, toCoords) {
    // Create warp tunnel effect overlay
    const warpTunnel = document.createElement('div');
    warpTunnel.className = 'warp-tunnel-overlay';
    warpTunnel.innerHTML = `
      <div class="warp-tunnel-effect">
        <div class="warp-rings"></div>
        <div class="warp-text">Warping to Sector (${toCoords.x}, ${toCoords.y})</div>
      </div>
    `;
    
    document.body.appendChild(warpTunnel);
    
    // Remove after animation
    setTimeout(() => {
      warpTunnel.remove();
    }, 3000);
  }

  /**
   * Get warp fuel efficiency display
   */
  getWarpEfficiencyInfo() {
    if (!this.warpDriveRating) return 'No warp drive data';
    
    return `
      Drive Rating: ${this.warpDriveRating.rating}<br>
      Fuel Efficiency: +${this.warpDriveRating.fuelEfficiency}%<br>
      Speed Bonus: +${this.warpDriveRating.timeEfficiency}%<br>
      Max Range: ${this.warpDriveRating.maxRange} sectors
    `;
  }

  /**
   * Show sector discovery animation
   */
  showSectorDiscovery(coords) {
    this.gameClient.showNotification(
      `New sector discovered: (${coords.x}, ${coords.y})!`,
      'success',
      4000
    );
    
    // Add to discovered sectors
    const sectorKey = `${coords.x}_${coords.y}`;
    this.discoveredSectors.add(sectorKey);
    
    // Update galaxy map if open
    if (this.isGalaxyMapOpen) {
      this.renderGalaxyMap();
    }
  }

  /**
   * Handle warp drive upgrade notifications
   */
  handleWarpDriveUpgrade(newRating) {
    this.warpDriveRating = newRating;
    this.gameClient.showNotification(
      `Warp drive upgraded to ${newRating.rating}!`,
      'success'
    );
    this.updateWarpDriveStatus();
  }

  /**
   * Get sector at coordinates
   */
  getSectorAtCoords(coords) {
    const sectorKey = `${coords.x}_${coords.y}`;
    return this.galaxyMapData.get(sectorKey);
  }

  /**
   * Check if sector is within warp range
   */
  isInWarpRange(coords) {
    if (!this.warpDriveRating) return false;
    
    const distance = Math.sqrt(
      (coords.x - this.currentSector.x) ** 2 + 
      (coords.y - this.currentSector.y) ** 2
    );
    
    return distance <= this.warpDriveRating.maxRange;
  }

  /**
   * Export for debugging
   */
  getDebugInfo() {
    return {
      currentSector: this.currentSector,
      discoveredSectors: Array.from(this.discoveredSectors),
      warpDestinations: this.warpDestinations,
      selectedWarpTarget: this.selectedWarpTarget,
      galaxyMapData: Object.fromEntries(this.galaxyMapData),
      warpStatus: this.currentWarpStatus
    };
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GalaxyUI;
}