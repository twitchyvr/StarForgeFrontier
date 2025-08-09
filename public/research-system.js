/**
 * Research System UI
 * Frontend interface for the Research & Technology System
 */

class ResearchUI {
  constructor(gameInstance) {
    this.game = gameInstance;
    this.isVisible = false;
    this.currentTab = 'research-tree';
    this.selectedTree = 'MILITARY';
    this.researchData = null;
    this.activeProjects = [];
    
    this.setupEventListeners();
    this.createResearchInterface();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for research-related key presses
    document.addEventListener('keydown', (e) => {
      if (e.key === 'R' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for research updates from server
    if (this.game.socket) {
      this.game.socket.on('researchUpdate', (data) => {
        this.handleResearchUpdate(data);
      });

      this.game.socket.on('researchCompleted', (data) => {
        this.handleResearchCompleted(data);
      });

      this.game.socket.on('researchPointsAwarded', (data) => {
        this.handleResearchPointsAwarded(data);
      });
    }
  }

  /**
   * Create the research interface
   */
  createResearchInterface() {
    const researchContainer = document.createElement('div');
    researchContainer.id = 'research-interface';
    researchContainer.className = 'game-interface research-interface hidden';
    
    researchContainer.innerHTML = `
      <div class="research-header">
        <h2>🔬 Research & Technology</h2>
        <div class="research-points-display">
          <div class="research-point-group">
            <span class="point-icon military">⚔️</span>
            <span id="military-points">0</span>
          </div>
          <div class="research-point-group">
            <span class="point-icon engineering">⚙️</span>
            <span id="engineering-points">0</span>
          </div>
          <div class="research-point-group">
            <span class="point-icon science">🔬</span>
            <span id="science-points">0</span>
          </div>
          <div class="research-point-group">
            <span class="point-icon commerce">💰</span>
            <span id="commerce-points">0</span>
          </div>
        </div>
        <button class="close-btn" onclick="researchUI.hide()">×</button>
      </div>
      
      <div class="research-tabs">
        <button class="tab-btn active" data-tab="research-tree">Tech Trees</button>
        <button class="tab-btn" data-tab="active-projects">Active Projects</button>
        <button class="tab-btn" data-tab="laboratories">Laboratories</button>
        <button class="tab-btn" data-tab="discoveries">Discoveries</button>
      </div>
      
      <div class="research-content">
        <!-- Tech Trees Tab -->
        <div id="research-tree" class="tab-content active">
          <div class="tree-selector">
            <button class="tree-btn active" data-tree="MILITARY">🗡️ Military</button>
            <button class="tree-btn" data-tree="ENGINEERING">⚙️ Engineering</button>
            <button class="tree-btn" data-tree="SCIENCE">🔬 Science</button>
            <button class="tree-btn" data-tree="COMMERCE">💰 Commerce</button>
          </div>
          <div class="tech-tree-container">
            <div id="tech-tree-display" class="tech-tree-display">
              <!-- Tech tree will be rendered here -->
            </div>
          </div>
        </div>
        
        <!-- Active Projects Tab -->
        <div id="active-projects" class="tab-content">
          <div class="projects-list">
            <h3>Current Research Projects</h3>
            <div id="projects-container">
              <!-- Projects will be listed here -->
            </div>
            <div class="project-actions">
              <button class="research-btn" onclick="researchUI.showStartProjectDialog()">Start New Project</button>
              <button class="research-btn secondary" onclick="researchUI.showCollaborationDialog()">Join Collaboration</button>
            </div>
          </div>
        </div>
        
        <!-- Laboratories Tab -->
        <div id="laboratories" class="tab-content">
          <div class="laboratory-section">
            <h3>Research Laboratories</h3>
            <div id="laboratories-container">
              <!-- Laboratories will be listed here -->
            </div>
            <div class="laboratory-actions">
              <button class="research-btn" onclick="researchUI.showBuildLaboratoryDialog()">Build Laboratory</button>
              <button class="research-btn secondary" onclick="researchUI.showUpgradeLaboratoryDialog()">Upgrade Laboratory</button>
            </div>
          </div>
        </div>
        
        <!-- Discoveries Tab -->
        <div id="discoveries" class="tab-content">
          <div class="discoveries-section">
            <h3>Research Discoveries</h3>
            <div id="discoveries-container">
              <!-- Discoveries will be listed here -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(researchContainer);
    
    // Setup tab switching
    this.setupTabSwitching();
    this.setupTreeSwitching();
  }

  /**
   * Setup tab switching functionality
   */
  setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.research-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        
        // Remove active class from all tabs and content
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        this.currentTab = tabId;
        this.refreshTabContent();
      });
    });
  }

  /**
   * Setup tree switching functionality
   */
  setupTreeSwitching() {
    const treeBtns = document.querySelectorAll('.tree-selector .tree-btn');
    
    treeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const treeId = btn.getAttribute('data-tree');
        
        // Remove active class from all tree buttons
        treeBtns.forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked tree button
        btn.classList.add('active');
        
        this.selectedTree = treeId;
        this.renderTechTree();
      });
    });
  }

  /**
   * Show the research interface
   */
  show() {
    const interface = document.getElementById('research-interface');
    if (interface) {
      interface.classList.remove('hidden');
      this.isVisible = true;
      this.refreshResearchData();
    }
  }

  /**
   * Hide the research interface
   */
  hide() {
    const interface = document.getElementById('research-interface');
    if (interface) {
      interface.classList.add('hidden');
      this.isVisible = false;
    }
  }

  /**
   * Toggle the research interface
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Refresh research data from server
   */
  async refreshResearchData() {
    if (!this.game.socket) return;
    
    this.game.socket.emit('getResearchData', {}, (response) => {
      if (response.success) {
        this.researchData = response.data;
        this.updateResearchPointsDisplay();
        this.refreshTabContent();
      }
    });
  }

  /**
   * Update research points display
   */
  updateResearchPointsDisplay() {
    if (!this.researchData || !this.researchData.researchPoints) return;
    
    const points = this.researchData.researchPoints;
    document.getElementById('military-points').textContent = points.military_points || 0;
    document.getElementById('engineering-points').textContent = points.engineering_points || 0;
    document.getElementById('science-points').textContent = points.science_points || 0;
    document.getElementById('commerce-points').textContent = points.commerce_points || 0;
  }

  /**
   * Refresh content for the current tab
   */
  refreshTabContent() {
    switch (this.currentTab) {
      case 'research-tree':
        this.renderTechTree();
        break;
      case 'active-projects':
        this.renderActiveProjects();
        break;
      case 'laboratories':
        this.renderLaboratories();
        break;
      case 'discoveries':
        this.renderDiscoveries();
        break;
    }
  }

  /**
   * Render the technology tree
   */
  renderTechTree() {
    const container = document.getElementById('tech-tree-display');
    if (!container) return;
    
    // Mock tech tree data (in real implementation, this would come from server)
    const techTrees = {
      MILITARY: [
        { id: 'BASIC_WEAPONS', name: 'Basic Weaponry', tier: 1, unlocked: true, researching: false },
        { id: 'ARMOR_TECH', name: 'Armor Technology', tier: 1, unlocked: true, researching: false },
        { id: 'ADVANCED_WEAPONS', name: 'Advanced Weaponry', tier: 2, unlocked: false, researching: true },
        { id: 'SHIELD_SYSTEMS', name: 'Shield Systems', tier: 2, unlocked: false, researching: false },
        { id: 'PARTICLE_WEAPONS', name: 'Particle Weapons', tier: 3, unlocked: false, researching: false }
      ],
      ENGINEERING: [
        { id: 'PROPULSION_SYSTEMS', name: 'Advanced Propulsion', tier: 1, unlocked: true, researching: false },
        { id: 'POWER_SYSTEMS', name: 'Power Generation', tier: 1, unlocked: true, researching: false },
        { id: 'WARP_TECHNOLOGY', name: 'Warp Drive Technology', tier: 2, unlocked: false, researching: false },
        { id: 'MINING_TECHNOLOGY', name: 'Advanced Mining', tier: 2, unlocked: false, researching: false },
        { id: 'QUANTUM_SYSTEMS', name: 'Quantum Engineering', tier: 3, unlocked: false, researching: false }
      ],
      SCIENCE: [
        { id: 'SENSOR_TECHNOLOGY', name: 'Advanced Sensors', tier: 1, unlocked: true, researching: false },
        { id: 'RESEARCH_METHODS', name: 'Research Methodology', tier: 1, unlocked: true, researching: false },
        { id: 'XENOBIOLOGY', name: 'Xenobiology Research', tier: 2, unlocked: false, researching: false },
        { id: 'ASTROPHYSICS', name: 'Advanced Astrophysics', tier: 2, unlocked: false, researching: false },
        { id: 'DIMENSIONAL_PHYSICS', name: 'Dimensional Physics', tier: 3, unlocked: false, researching: false }
      ],
      COMMERCE: [
        { id: 'LOGISTICS_SYSTEMS', name: 'Logistics Networks', tier: 1, unlocked: true, researching: false },
        { id: 'MARKET_ANALYSIS', name: 'Market Analysis', tier: 1, unlocked: true, researching: false },
        { id: 'BANKING_SYSTEMS', name: 'Galactic Banking', tier: 2, unlocked: false, researching: false },
        { id: 'MANUFACTURING', name: 'Automated Manufacturing', tier: 2, unlocked: false, researching: false },
        { id: 'CORPORATE_NETWORKS', name: 'Corporate Networks', tier: 3, unlocked: false, researching: false }
      ]
    };
    
    const technologies = techTrees[this.selectedTree] || [];
    const treeHtml = this.generateTechTreeHTML(technologies);
    container.innerHTML = treeHtml;
  }

  /**
   * Generate HTML for technology tree
   */
  generateTechTreeHTML(technologies) {
    const tiers = {};
    technologies.forEach(tech => {
      if (!tiers[tech.tier]) tiers[tech.tier] = [];
      tiers[tech.tier].push(tech);
    });
    
    let html = '<div class="tech-tree-grid">';
    
    Object.keys(tiers).sort().forEach(tier => {
      html += `<div class="tech-tier" data-tier="${tier}">`;
      html += `<div class="tier-label">Tier ${tier}</div>`;
      html += '<div class="tech-row">';
      
      tiers[tier].forEach(tech => {
        const statusClass = tech.unlocked ? 'unlocked' : (tech.researching ? 'researching' : 'locked');
        const statusIcon = tech.unlocked ? '✅' : (tech.researching ? '🔄' : '🔒');
        
        html += `
          <div class="tech-node ${statusClass}" data-tech-id="${tech.id}">
            <div class="tech-icon">${statusIcon}</div>
            <div class="tech-name">${tech.name}</div>
            <div class="tech-actions">
              ${!tech.unlocked && !tech.researching ? `<button class="research-btn small" onclick="researchUI.startResearch('${tech.id}')">Research</button>` : ''}
              ${tech.unlocked ? '<button class="info-btn small" onclick="researchUI.showTechInfo(\'${tech.id}\')">Info</button>' : ''}
            </div>
          </div>
        `;
      });
      
      html += '</div></div>';
    });
    
    html += '</div>';
    return html;
  }

  /**
   * Render active research projects
   */
  renderActiveProjects() {
    const container = document.getElementById('projects-container');
    if (!container) return;
    
    // Mock active projects data
    const mockProjects = [
      {
        id: 'proj1',
        technologyId: 'ADVANCED_WEAPONS',
        name: 'Advanced Weaponry',
        progress: 0.65,
        startTime: Date.now() - 3600000,
        estimatedCompletion: Date.now() + 1800000,
        type: 'INDIVIDUAL'
      }
    ];
    
    if (mockProjects.length === 0) {
      container.innerHTML = '<div class="no-projects">No active research projects</div>';
      return;
    }
    
    let html = '';
    mockProjects.forEach(project => {
      const progressPercent = Math.round(project.progress * 100);
      const timeRemaining = this.formatTimeRemaining(project.estimatedCompletion - Date.now());
      
      html += `
        <div class="project-card">
          <div class="project-header">
            <h4>${project.name}</h4>
            <span class="project-type ${project.type.toLowerCase()}">${project.type}</span>
          </div>
          <div class="project-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            <span class="progress-text">${progressPercent}% Complete</span>
          </div>
          <div class="project-info">
            <span class="time-remaining">⏱️ ${timeRemaining} remaining</span>
          </div>
          <div class="project-actions">
            <button class="research-btn small secondary" onclick="researchUI.pauseProject('${project.id}')">Pause</button>
            <button class="research-btn small danger" onclick="researchUI.cancelProject('${project.id}')">Cancel</button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }

  /**
   * Render research laboratories
   */
  renderLaboratories() {
    const container = document.getElementById('laboratories-container');
    if (!container) return;
    
    // Mock laboratory data
    const mockLabs = [
      {
        id: 'lab1',
        name: 'Primary Research Lab',
        type: 'BASIC',
        level: 3,
        researchBonus: 0.35,
        capacity: 2,
        isActive: true,
        sector: { x: 0, y: 0 }
      }
    ];
    
    if (mockLabs.length === 0) {
      container.innerHTML = '<div class="no-laboratories">No research laboratories built</div>';
      return;
    }
    
    let html = '';
    mockLabs.forEach(lab => {
      html += `
        <div class="laboratory-card">
          <div class="lab-header">
            <h4>${lab.name}</h4>
            <span class="lab-type ${lab.type.toLowerCase()}">${lab.type}</span>
          </div>
          <div class="lab-stats">
            <div class="stat-row">
              <span class="stat-label">Level:</span>
              <span class="stat-value">${lab.level}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Research Bonus:</span>
              <span class="stat-value">+${Math.round(lab.researchBonus * 100)}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Capacity:</span>
              <span class="stat-value">${lab.capacity} projects</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Location:</span>
              <span class="stat-value">Sector (${lab.sector.x}, ${lab.sector.y})</span>
            </div>
          </div>
          <div class="lab-actions">
            <button class="research-btn small" onclick="researchUI.upgradeLaboratory('${lab.id}')">Upgrade</button>
            <button class="research-btn small secondary" onclick="researchUI.performMaintenance('${lab.id}')">Maintain</button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }

  /**
   * Render research discoveries
   */
  renderDiscoveries() {
    const container = document.getElementById('discoveries-container');
    if (!container) return;
    
    // Mock discoveries data
    const mockDiscoveries = [
      {
        id: 'disc1',
        type: 'ALIEN_TECH',
        name: 'Ancient Energy Core',
        sector: { x: 5, y: -2 },
        researchValue: 150,
        analyzed: true,
        discoveryTime: Date.now() - 7200000
      }
    ];
    
    if (mockDiscoveries.length === 0) {
      container.innerHTML = '<div class="no-discoveries">No research discoveries made</div>';
      return;
    }
    
    let html = '';
    mockDiscoveries.forEach(discovery => {
      const timeAgo = this.formatTimeAgo(Date.now() - discovery.discoveryTime);
      const typeIcon = this.getDiscoveryIcon(discovery.type);
      
      html += `
        <div class="discovery-card">
          <div class="discovery-header">
            <div class="discovery-icon">${typeIcon}</div>
            <div class="discovery-info">
              <h4>${discovery.name}</h4>
              <span class="discovery-type">${discovery.type.replace('_', ' ')}</span>
            </div>
          </div>
          <div class="discovery-details">
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">Sector (${discovery.sector.x}, ${discovery.sector.y})</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Research Value:</span>
              <span class="detail-value">${discovery.researchValue} points</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Discovered:</span>
              <span class="detail-value">${timeAgo}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value ${discovery.analyzed ? 'analyzed' : 'unanalyzed'}">
                ${discovery.analyzed ? 'Analyzed' : 'Needs Analysis'}
              </span>
            </div>
          </div>
          <div class="discovery-actions">
            ${!discovery.analyzed ? `<button class="research-btn small" onclick="researchUI.analyzeDiscovery('${discovery.id}')">Analyze</button>` : ''}
            <button class="research-btn small secondary" onclick="researchUI.shareDiscovery('${discovery.id}')">Share</button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }

  /**
   * Get icon for discovery type
   */
  getDiscoveryIcon(type) {
    const icons = {
      'ALIEN_TECH': '👽',
      'ANCIENT_RUIN': '🏛️',
      'PROTOTYPE': '🔧',
      'BREAKTHROUGH': '💡'
    };
    return icons[type] || '🔬';
  }

  /**
   * Start research for a technology
   */
  startResearch(technologyId) {
    if (!this.game.socket) return;
    
    this.game.socket.emit('startResearch', { technologyId }, (response) => {
      if (response.success) {
        this.showNotification('Research project started!', 'success');
        this.refreshResearchData();
      } else {
        this.showNotification(response.message || 'Failed to start research', 'error');
      }
    });
  }

  /**
   * Show start project dialog
   */
  showStartProjectDialog() {
    // Implementation for project selection dialog
    this.showNotification('Start Project dialog would open here', 'info');
  }

  /**
   * Show collaboration dialog
   */
  showCollaborationDialog() {
    // Implementation for guild collaboration dialog
    this.showNotification('Guild Collaboration dialog would open here', 'info');
  }

  /**
   * Show build laboratory dialog
   */
  showBuildLaboratoryDialog() {
    // Implementation for laboratory construction dialog
    this.showNotification('Build Laboratory dialog would open here', 'info');
  }

  /**
   * Format time remaining
   */
  formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Format time ago
   */
  formatTimeAgo(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  }

  /**
   * Handle research update from server
   */
  handleResearchUpdate(data) {
    if (this.isVisible) {
      this.refreshResearchData();
    }
  }

  /**
   * Handle research completion
   */
  handleResearchCompleted(data) {
    this.showNotification(`Research completed: ${data.technologyName}!`, 'success');
    if (this.isVisible) {
      this.refreshResearchData();
    }
  }

  /**
   * Handle research points awarded
   */
  handleResearchPointsAwarded(data) {
    const pointTypes = Object.keys(data.points);
    const totalPoints = Object.values(data.points).reduce((sum, val) => sum + val, 0);
    this.showNotification(`+${totalPoints} research points awarded from ${data.source}`, 'info');
    
    if (this.isVisible) {
      this.updateResearchPointsDisplay();
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Create a simple notification (in real implementation, use a proper notification system)
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 15px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      transition: opacity 0.3s;
    `;
    
    // Set background color based on type
    const colors = {
      success: '#2ed573',
      error: '#ff3742',
      warning: '#ffa502',
      info: '#3742fa'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize research UI when game starts
let researchUI;
document.addEventListener('DOMContentLoaded', () => {
  // Wait for game instance to be available
  const initResearchUI = () => {
    if (window.game) {
      researchUI = new ResearchUI(window.game);
      console.log('Research UI initialized');
    } else {
      setTimeout(initResearchUI, 100);
    }
  };
  initResearchUI();
});