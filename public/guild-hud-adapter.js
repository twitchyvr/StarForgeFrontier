/**
 * Guild HUD Adapter
 * Adapts the existing guild system to work with the new HUD panels
 */

class GuildHUDAdapter {
  constructor() {
    this.isInitialized = false;
    this.currentGuild = null;
    this.guildData = {};
    this.init();
  }
  
  init() {
    // Listen for HUD events
    document.addEventListener('hud:guild:show', () => this.onPanelShow());
    document.addEventListener('hud:guild:hide', () => this.onPanelHide());
    document.addEventListener('hud:guild:fullscreen', () => this.onFullscreenRequest());
    
    // Listen for guild data updates
    document.addEventListener('guildDataUpdated', (e) => this.updateGuildData(e.detail));
    
    this.isInitialized = true;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Handle quick action buttons
    document.addEventListener('click', (e) => {
      if (e.target.id === 'createGuild') {
        this.showCreateGuildDialog();
      } else if (e.target.id === 'joinGuild') {
        this.showJoinGuildDialog();
      } else if (e.target.id === 'guildHalls') {
        this.openGuildHalls();
      }
    });
  }
  
  onPanelShow() {
    this.loadGuildContent();
    this.refreshGuildData();
  }
  
  onPanelHide() {
    // Cleanup if needed
  }
  
  onFullscreenRequest() {
    // Open the original guild system for full functionality
    if (typeof window.guildSystem !== 'undefined' && window.guildSystem.show) {
      window.guildSystem.show();
    } else {
      // Fallback to original guild panel
      const originalPanel = document.getElementById('guildSystem');
      if (originalPanel) {
        originalPanel.classList.remove('hidden');
      }
    }
  }
  
  loadGuildContent() {
    const content = this.generateCompactGuildView();
    window.hudController.updatePanelContent('guild', content);
  }
  
  updateGuildData(data) {
    this.guildData = data || {};
    this.currentGuild = data?.currentGuild || null;
    
    if (window.hudController.isVisible('guild')) {
      this.loadGuildContent();
    }
    
    // Update badge count (notifications, pending requests, etc.)
    const notifications = (data?.notifications || []).length;
    window.hudController.setBadge('guild', notifications);
  }
  
  generateCompactGuildView() {
    let html = '';
    
    if (this.currentGuild) {
      html += this.generateCurrentGuildView();
    } else {
      html += this.generateNoGuildView();
    }
    
    return html;
  }
  
  generateCurrentGuildView() {
    const guild = this.currentGuild;
    
    let html = `
      <div style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 3px solid var(--hud-accent);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-weight: 600; color: var(--hud-accent); font-size: 14px;">${guild.name}</div>
          <div style="font-size: 10px; color: var(--hud-text-secondary); text-transform: uppercase;">
            ${guild.type || 'Guild'}
          </div>
        </div>
        <div style="font-size: 11px; color: var(--hud-text-secondary); margin-bottom: 8px;">
          ${guild.description || 'No description available'}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: var(--hud-text-secondary);">Members: <strong style="color: white;">${guild.memberCount || 0}</strong></span>
          <span style="color: var(--hud-text-secondary);">Level: <strong style="color: white;">${guild.level || 1}</strong></span>
        </div>
      </div>
    `;
    
    // Recent members
    if (guild.recentMembers && guild.recentMembers.length > 0) {
      html += `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; color: var(--hud-accent); margin-bottom: 8px; text-transform: uppercase; font-weight: 600;">Recent Members</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
      `;
      
      guild.recentMembers.slice(0, 3).forEach(member => {
        const statusColor = member.online ? '#28a745' : '#6c757d';
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
            <span style="font-size: 11px;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; margin-right: 6px;"></span>
              ${member.name}
            </span>
            <span style="font-size: 9px; color: var(--hud-text-secondary);">${member.role || 'Member'}</span>
          </div>
        `;
      });
      
      html += '</div></div>';
    }
    
    // Guild activities
    if (guild.recentActivities && guild.recentActivities.length > 0) {
      html += `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; color: var(--hud-accent); margin-bottom: 8px; text-transform: uppercase; font-weight: 600;">Recent Activity</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
      `;
      
      guild.recentActivities.slice(0, 3).forEach(activity => {
        html += `
          <div style="padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 10px; color: var(--hud-text-secondary);">
            ${activity.description}
          </div>
        `;
      });
      
      html += '</div></div>';
    }
    
    // Quick actions for guild members
    html += `
      <div style="display: flex; gap: 6px; margin-top: 12px;">
        <button class="guild-action-btn" onclick="window.guildHUDAdapter.openFullInterface()" style="flex: 1; font-size: 11px;">
          Manage
        </button>
        <button class="guild-action-btn" onclick="window.guildHUDAdapter.viewGuildHalls()" style="flex: 1; font-size: 11px;">
          Halls
        </button>
        <button class="guild-action-btn" onclick="window.guildHUDAdapter.refreshGuildData()" style="width: auto; padding: 8px; font-size: 11px;">
          🔄
        </button>
      </div>
    `;
    
    return html;
  }
  
  generateNoGuildView() {
    return `
      <div style="text-align: center; padding: 20px; color: var(--hud-text-secondary);">
        <div style="font-size: 32px; margin-bottom: 12px;">🛡️</div>
        <div style="font-size: 12px; margin-bottom: 8px;">No Guild Membership</div>
        <div style="font-size: 10px; line-height: 1.4; margin-bottom: 16px;">
          Join or create a guild to collaborate with other players and access exclusive features.
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="guild-action-btn" onclick="window.guildHUDAdapter.showCreateGuildDialog()" style="flex: 1; font-size: 11px;">
            Create Guild
          </button>
          <button class="guild-action-btn" onclick="window.guildHUDAdapter.showJoinGuildDialog()" style="flex: 1; font-size: 11px;">
            Join Guild
          </button>
        </div>
      </div>
    `;
  }
  
  showCreateGuildDialog() {
    // This would open a simple dialog for guild creation
    if (typeof window.guildSystem !== 'undefined' && window.guildSystem.showCreateDialog) {
      window.guildSystem.showCreateDialog();
    } else {
      this.openFullInterface();
    }
  }
  
  showJoinGuildDialog() {
    // This would open a simple dialog for joining guilds
    if (typeof window.guildSystem !== 'undefined' && window.guildSystem.showJoinDialog) {
      window.guildSystem.showJoinDialog();
    } else {
      this.openFullInterface();
    }
  }
  
  viewGuildHalls() {
    if (typeof window.guildSystem !== 'undefined' && window.guildSystem.showGuildHalls) {
      window.guildSystem.showGuildHalls();
    } else {
      this.openFullInterface();
    }
  }
  
  openGuildHalls() {
    this.viewGuildHalls();
  }
  
  refreshGuildData() {
    // Trigger guild data refresh
    if (typeof window.socket !== 'undefined') {
      window.socket.emit('requestGuildUpdate');
    }
    
    // Visual feedback
    const refreshBtn = document.querySelector('#guildRefresh');
    if (refreshBtn) {
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshBtn.style.transform = '';
      }, 300);
    }
  }
  
  openFullInterface() {
    window.hudController.hidePanel('guild');
    this.onFullscreenRequest();
  }
}

// Initialize the adapter
window.guildHUDAdapter = new GuildHUDAdapter();