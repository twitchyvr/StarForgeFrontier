/**
 * Guild System UI for StarForgeFrontier
 * Manages guild interface, interactions, and real-time updates
 */

class GuildSystemUI {
  constructor() {
    this.isVisible = false;
    this.currentSection = 'overview';
    this.playerGuild = null;
    this.guildMembers = [];
    this.guildData = null;
    this.updateInterval = null;
    
    // DOM elements will be initialized in createUI()
    this.elements = {};
    
    // Event handlers
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    
    this.createUI();
    this.attachEventListeners();
    this.initialize();
  }

  /**
   * Initialize the guild system
   */
  async initialize() {
    try {
      await this.loadPlayerGuild();
      this.startUpdateLoop();
    } catch (error) {
      console.error('Failed to initialize guild system:', error);
    }
  }

  /**
   * Create the guild system UI elements
   */
  createUI() {
    // Main container
    const guildSystem = document.createElement('div');
    guildSystem.className = 'guild-system hidden';
    guildSystem.id = 'guildSystem';

    guildSystem.innerHTML = `
      <!-- Guild Header -->
      <div class="guild-header">
        <div class="guild-title">
          Guild Management
        </div>
        <div class="guild-controls">
          <button class="guild-btn" id="guildRefreshBtn">
            🔄 Refresh
          </button>
          <button class="guild-close-btn" id="guildCloseBtn">
            ✕
          </button>
        </div>
      </div>

      <!-- Guild Main Layout -->
      <div class="guild-main">
        <!-- Navigation Sidebar -->
        <div class="guild-nav">
          <div class="guild-nav-section">
            <div class="guild-nav-title">Guild</div>
            <div class="guild-nav-item active" data-section="overview">
              <span class="guild-nav-icon">🏠</span>
              <span>Overview</span>
            </div>
            <div class="guild-nav-item" data-section="members">
              <span class="guild-nav-icon">👥</span>
              <span>Members</span>
            </div>
            <div class="guild-nav-item" data-section="resources">
              <span class="guild-nav-icon">💰</span>
              <span>Resources</span>
            </div>
            <div class="guild-nav-item" data-section="halls">
              <span class="guild-nav-icon">🏛️</span>
              <span>Guild Halls</span>
            </div>
          </div>
          
          <div class="guild-nav-section">
            <div class="guild-nav-title">Management</div>
            <div class="guild-nav-item" data-section="roles">
              <span class="guild-nav-icon">🎖️</span>
              <span>Roles</span>
            </div>
            <div class="guild-nav-item" data-section="diplomacy">
              <span class="guild-nav-icon">🤝</span>
              <span>Diplomacy</span>
            </div>
            <div class="guild-nav-item" data-section="wars">
              <span class="guild-nav-icon">⚔️</span>
              <span>Wars</span>
            </div>
            <div class="guild-nav-item" data-section="settings">
              <span class="guild-nav-icon">⚙️</span>
              <span>Settings</span>
            </div>
          </div>

          <div class="guild-nav-section">
            <div class="guild-nav-title">Actions</div>
            <div class="guild-nav-item" data-action="create-guild">
              <span class="guild-nav-icon">➕</span>
              <span>Create Guild</span>
            </div>
            <div class="guild-nav-item" data-action="search-guilds">
              <span class="guild-nav-icon">🔍</span>
              <span>Search Guilds</span>
            </div>
            <div class="guild-nav-item" data-action="leave-guild">
              <span class="guild-nav-icon">🚪</span>
              <span>Leave Guild</span>
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div class="guild-content">
          <!-- Overview Section -->
          <div class="guild-content-section active" id="overview-section">
            <h2 class="guild-section-title">Guild Overview</h2>
            <div id="guildOverviewContent">
              <div class="guild-info-message">
                <p>You are not currently a member of any guild.</p>
                <button class="guild-btn success" onclick="guildSystemUI.showCreateGuildModal()">Create Guild</button>
                <button class="guild-btn" onclick="guildSystemUI.showSearchGuilds()">Search Guilds</button>
              </div>
            </div>
          </div>

          <!-- Members Section -->
          <div class="guild-content-section" id="members-section">
            <div class="guild-members-header">
              <h2 class="guild-section-title">Guild Members</h2>
              <div class="guild-member-filters">
                <select class="guild-filter-select" id="memberRoleFilter">
                  <option value="all">All Roles</option>
                  <option value="founder">Founder</option>
                  <option value="leader">Leaders</option>
                  <option value="officer">Officers</option>
                  <option value="veteran">Veterans</option>
                  <option value="member">Members</option>
                  <option value="recruit">Recruits</option>
                </select>
                <select class="guild-filter-select" id="memberStatusFilter">
                  <option value="all">All Members</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
                <button class="guild-btn" id="inviteMemberBtn">Invite Member</button>
              </div>
            </div>
            <div class="guild-members-list" id="guildMembersList">
              <!-- Members will be populated here -->
            </div>
          </div>

          <!-- Resources Section -->
          <div class="guild-content-section" id="resources-section">
            <h2 class="guild-section-title">Guild Resources</h2>
            <div class="guild-resources-grid" id="guildResourcesGrid">
              <!-- Resources will be populated here -->
            </div>
            
            <div class="guild-resource-transactions">
              <h3>Recent Transactions</h3>
              <div id="resourceTransactionsList">
                <!-- Transactions will be populated here -->
              </div>
            </div>
          </div>

          <!-- Guild Halls Section -->
          <div class="guild-content-section" id="halls-section">
            <div class="guild-section-header">
              <h2 class="guild-section-title">Guild Halls</h2>
              <button class="guild-btn success" id="buildHallBtn">Build New Hall</button>
            </div>
            <div class="guild-halls-grid" id="guildHallsGrid">
              <!-- Halls will be populated here -->
            </div>
          </div>

          <!-- Roles Section -->
          <div class="guild-content-section" id="roles-section">
            <h2 class="guild-section-title">Guild Roles & Permissions</h2>
            <div id="guildRolesList">
              <!-- Roles will be populated here -->
            </div>
          </div>

          <!-- Diplomacy Section -->
          <div class="guild-content-section" id="diplomacy-section">
            <h2 class="guild-section-title">Guild Diplomacy</h2>
            <div class="guild-diplomacy-tabs">
              <button class="guild-tab active" data-tab="allies">Allies</button>
              <button class="guild-tab" data-tab="enemies">Enemies</button>
              <button class="guild-tab" data-tab="neutral">Neutral</button>
            </div>
            <div id="diplomacyContent">
              <!-- Diplomatic relations will be populated here -->
            </div>
          </div>

          <!-- Wars Section -->
          <div class="guild-content-section" id="wars-section">
            <h2 class="guild-section-title">Guild Wars</h2>
            <div class="guild-wars-content" id="guildWarsContent">
              <!-- Wars will be populated here -->
            </div>
          </div>

          <!-- Settings Section -->
          <div class="guild-content-section" id="settings-section">
            <h2 class="guild-section-title">Guild Settings</h2>
            <div id="guildSettingsForm">
              <!-- Settings form will be populated here -->
            </div>
          </div>
        </div>

        <!-- Sidebar Info Panel -->
        <div class="guild-sidebar">
          <div class="guild-sidebar-section">
            <div class="guild-sidebar-title">Quick Stats</div>
            <div id="guildQuickStats">
              <!-- Quick stats will be populated here -->
            </div>
          </div>

          <div class="guild-sidebar-section">
            <div class="guild-sidebar-title">Recent Activity</div>
            <div id="guildRecentActivity">
              <!-- Recent activity will be populated here -->
            </div>
          </div>

          <div class="guild-sidebar-section">
            <div class="guild-sidebar-title">Guild Bonuses</div>
            <div id="guildBonuses">
              <!-- Guild bonuses will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(guildSystem);

    // Create modals
    this.createModals();

    // Store references to important elements
    this.elements = {
      system: guildSystem,
      closeBtn: document.getElementById('guildCloseBtn'),
      refreshBtn: document.getElementById('guildRefreshBtn'),
      navItems: guildSystem.querySelectorAll('.guild-nav-item'),
      sections: guildSystem.querySelectorAll('.guild-content-section')
    };
  }

  /**
   * Create modal dialogs
   */
  createModals() {
    // Create Guild Modal
    const createModal = document.createElement('div');
    createModal.className = 'guild-create-modal hidden';
    createModal.id = 'guildCreateModal';
    
    createModal.innerHTML = `
      <div class="guild-create-form">
        <h2 class="guild-create-title">Create New Guild</h2>
        <form id="guildCreateForm">
          <div class="guild-form-group">
            <label class="guild-form-label">Guild Name</label>
            <input type="text" class="guild-form-input" id="guildNameInput" 
                   placeholder="Enter guild name (3-50 characters)" maxlength="50" required>
          </div>
          
          <div class="guild-form-group">
            <label class="guild-form-label">Guild Tag</label>
            <input type="text" class="guild-form-input" id="guildTagInput" 
                   placeholder="Enter guild tag (2-5 characters)" maxlength="5" required>
          </div>
          
          <div class="guild-form-group">
            <label class="guild-form-label">Description</label>
            <textarea class="guild-form-input guild-form-textarea" id="guildDescriptionInput" 
                      placeholder="Describe your guild's purpose and goals"></textarea>
          </div>
          
          <div class="guild-form-group">
            <label class="guild-form-label">Guild Type</label>
            <select class="guild-form-input" id="guildTypeInput">
              <option value="MIXED">Mixed (All Activities)</option>
              <option value="COMBAT">Combat Focused</option>
              <option value="TRADING">Trading Focused</option>
              <option value="EXPLORATION">Exploration Focused</option>
            </select>
          </div>
          
          <div class="guild-form-group">
            <label class="guild-form-label">Maximum Members</label>
            <input type="number" class="guild-form-input" id="guildMaxMembersInput" 
                   value="50" min="10" max="200">
          </div>
          
          <div class="guild-form-group">
            <label class="guild-form-label">
              <input type="checkbox" id="guildRecruitmentOpenInput" checked> 
              Open Recruitment
            </label>
          </div>
          
          <div class="guild-form-group">
            <label class="guild-form-label">
              <input type="checkbox" id="guildRequiresApplicationInput"> 
              Require Applications
            </label>
          </div>
          
          <div class="guild-form-actions">
            <button type="button" class="guild-btn" onclick="guildSystemUI.hideCreateGuildModal()">Cancel</button>
            <button type="submit" class="guild-btn success">Create Guild</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(createModal);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    this.elements.closeBtn.addEventListener('click', () => this.hide());
    
    // Refresh button
    this.elements.refreshBtn.addEventListener('click', () => this.refresh());

    // Navigation items
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => this.handleNavClick(e));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyPress);

    // WebSocket messages
    if (window.gameClient && window.gameClient.ws) {
      window.gameClient.ws.addEventListener('message', this.handleWebSocketMessage);
    }

    // Form submissions
    document.getElementById('guildCreateForm').addEventListener('submit', (e) => this.handleCreateGuild(e));
  }

  /**
   * Handle keyboard input
   */
  handleKeyPress(event) {
    if (event.key === 'Escape' && this.isVisible) {
      this.hide();
    }
    
    // Guild hotkey (U key)
    if (event.key === 'u' && !event.ctrlKey && !event.altKey && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA') {
      this.toggle();
    }
  }

  /**
   * Handle WebSocket messages for guild updates
   */
  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'guild_update':
          this.handleGuildUpdate(data);
          break;
        case 'guild_member_joined':
          this.handleMemberJoined(data);
          break;
        case 'guild_member_left':
          this.handleMemberLeft(data);
          break;
        case 'guild_role_changed':
          this.handleRoleChanged(data);
          break;
        case 'guild_resources_updated':
          this.handleResourcesUpdated(data);
          break;
        case 'guild_event':
          this.handleGuildEvent(data);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle navigation clicks
   */
  handleNavClick(event) {
    const item = event.currentTarget;
    const section = item.dataset.section;
    const action = item.dataset.action;

    if (section) {
      this.showSection(section);
    } else if (action) {
      this.handleAction(action);
    }
  }

  /**
   * Handle special actions
   */
  handleAction(action) {
    switch (action) {
      case 'create-guild':
        this.showCreateGuildModal();
        break;
      case 'search-guilds':
        this.showSearchGuilds();
        break;
      case 'leave-guild':
        this.handleLeaveGuild();
        break;
    }
  }

  /**
   * Show/hide the guild system
   */
  show() {
    this.elements.system.classList.remove('hidden');
    this.elements.system.classList.add('guild-fade-in');
    this.isVisible = true;
    this.loadPlayerGuild();
  }

  hide() {
    this.elements.system.classList.add('hidden');
    this.elements.system.classList.remove('guild-fade-in');
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show a specific section
   */
  showSection(sectionName) {
    // Update navigation
    this.elements.navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === sectionName) {
        item.classList.add('active');
      }
    });

    // Update content sections
    this.elements.sections.forEach(section => {
      section.classList.remove('active');
      if (section.id === `${sectionName}-section`) {
        section.classList.add('active');
      }
    });

    this.currentSection = sectionName;
    this.loadSectionData(sectionName);
  }

  /**
   * Load data for a specific section
   */
  async loadSectionData(section) {
    try {
      switch (section) {
        case 'overview':
          await this.loadOverview();
          break;
        case 'members':
          await this.loadMembers();
          break;
        case 'resources':
          await this.loadResources();
          break;
        case 'halls':
          await this.loadGuildHalls();
          break;
        case 'roles':
          await this.loadRoles();
          break;
        case 'diplomacy':
          await this.loadDiplomacy();
          break;
        case 'wars':
          await this.loadWars();
          break;
        case 'settings':
          await this.loadSettings();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${section} data:`, error);
    }
  }

  /**
   * Load player's guild data
   */
  async loadPlayerGuild() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Silently skip guild loading if no token is available
        console.debug('No authentication token available for guild loading');
        return;
      }

      const response = await fetch('/api/guild/my-guild', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.playerGuild = data.guild;
        this.guildData = data;
        this.updateUIForGuildMember();
      } else if (response.status === 401) {
        // User is not authenticated or token is invalid - this is expected for guests
        console.debug('User not authenticated for guild access');
      } else if (response.status === 404) {
        // Player is not in a guild - this is expected
        console.debug('Player is not currently in a guild');
      } else {
        this.playerGuild = null;
        this.updateUIForNonMember();
      }
    } catch (error) {
      console.error('Error loading player guild:', error);
      this.playerGuild = null;
      this.updateUIForNonMember();
    }
  }

  /**
   * Update UI for guild members
   */
  updateUIForGuildMember() {
    // Show guild-specific navigation items
    const memberOnlyItems = ['members', 'resources', 'halls', 'roles', 'diplomacy', 'wars', 'settings'];
    memberOnlyItems.forEach(item => {
      const element = document.querySelector(`[data-section="${item}"]`);
      if (element) {
        element.style.display = 'flex';
      }
    });

    // Hide non-member items
    const nonMemberItems = ['create-guild', 'search-guilds'];
    nonMemberItems.forEach(item => {
      const element = document.querySelector(`[data-action="${item}"]`);
      if (element) {
        element.style.display = 'none';
      }
    });

    // Show leave guild option
    const leaveGuildItem = document.querySelector(`[data-action="leave-guild"]`);
    if (leaveGuildItem) {
      leaveGuildItem.style.display = 'flex';
    }

    this.loadOverview();
    this.loadSidebarInfo();
  }

  /**
   * Update UI for non-guild members
   */
  updateUIForNonMember() {
    // Hide guild-specific navigation items
    const memberOnlyItems = ['members', 'resources', 'halls', 'roles', 'diplomacy', 'wars', 'settings'];
    memberOnlyItems.forEach(item => {
      const element = document.querySelector(`[data-section="${item}"]`);
      if (element) {
        element.style.display = 'none';
      }
    });

    // Show non-member items
    const nonMemberItems = ['create-guild', 'search-guilds'];
    nonMemberItems.forEach(item => {
      const element = document.querySelector(`[data-action="${item}"]`);
      if (element) {
        element.style.display = 'flex';
      }
    });

    // Hide leave guild option
    const leaveGuildItem = document.querySelector(`[data-action="leave-guild"]`);
    if (leaveGuildItem) {
      leaveGuildItem.style.display = 'none';
    }

    this.loadNonMemberOverview();
  }

  /**
   * Load overview for non-guild members
   */
  loadNonMemberOverview() {
    const content = document.getElementById('guildOverviewContent');
    content.innerHTML = `
      <div class="guild-info-message">
        <h3>You are not currently a member of any guild.</h3>
        <p>Guilds provide many benefits including:</p>
        <ul>
          <li>🤝 Cooperation with other players</li>
          <li>💰 Shared resources and guild treasury</li>
          <li>🏛️ Access to guild halls and facilities</li>
          <li>⚔️ Participate in guild wars and diplomacy</li>
          <li>📈 Guild-specific bonuses and perks</li>
          <li>🎯 Coordinated missions and objectives</li>
        </ul>
        <div class="guild-form-actions">
          <button class="guild-btn success" onclick="guildSystemUI.showCreateGuildModal()">Create New Guild</button>
          <button class="guild-btn" onclick="guildSystemUI.showSearchGuilds()">Search & Join Guilds</button>
        </div>
      </div>
    `;
  }

  /**
   * Load guild overview
   */
  async loadOverview() {
    if (!this.playerGuild) {
      this.loadNonMemberOverview();
      return;
    }

    const content = document.getElementById('guildOverviewContent');
    const guild = this.playerGuild;

    content.innerHTML = `
      <div class="guild-overview">
        <div class="guild-info-card">
          <div class="guild-info-title">[${guild.tag}] ${guild.name}</div>
          <p><strong>Founded:</strong> ${new Date(guild.foundedAt).toLocaleDateString()}</p>
          <p><strong>Type:</strong> ${guild.guildType}</p>
          <p><strong>Description:</strong> ${guild.description}</p>
          
          <div class="guild-stat-grid">
            <div class="guild-stat-item">
              <div class="guild-stat-value">${guild.memberCount}</div>
              <div class="guild-stat-label">Members</div>
            </div>
            <div class="guild-stat-item">
              <div class="guild-stat-value">${guild.guildLevel}</div>
              <div class="guild-stat-label">Level</div>
            </div>
            <div class="guild-stat-item">
              <div class="guild-stat-value">${guild.territories}</div>
              <div class="guild-stat-label">Territories</div>
            </div>
            <div class="guild-stat-item">
              <div class="guild-stat-value">${guild.allies}</div>
              <div class="guild-stat-label">Allies</div>
            </div>
          </div>
        </div>

        <div class="guild-info-card">
          <div class="guild-info-title">Guild Progress</div>
          <div class="guild-progress-section">
            <label>Experience Progress</label>
            <div class="guild-progress-bar">
              <div class="guild-progress-fill" style="width: ${(guild.experiencePoints / guild.requiredExp) * 100}%"></div>
            </div>
            <small>${guild.experiencePoints} / ${guild.requiredExp} XP</small>
          </div>

          <div class="guild-stat-grid guild-mt-20">
            <div class="guild-stat-item">
              <div class="guild-stat-value">${guild.resources?.credits || 0}</div>
              <div class="guild-stat-label">Credits</div>
            </div>
            <div class="guild-stat-item">
              <div class="guild-stat-value">${guild.reputation || 0}</div>
              <div class="guild-stat-label">Reputation</div>
            </div>
          </div>
        </div>
      </div>

      <div class="guild-info-card">
        <div class="guild-info-title">Recent Achievements</div>
        <div id="guildAchievements">
          <!-- Achievements will be loaded here -->
        </div>
      </div>
    `;

    this.loadGuildAchievements();
  }

  /**
   * Load guild members
   */
  async loadMembers() {
    if (!this.playerGuild) return;

    try {
      const response = await fetch(`/api/guild/${this.playerGuild.id}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.guildMembers = data.members;
        this.renderMembersList();
      }
    } catch (error) {
      console.error('Error loading guild members:', error);
    }
  }

  /**
   * Render members list
   */
  renderMembersList() {
    const membersList = document.getElementById('guildMembersList');
    
    if (!this.guildMembers || this.guildMembers.length === 0) {
      membersList.innerHTML = '<div class="guild-info-message">No members found.</div>';
      return;
    }

    const membersHTML = this.guildMembers.map(member => `
      <div class="guild-member-item">
        <div class="guild-member-avatar">
          ${member.username.charAt(0).toUpperCase()}
        </div>
        <div class="guild-member-info">
          <div class="guild-member-name">${member.username}</div>
          <div class="guild-member-role ${member.roleId}">${member.roleName}</div>
          <div class="guild-member-stats">
            Contribution: ${member.contributionPoints} | 
            Joined: ${new Date(member.joinedAt).toLocaleDateString()} |
            ${member.isOnline ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>
        <div class="guild-member-actions">
          ${this.canManageMember(member) ? `
            <button class="guild-action-btn" onclick="guildSystemUI.promoteMember('${member.playerId}')">Promote</button>
            <button class="guild-action-btn" onclick="guildSystemUI.demoteMember('${member.playerId}')">Demote</button>
            <button class="guild-action-btn danger" onclick="guildSystemUI.kickMember('${member.playerId}')">Kick</button>
          ` : ''}
        </div>
      </div>
    `).join('');

    membersList.innerHTML = membersHTML;
  }

  /**
   * Check if current player can manage a member
   */
  canManageMember(member) {
    // This would need to be implemented based on the player's permissions
    return true; // Placeholder
  }

  /**
   * Show create guild modal
   */
  showCreateGuildModal() {
    const modal = document.getElementById('guildCreateModal');
    modal.classList.remove('hidden');
    modal.classList.add('guild-fade-in');
  }

  /**
   * Hide create guild modal
   */
  hideCreateGuildModal() {
    const modal = document.getElementById('guildCreateModal');
    modal.classList.add('hidden');
    modal.classList.remove('guild-fade-in');
  }

  /**
   * Handle guild creation
   */
  async handleCreateGuild(event) {
    event.preventDefault();
    
    const formData = {
      name: document.getElementById('guildNameInput').value,
      tag: document.getElementById('guildTagInput').value.toUpperCase(),
      description: document.getElementById('guildDescriptionInput').value,
      guildType: document.getElementById('guildTypeInput').value,
      maxMembers: parseInt(document.getElementById('guildMaxMembersInput').value),
      recruitmentOpen: document.getElementById('guildRecruitmentOpenInput').checked,
      requiresApplication: document.getElementById('guildRequiresApplicationInput').checked
    };

    try {
      const response = await fetch('/api/guild/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        this.hideCreateGuildModal();
        this.showNotification('Guild created successfully!', 'success');
        await this.loadPlayerGuild();
        this.showSection('overview');
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Failed to create guild', 'error');
      }
    } catch (error) {
      console.error('Error creating guild:', error);
      this.showNotification('Error creating guild', 'error');
    }
  }

  /**
   * Load sidebar information
   */
  loadSidebarInfo() {
    this.loadQuickStats();
    this.loadRecentActivity();
    this.loadGuildBonuses();
  }

  /**
   * Load quick stats
   */
  loadQuickStats() {
    if (!this.playerGuild) return;

    const quickStats = document.getElementById('guildQuickStats');
    quickStats.innerHTML = `
      <div class="guild-stat-item">
        <div class="guild-stat-value">${this.playerGuild.activeMembers}</div>
        <div class="guild-stat-label">Online Now</div>
      </div>
      <div class="guild-stat-item">
        <div class="guild-stat-value">${this.playerGuild.resources?.credits || 0}</div>
        <div class="guild-stat-label">Guild Credits</div>
      </div>
      <div class="guild-stat-item">
        <div class="guild-stat-value">${this.playerGuild.territories || 0}</div>
        <div class="guild-stat-label">Controlled Sectors</div>
      </div>
    `;
  }

  /**
   * Load recent activity
   */
  async loadRecentActivity() {
    if (!this.playerGuild) return;

    try {
      const response = await fetch(`/api/guild/${this.playerGuild.id}/events?limit=5`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.renderRecentActivity(data.events);
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  }

  /**
   * Render recent activity
   */
  renderRecentActivity(events) {
    const activityContainer = document.getElementById('guildRecentActivity');
    
    if (!events || events.length === 0) {
      activityContainer.innerHTML = '<div class="guild-info-message">No recent activity</div>';
      return;
    }

    const activitiesHTML = events.map(event => `
      <div class="guild-activity-item">
        <div class="guild-activity-icon">${this.getEventIcon(event.event_type)}</div>
        <div class="guild-activity-content">
          <div class="guild-activity-text">${this.formatEventText(event)}</div>
          <div class="guild-activity-time">${this.formatTime(event.timestamp)}</div>
        </div>
      </div>
    `).join('');

    activityContainer.innerHTML = activitiesHTML;
  }

  /**
   * Get icon for event type
   */
  getEventIcon(eventType) {
    const icons = {
      'member_joined': '👋',
      'member_left': '🚪',
      'member_kicked': '❌',
      'role_changed': '🎖️',
      'resource_deposited': '💰',
      'guild_level_up': '📈',
      'war_declared': '⚔️',
      'territory_claimed': '🏴',
      'hall_built': '🏛️'
    };
    return icons[eventType] || '📝';
  }

  /**
   * Format event text
   */
  formatEventText(event) {
    // This would format the event text based on the event type and data
    return event.description || `${event.event_type} event occurred`;
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  /**
   * Load guild bonuses
   */
  loadGuildBonuses() {
    if (!this.playerGuild) return;

    const bonuses = document.getElementById('guildBonuses');
    // This would be populated with actual guild bonuses
    bonuses.innerHTML = `
      <div class="guild-bonus-item">
        <div class="guild-bonus-name">Experience Gain</div>
        <div class="guild-bonus-value">+15%</div>
      </div>
      <div class="guild-bonus-item">
        <div class="guild-bonus-name">Resource Collection</div>
        <div class="guild-bonus-value">+10%</div>
      </div>
      <div class="guild-bonus-item">
        <div class="guild-bonus-name">Trading Bonus</div>
        <div class="guild-bonus-value">+5%</div>
      </div>
    `;
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // This would integrate with the existing notification system
    console.log(`${type.toUpperCase()}: ${message}`);
  }

  /**
   * Refresh guild data
   */
  async refresh() {
    await this.loadPlayerGuild();
    await this.loadSectionData(this.currentSection);
  }

  /**
   * Start update loop
   */
  startUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      if (this.isVisible && this.playerGuild) {
        this.refresh();
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Stop update loop
   */
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Handle guild updates from WebSocket
   */
  handleGuildUpdate(data) {
    if (data.guildId === this.playerGuild?.id) {
      this.playerGuild = { ...this.playerGuild, ...data.updates };
      if (this.isVisible) {
        this.loadSectionData(this.currentSection);
        this.loadSidebarInfo();
      }
    }
  }

  /**
   * Handle member joined event
   */
  handleMemberJoined(data) {
    if (data.guildId === this.playerGuild?.id) {
      this.showNotification(`${data.playerName} joined the guild!`, 'success');
      if (this.currentSection === 'members') {
        this.loadMembers();
      }
    }
  }

  /**
   * Handle member left event
   */
  handleMemberLeft(data) {
    if (data.guildId === this.playerGuild?.id) {
      this.showNotification(`${data.playerName} left the guild.`, 'info');
      if (this.currentSection === 'members') {
        this.loadMembers();
      }
    }
  }

  /**
   * Handle role changed event
   */
  handleRoleChanged(data) {
    if (data.guildId === this.playerGuild?.id) {
      this.showNotification(`${data.playerName} was ${data.newRole === 'higher' ? 'promoted' : 'demoted'}.`, 'info');
      if (this.currentSection === 'members') {
        this.loadMembers();
      }
    }
  }

  /**
   * Handle resources updated event
   */
  handleResourcesUpdated(data) {
    if (data.guildId === this.playerGuild?.id) {
      if (this.currentSection === 'resources' || this.currentSection === 'overview') {
        this.loadSectionData(this.currentSection);
      }
      this.loadSidebarInfo();
    }
  }

  /**
   * Handle guild event
   */
  handleGuildEvent(data) {
    if (data.guildId === this.playerGuild?.id) {
      this.loadRecentActivity();
      
      // Show notification for important events
      if (['guild_level_up', 'war_declared', 'territory_claimed'].includes(data.eventType)) {
        this.showNotification(this.formatEventText(data), 'info');
      }
    }
  }

  // Placeholder methods for member management
  async promoteMember(playerId) {
    // Implementation for promoting a member
    console.log('Promote member:', playerId);
  }

  async demoteMember(playerId) {
    // Implementation for demoting a member
    console.log('Demote member:', playerId);
  }

  async kickMember(playerId) {
    // Implementation for kicking a member
    console.log('Kick member:', playerId);
  }

  // Placeholder methods for other sections
  async loadResources() {
    console.log('Loading guild resources...');
  }

  async loadGuildHalls() {
    console.log('Loading guild halls...');
  }

  async loadRoles() {
    console.log('Loading guild roles...');
  }

  async loadDiplomacy() {
    console.log('Loading guild diplomacy...');
  }

  async loadWars() {
    console.log('Loading guild wars...');
  }

  async loadSettings() {
    console.log('Loading guild settings...');
  }

  async loadGuildAchievements() {
    console.log('Loading guild achievements...');
  }

  async showSearchGuilds() {
    console.log('Showing guild search...');
  }

  async handleLeaveGuild() {
    console.log('Leaving guild...');
  }
}

// Initialize the guild system UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.guildSystemUI = new GuildSystemUI();
});