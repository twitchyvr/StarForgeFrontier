/**
 * Skill System Frontend for StarForgeFrontier
 * Handles skill tree display, upgrades, and player progression
 */

class SkillSystemUI {
  constructor(gameClient) {
    this.gameClient = gameClient;
    this.skillData = null;
    this.selectedTree = 'combat';
    this.isVisible = false;
    
    this.skillTrees = {
      combat: { name: 'Combat', icon: '⚔️', color: '#ff4757' },
      engineering: { name: 'Engineering', icon: '🔧', color: '#ffa502' },
      trading: { name: 'Trading', icon: '💰', color: '#2ed573' },
      exploration: { name: 'Exploration', icon: '🚀', color: '#5352ed' },
      leadership: { name: 'Leadership', icon: '👑', color: '#ff6b35' }
    };

    this.createSkillInterface();
    this.bindEvents();
  }

  /**
   * Create the skill interface HTML structure
   */
  createSkillInterface() {
    const skillPanel = document.createElement('div');
    skillPanel.id = 'skill-panel';
    skillPanel.className = 'skill-panel hidden';
    
    skillPanel.innerHTML = `
      <div class="skill-header">
        <h2>Character Skills</h2>
        <button class="close-btn" onclick="skillSystem.hideSkillPanel()">✕</button>
      </div>
      
      <div class="skill-content">
        <!-- Skill Tree Tabs -->
        <div class="skill-tabs">
          ${Object.entries(this.skillTrees).map(([key, tree]) => `
            <button class="skill-tab ${key === this.selectedTree ? 'active' : ''}" 
                    data-tree="${key}">
              <span class="skill-icon">${tree.icon}</span>
              <span class="skill-name">${tree.name}</span>
              <span class="skill-points-badge" id="points-${key}">0</span>
            </button>
          `).join('')}
        </div>

        <!-- Skill Tree Display -->
        <div class="skill-tree-container">
          <div class="skill-tree-header">
            <h3 id="tree-title">${this.skillTrees[this.selectedTree].name}</h3>
            <div class="available-points">
              Available Points: <span id="available-points">0</span>
            </div>
          </div>

          <div class="skill-tree" id="skill-tree">
            <!-- Skills will be dynamically generated here -->
          </div>
        </div>

        <!-- Skill Details Panel -->
        <div class="skill-details" id="skill-details">
          <h4>Select a skill to view details</h4>
          <p>Click on any skill to see its effects and upgrade options.</p>
        </div>
      </div>
    `;

    document.body.appendChild(skillPanel);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Skill tree tab switching
    document.addEventListener('click', (e) => {
      if (e.target.closest('.skill-tab')) {
        const tree = e.target.closest('.skill-tab').dataset.tree;
        this.selectSkillTree(tree);
      }
    });

    // Skill upgrade buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('upgrade-skill-btn')) {
        const tree = e.target.dataset.tree;
        const skill = e.target.dataset.skill;
        this.upgradeSkill(tree, skill);
      }
    });

    // Skill hover effects
    document.addEventListener('mouseenter', (e) => {
      if (e.target.classList.contains('skill-node')) {
        this.showSkillDetails(e.target.dataset.tree, e.target.dataset.skill);
      }
    }, true);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'K' && !e.ctrlKey && !e.altKey) {
        this.toggleSkillPanel();
      }
      if (e.key === 'Escape' && this.isVisible) {
        this.hideSkillPanel();
      }
    });
  }

  /**
   * Show the skill panel
   */
  showSkillPanel() {
    const panel = document.getElementById('skill-panel');
    panel.classList.remove('hidden');
    this.isVisible = true;
    this.refreshSkillData();
  }

  /**
   * Hide the skill panel
   */
  hideSkillPanel() {
    const panel = document.getElementById('skill-panel');
    panel.classList.add('hidden');
    this.isVisible = false;
  }

  /**
   * Toggle skill panel visibility
   */
  toggleSkillPanel() {
    if (this.isVisible) {
      this.hideSkillPanel();
    } else {
      this.showSkillPanel();
    }
  }

  /**
   * Select a skill tree tab
   */
  selectSkillTree(tree) {
    // Update selected tree
    this.selectedTree = tree;

    // Update tab active states
    document.querySelectorAll('.skill-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tree === tree);
    });

    // Update tree title and color
    const treeInfo = this.skillTrees[tree];
    document.getElementById('tree-title').textContent = treeInfo.name;
    document.getElementById('tree-title').style.color = treeInfo.color;

    // Render the selected skill tree
    this.renderSkillTree(tree);
    this.updateAvailablePoints(tree);
  }

  /**
   * Refresh skill data from server
   */
  async refreshSkillData() {
    try {
      // Request skill data from server
      this.gameClient.ws.send(JSON.stringify({
        type: 'get_player_skills',
        playerId: this.gameClient.playerId
      }));
    } catch (error) {
      console.error('Failed to refresh skill data:', error);
    }
  }

  /**
   * Handle skill data received from server
   */
  handleSkillData(data) {
    this.skillData = data;
    this.updateSkillDisplay();
  }

  /**
   * Update the skill display with current data
   */
  updateSkillDisplay() {
    if (!this.skillData) return;

    // Update skill point badges
    Object.keys(this.skillTrees).forEach(tree => {
      const points = this.skillData.skillPoints[tree] || 0;
      const badge = document.getElementById(`points-${tree}`);
      if (badge) {
        badge.textContent = points;
        badge.classList.toggle('has-points', points > 0);
      }
    });

    // Render current tree
    this.renderSkillTree(this.selectedTree);
    this.updateAvailablePoints(this.selectedTree);
  }

  /**
   * Render skills for a specific tree
   */
  renderSkillTree(tree) {
    const container = document.getElementById('skill-tree');
    if (!container || !this.skillData) return;

    const treeData = this.skillData.treeProgress[tree];
    if (!treeData) {
      container.innerHTML = '<p>Loading skill tree...</p>';
      return;
    }

    // Create skill tree layout
    const skillNodes = Object.entries(treeData.skills).map(([skillName, skill]) => {
      const currentLevel = skill.currentLevel || 0;
      const maxLevel = skill.maxLevel;
      const canUpgrade = skill.canUpgrade;
      const nextCost = skill.nextLevelCost;

      return this.createSkillNode(tree, skillName, skill, currentLevel, maxLevel, canUpgrade, nextCost);
    });

    container.innerHTML = `
      <div class="skill-grid">
        ${skillNodes.join('')}
      </div>
    `;

    this.renderSkillConnections(tree, treeData.skills);
  }

  /**
   * Create a skill node HTML
   */
  createSkillNode(tree, skillName, skill, currentLevel, maxLevel, canUpgrade, nextCost) {
    const treeColor = this.skillTrees[tree].color;
    const isMaxed = currentLevel >= maxLevel;
    const hasLevel = currentLevel > 0;

    return `
      <div class="skill-node ${hasLevel ? 'has-level' : ''} ${canUpgrade ? 'can-upgrade' : ''} ${isMaxed ? 'maxed' : ''}"
           data-tree="${tree}" data-skill="${skillName}"
           style="--tree-color: ${treeColor}">
        
        <!-- Skill Icon -->
        <div class="skill-icon-container">
          <div class="skill-progress-ring">
            <svg class="progress-circle" viewBox="0 0 36 36">
              <path class="circle-bg" d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="#2a2a2a" stroke-width="2"/>
              <path class="circle" d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="${treeColor}" stroke-width="2"
                stroke-dasharray="${(currentLevel / maxLevel) * 100}, 100"/>
            </svg>
          </div>
          <span class="skill-level">${currentLevel}</span>
        </div>

        <!-- Skill Info -->
        <div class="skill-info">
          <h4 class="skill-title">${skill.name}</h4>
          <p class="skill-description">${skill.description}</p>
          
          <div class="skill-level-info">
            <span class="level-display">${currentLevel} / ${maxLevel}</span>
            ${!isMaxed && nextCost ? `<span class="upgrade-cost">${nextCost} pts</span>` : ''}
          </div>

          ${canUpgrade && !isMaxed ? `
            <button class="upgrade-skill-btn" data-tree="${tree}" data-skill="${skillName}">
              Upgrade (${nextCost} pts)
            </button>
          ` : ''}

          ${skill.prerequisites && skill.prerequisites.length > 0 ? `
            <div class="prerequisites">
              <small>Requires: ${skill.prerequisites.join(', ')}</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render skill tree connections/prerequisites
   */
  renderSkillConnections(tree, skills) {
    const container = document.getElementById('skill-tree');
    const connections = document.createElement('div');
    connections.className = 'skill-connections';

    // This would create SVG lines between skills based on prerequisites
    // Implementation depends on specific skill tree layout
    
    container.appendChild(connections);
  }

  /**
   * Update available points display
   */
  updateAvailablePoints(tree) {
    if (!this.skillData) return;
    
    const points = this.skillData.skillPoints[tree] || 0;
    const pointsElement = document.getElementById('available-points');
    if (pointsElement) {
      pointsElement.textContent = points;
      pointsElement.classList.toggle('has-points', points > 0);
    }
  }

  /**
   * Show detailed information about a skill
   */
  showSkillDetails(tree, skillName) {
    if (!this.skillData) return;

    const treeData = this.skillData.treeProgress[tree];
    const skill = treeData?.skills[skillName];
    if (!skill) return;

    const detailsPanel = document.getElementById('skill-details');
    const currentLevel = skill.currentLevel || 0;
    const treeColor = this.skillTrees[tree].color;

    detailsPanel.innerHTML = `
      <h4 style="color: ${treeColor}">${skill.name}</h4>
      <p class="skill-desc">${skill.description}</p>
      
      <div class="skill-stats">
        <div class="stat">
          <label>Current Level:</label>
          <span>${currentLevel} / ${skill.maxLevel}</span>
        </div>
        
        ${skill.nextLevelCost ? `
          <div class="stat">
            <label>Next Level Cost:</label>
            <span>${skill.nextLevelCost} skill points</span>
          </div>
        ` : ''}
      </div>

      <div class="skill-effects">
        <h5>Effects:</h5>
        <ul>
          ${Object.entries(skill.effects || {}).map(([effectName, effect]) => `
            <li>
              <strong>${this.formatEffectName(effectName)}:</strong>
              ${this.formatEffectValue(effect, currentLevel)}
              ${currentLevel < skill.maxLevel ? `
                <span class="next-level">
                  → ${this.formatEffectValue(effect, currentLevel + 1)}
                </span>
              ` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      ${skill.prerequisites && skill.prerequisites.length > 0 ? `
        <div class="prerequisites">
          <h5>Prerequisites:</h5>
          <ul>
            ${skill.prerequisites.map(prereq => `<li>${prereq}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  }

  /**
   * Format effect names for display
   */
  formatEffectName(effectName) {
    return effectName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Format effect values for display
   */
  formatEffectValue(effect, level) {
    const value = effect.perLevel * level;
    
    if (effect.type === 'multiplicative') {
      return `+${(value * 100).toFixed(1)}%`;
    } else if (effect.type === 'additive') {
      return `+${value.toFixed(1)}`;
    } else if (effect.type === 'unlock') {
      return level > 0 ? 'Unlocked' : 'Locked';
    }
    
    return value.toString();
  }

  /**
   * Attempt to upgrade a skill
   */
  async upgradeSkill(tree, skillName) {
    try {
      this.gameClient.ws.send(JSON.stringify({
        type: 'upgrade_skill',
        playerId: this.gameClient.playerId,
        skillTree: tree,
        skillName: skillName
      }));

      // Show loading state
      const button = document.querySelector(`[data-tree="${tree}"][data-skill="${skillName}"].upgrade-skill-btn`);
      if (button) {
        button.disabled = true;
        button.textContent = 'Upgrading...';
      }
    } catch (error) {
      console.error('Failed to upgrade skill:', error);
      this.showNotification('Failed to upgrade skill', 'error');
    }
  }

  /**
   * Handle skill upgrade response
   */
  handleSkillUpgrade(data) {
    if (data.success) {
      this.showNotification(`${data.skillName} upgraded to level ${data.newLevel}!`, 'success');
      this.refreshSkillData();
    } else {
      this.showNotification(data.error || 'Failed to upgrade skill', 'error');
    }

    // Reset button states
    document.querySelectorAll('.upgrade-skill-btn').forEach(btn => {
      btn.disabled = false;
      const cost = btn.textContent.match(/\d+/);
      btn.textContent = cost ? `Upgrade (${cost[0]} pts)` : 'Upgrade';
    });
  }

  /**
   * Show notification message
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  /**
   * Handle skill point awards
   */
  handleSkillPointAward(data) {
    if (data.points > 0) {
      this.showNotification(`+${data.points} ${data.tree} skill points earned!`, 'success');
      this.refreshSkillData();
    }
  }

  /**
   * Add keyboard shortcut hint to help
   */
  addHelpText() {
    const helpContainer = document.querySelector('.help-container');
    if (helpContainer) {
      const skillHelp = document.createElement('div');
      skillHelp.innerHTML = '<strong>K</strong> - Open Skill Tree';
      helpContainer.appendChild(skillHelp);
    }
  }
}

// Global skill system instance
let skillSystem = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize skill system when game client is ready
  if (typeof window.gameClient !== 'undefined') {
    skillSystem = new SkillSystemUI(window.gameClient);
    skillSystem.addHelpText();
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SkillSystemUI;
}