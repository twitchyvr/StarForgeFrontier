/**
 * faction-ui.js - Faction system user interface for StarForgeFrontier
 * Handles faction reputation display, NPC fleet visualization, and faction interactions
 */

class FactionUI {
  constructor() {
    this.factions = new Map();
    this.playerReputations = new Map();
    this.nearbyFleets = [];
    this.isVisible = false;
    this.selectedFaction = null;
    
    this.setupEventListeners();
    this.createFactionPanel();
  }

  /**
   * Set up keyboard shortcuts and event listeners
   */
  setupEventListeners() {
    // 'F' key to toggle faction panel
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.toggleFactionPanel();
      }
    });

    // Update faction data every 10 seconds
    setInterval(() => {
      if (this.isVisible) {
        this.updateFactionData();
      }
    }, 10000);
  }

  /**
   * Create the faction panel UI
   */
  createFactionPanel() {
    const panel = document.createElement('div');
    panel.id = 'factionPanel';
    panel.className = 'faction-panel hidden';
    panel.innerHTML = `
      <div class="faction-header">
        <h2>Faction Relations</h2>
        <button id="closeFactionPanel" class="close-btn">×</button>
      </div>
      <div class="faction-content">
        <div class="faction-tabs">
          <button class="tab-btn active" data-tab="reputation">Reputation</button>
          <button class="tab-btn" data-tab="fleets">NPC Fleets</button>
          <button class="tab-btn" data-tab="territory">Territory</button>
        </div>
        <div class="faction-tab-content">
          <div id="reputationTab" class="tab-panel active">
            <div id="factionReputationList" class="faction-list">
              <div class="loading">Loading faction data...</div>
            </div>
          </div>
          <div id="fleetsTab" class="tab-panel">
            <div id="nearbyFleetsList" class="fleet-list">
              <div class="loading">Loading fleet data...</div>
            </div>
          </div>
          <div id="territoryTab" class="tab-panel">
            <div id="territoryMap" class="territory-display">
              <div class="loading">Loading territory data...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Set up panel event listeners
    document.getElementById('closeFactionPanel').onclick = () => {
      this.hideFactionPanel();
    };

    // Tab switching
    const tabBtns = panel.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        this.switchTab(btn.dataset.tab);
      };
    });
  }

  /**
   * Toggle faction panel visibility
   */
  toggleFactionPanel() {
    if (this.isVisible) {
      this.hideFactionPanel();
    } else {
      this.showFactionPanel();
    }
  }

  /**
   * Show faction panel and load data
   */
  showFactionPanel() {
    const panel = document.getElementById('factionPanel');
    panel.classList.remove('hidden');
    this.isVisible = true;

    // Load initial data
    this.updateFactionData();
  }

  /**
   * Hide faction panel
   */
  hideFactionPanel() {
    const panel = document.getElementById('factionPanel');
    panel.classList.add('hidden');
    this.isVisible = false;
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}Tab`);
    });

    // Load specific tab data
    switch (tabName) {
      case 'reputation':
        this.updateReputationDisplay();
        break;
      case 'fleets':
        this.updateFleetDisplay();
        break;
      case 'territory':
        this.updateTerritoryDisplay();
        break;
    }
  }

  /**
   * Update all faction data from server
   */
  async updateFactionData() {
    try {
      // Get basic faction data
      const factionsResponse = await fetch('/api/factions');
      if (factionsResponse.ok) {
        const factions = await factionsResponse.json();
        this.factions.clear();
        Object.entries(factions).forEach(([id, faction]) => {
          this.factions.set(id, faction);
        });
      }

      // Get player reputation data
      const playerId = this.getPlayerId();
      if (playerId) {
        const reputationResponse = await fetch(`/api/factions/reputation/${playerId}`);
        if (reputationResponse.ok) {
          const reputations = await reputationResponse.json();
          this.playerReputations.clear();
          Object.entries(reputations).forEach(([factionId, repData]) => {
            this.playerReputations.set(factionId, repData);
          });
        }
      }

      // Update current tab display
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        this.switchTab(activeTab.dataset.tab);
      }

    } catch (error) {
      console.error('Error updating faction data:', error);
    }
  }

  /**
   * Update reputation display
   */
  updateReputationDisplay() {
    const container = document.getElementById('factionReputationList');
    
    if (this.factions.size === 0) {
      container.innerHTML = '<div class="no-data">No faction data available</div>';
      return;
    }

    let html = '';
    for (const [factionId, faction] of this.factions.entries()) {
      const reputation = this.playerReputations.get(factionId);
      const repValue = reputation ? reputation.reputation : 0;
      const repLevel = reputation ? reputation.level : 'NEUTRAL';
      const repColor = reputation ? reputation.color : '#FFFF00';

      html += `
        <div class="faction-item" data-faction="${factionId}">
          <div class="faction-header">
            <div class="faction-info">
              <div class="faction-name" style="color: ${faction.typeConfig.primaryColor}">
                ${faction.name}
              </div>
              <div class="faction-type">${faction.type}</div>
            </div>
            <div class="reputation-info">
              <div class="reputation-value" style="color: ${repColor}">
                ${repValue > 0 ? '+' : ''}${repValue}
              </div>
              <div class="reputation-level" style="color: ${repColor}">
                ${repLevel}
              </div>
            </div>
          </div>
          <div class="faction-details">
            <div class="faction-stats">
              <span class="stat">Territory: ${faction.territoryCount}</span>
              <span class="stat">Fleets: ${faction.fleetCount}</span>
              <span class="stat">Strategy: ${faction.currentStrategy}</span>
            </div>
            <div class="reputation-bar">
              <div class="rep-bar-bg">
                <div class="rep-bar-fill" style="width: ${Math.abs(repValue)}%; background-color: ${repColor}"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Add click handlers for faction details
    container.querySelectorAll('.faction-item').forEach(item => {
      item.onclick = () => {
        this.showFactionDetails(item.dataset.faction);
      };
    });
  }

  /**
   * Update fleet display
   */
  async updateFleetDisplay() {
    const container = document.getElementById('nearbyFleetsList');
    
    try {
      // Get player's current sector
      const playerSector = this.getPlayerSector();
      if (!playerSector) {
        container.innerHTML = '<div class="no-data">Player location unknown</div>';
        return;
      }

      // Get fleets in current sector
      const response = await fetch(`/api/factions/fleets/sector/${playerSector.x}/${playerSector.y}`);
      if (!response.ok) {
        container.innerHTML = '<div class="error">Error loading fleet data</div>';
        return;
      }

      const fleets = await response.json();
      
      if (fleets.length === 0) {
        container.innerHTML = '<div class="no-data">No faction fleets in this sector</div>';
        return;
      }

      let html = '';
      fleets.forEach(fleet => {
        const faction = this.factions.get(fleet.factionId);
        const factionName = faction ? faction.name : 'Unknown Faction';
        const factionColor = faction ? faction.typeConfig.primaryColor : '#666';

        html += `
          <div class="fleet-item" data-fleet="${fleet.fleetId}">
            <div class="fleet-header">
              <div class="fleet-info">
                <div class="fleet-faction" style="color: ${factionColor}">
                  ${factionName}
                </div>
                <div class="fleet-mission">${fleet.mission} Mission</div>
              </div>
              <div class="fleet-status ${fleet.status}">
                ${fleet.status.toUpperCase()}
              </div>
            </div>
            <div class="fleet-details">
              <div class="fleet-composition">
                ${fleet.shipCount} Ships
              </div>
              <div class="fleet-position">
                Position: (${Math.round(fleet.position.x)}, ${Math.round(fleet.position.y)})
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

    } catch (error) {
      console.error('Error updating fleet display:', error);
      container.innerHTML = '<div class="error">Error loading fleet data</div>';
    }
  }

  /**
   * Update territory display
   */
  updateTerritoryDisplay() {
    const container = document.getElementById('territoryMap');
    
    let html = '<div class="territory-grid">';
    
    // Simple territory visualization - 10x10 grid
    for (let y = -5; y <= 4; y++) {
      html += '<div class="territory-row">';
      for (let x = -5; x <= 4; x++) {
        const sectorId = `${x},${y}`;
        let controllingFaction = null;
        let factionColor = '#333';
        
        // Find which faction controls this sector
        for (const [factionId, faction] of this.factions.entries()) {
          // This is a simplified check - in a real implementation,
          // we'd query the server for territory data
          if (faction.homeBase === sectorId) {
            controllingFaction = faction;
            factionColor = faction.typeConfig.primaryColor;
            break;
          }
        }
        
        html += `
          <div class="territory-cell" 
               style="background-color: ${factionColor}40; border-color: ${factionColor}"
               data-sector="${x},${y}"
               title="Sector ${x},${y}${controllingFaction ? ' - ' + controllingFaction.name : ''}">
            ${x === 0 && y === 0 ? '⭐' : ''}
          </div>
        `;
      }
      html += '</div>';
    }
    
    html += '</div>';
    
    // Add legend
    html += '<div class="territory-legend">';
    html += '<h4>Faction Territory</h4>';
    for (const [factionId, faction] of this.factions.entries()) {
      html += `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${faction.typeConfig.primaryColor}"></div>
          <span>${faction.name}</span>
        </div>
      `;
    }
    html += '</div>';
    
    container.innerHTML = html;
  }

  /**
   * Show detailed information about a specific faction
   */
  async showFactionDetails(factionId) {
    try {
      const response = await fetch(`/api/factions/${factionId}`);
      if (!response.ok) return;
      
      const faction = await response.json();
      
      // Create modal or detailed view
      console.log('Faction details:', faction);
      // TODO: Implement detailed faction view
      
    } catch (error) {
      console.error('Error loading faction details:', error);
    }
  }

  /**
   * Get current player ID
   */
  getPlayerId() {
    // This should integrate with your existing player system
    return window.currentPlayer?.id || null;
  }

  /**
   * Get player's current sector coordinates
   */
  getPlayerSector() {
    if (!window.currentPlayer) return null;
    
    const sectorX = Math.floor(window.currentPlayer.x / 2000);
    const sectorY = Math.floor(window.currentPlayer.y / 2000);
    
    return { x: sectorX, y: sectorY };
  }

  /**
   * Update faction reputation (called from main game when reputation changes)
   */
  updateReputation(factionId, newReputation, change, reason) {
    if (this.playerReputations.has(factionId)) {
      const current = this.playerReputations.get(factionId);
      current.reputation = newReputation;
      this.playerReputations.set(factionId, current);
    }

    // Show reputation change notification
    this.showReputationNotification(factionId, change, reason);

    // Update display if visible
    if (this.isVisible) {
      this.updateReputationDisplay();
    }
  }

  /**
   * Show reputation change notification
   */
  showReputationNotification(factionId, change, reason) {
    const faction = this.factions.get(factionId);
    if (!faction) return;

    const notification = document.createElement('div');
    notification.className = 'reputation-notification';
    notification.innerHTML = `
      <div class="rep-change ${change > 0 ? 'positive' : 'negative'}">
        <strong>${faction.name}</strong> reputation ${change > 0 ? '+' : ''}${change}
        <div class="rep-reason">${reason}</div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Visualize NPC fleets on the main game canvas
   */
  renderNPCFleets(ctx, camera, fleets) {
    fleets.forEach(fleet => {
      const screenX = fleet.position.x - camera.x;
      const screenY = fleet.position.y - camera.y;

      // Only render if on screen
      if (screenX > -50 && screenX < ctx.canvas.width + 50 &&
          screenY > -50 && screenY < ctx.canvas.height + 50) {
        
        const faction = this.factions.get(fleet.factionId);
        const factionColor = faction ? faction.typeConfig.primaryColor : '#FF0000';

        // Draw fleet ships
        fleet.ships.forEach((ship, index) => {
          const shipX = screenX + (index * 30) - (fleet.ships.length * 15);
          const shipY = screenY;

          // Draw ship
          ctx.fillStyle = factionColor;
          ctx.fillRect(shipX - 8, shipY - 8, 16, 16);

          // Draw faction indicator
          ctx.fillStyle = faction ? faction.typeConfig.secondaryColor : '#FFFFFF';
          ctx.fillRect(shipX - 2, shipY - 2, 4, 4);
        });

        // Draw fleet status
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(screenX - 40, screenY - 40, 80, 20);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${faction?.name || 'Unknown'} Fleet`, screenX, screenY - 25);
      }
    });
  }
}

// Initialize faction UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (!window.factionUI) {
    window.factionUI = new FactionUI();
  }
});

// Add keyboard shortcut info to controls
document.addEventListener('DOMContentLoaded', () => {
  const controlsPanel = document.getElementById('controls');
  if (controlsPanel) {
    const helpContent = controlsPanel.querySelector('.help-content');
    if (helpContent) {
      const factionControl = document.createElement('div');
      factionControl.textContent = 'F - Faction Relations';
      helpContent.appendChild(factionControl);
    }
  }
});

// Export for global access
window.FactionUI = FactionUI;