/**
 * Guild System Manager for StarForgeFrontier
 * Orchestrates all guild operations, integrations, and management
 */

const Guild = require('./Guild');
const GuildHall = require('./GuildHall');
const { v4: uuidv4 } = require('uuid');

class GuildSystem {
  constructor(database, skillSystem = null, factionSystem = null) {
    this.db = database;
    this.skillSystem = skillSystem;
    this.factionSystem = factionSystem;
    this.guilds = new Map(); // Cache active guilds
    this.guildMembers = new Map(); // playerId -> guildId mapping
    this.initialized = false;
  }

  /**
   * Initialize the guild system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load active guilds from database
      const guildData = await this.db.all('SELECT * FROM guilds WHERE is_active = 1');
      
      for (const data of guildData) {
        const guild = Guild.fromDatabase(data);
        
        // Load guild members
        const members = await this.db.all(
          'SELECT * FROM guild_members WHERE guild_id = ?',
          [guild.id]
        );
        
        for (const memberData of members) {
          const member = {
            playerId: memberData.player_id,
            guildId: guild.id,
            roleId: memberData.role_id,
            joinedAt: memberData.joined_at,
            contributionPoints: memberData.contribution_points,
            lastActive: memberData.last_active
          };
          
          // Load role permissions
          const role = await this.db.get(
            'SELECT permissions FROM guild_roles WHERE guild_id = ? AND role_id = ?',
            [guild.id, memberData.role_id]
          );
          
          if (role) {
            member.permissions = JSON.parse(role.permissions);
          } else {
            member.permissions = [];
          }

          guild.members.set(memberData.player_id, member);
          this.guildMembers.set(memberData.player_id, guild.id);
        }

        // Load guild roles
        const roles = await this.db.all(
          'SELECT * FROM guild_roles WHERE guild_id = ?',
          [guild.id]
        );

        for (const roleData of roles) {
          const role = {
            id: roleData.role_id,
            name: roleData.role_name,
            priority: roleData.priority,
            permissions: JSON.parse(roleData.permissions),
            color: roleData.color,
            isDefault: roleData.is_default === 1,
            maxMembers: roleData.max_members
          };
          guild.roles.set(roleData.role_id, role);
        }

        this.guilds.set(guild.id, guild);
      }

      this.initialized = true;
      console.log(`Guild System initialized with ${this.guilds.size} active guilds`);
    } catch (error) {
      console.error('Failed to initialize Guild System:', error);
      throw error;
    }
  }

  /**
   * Create a new guild
   */
  async createGuild(founderPlayerId, guildName, guildTag, options = {}) {
    // Validate inputs
    if (!guildName || guildName.length < 3 || guildName.length > 50) {
      throw new Error('Guild name must be between 3 and 50 characters');
    }

    if (!guildTag || guildTag.length < 2 || guildTag.length > 5) {
      throw new Error('Guild tag must be between 2 and 5 characters');
    }

    // Check if player is already in a guild
    if (this.guildMembers.has(founderPlayerId)) {
      throw new Error('Player is already a member of a guild');
    }

    // Check if guild name or tag already exists
    const existingGuild = await this.db.get(
      'SELECT id FROM guilds WHERE name = ? OR tag = ?',
      [guildName, guildTag.toUpperCase()]
    );

    if (existingGuild) {
      throw new Error('Guild name or tag already exists');
    }

    // Get player level requirement (set to 1 for easier testing and new player experience)
    const player = await this.db.get('SELECT level FROM player_stats WHERE player_id = ?', [founderPlayerId]);
    const requiredLevel = options.minimumLevel || 1;
    
    if (!player || player.level < requiredLevel) {
      throw new Error(`Player must be level ${requiredLevel} or higher to create a guild`);
    }

    // Create guild
    const guild = new Guild({
      name: guildName,
      tag: guildTag.toUpperCase(),
      founderId: founderPlayerId,
      description: options.description || '',
      ...options
    });

    // Create default roles
    const defaultRoles = guild.createDefaultRoles();

    await this.db.run('BEGIN TRANSACTION');

    try {
      // Insert guild
      const guildData = guild.serialize();
      await this.db.run(
        `INSERT INTO guilds 
         (id, name, tag, description, founder_id, founded_at, config, resources, stats, 
          territories, guild_halls, allies, enemies, neutral, active_perks, unlocked_perks, is_active, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guildData.id, guildData.name, guildData.tag, guildData.description,
          guildData.founder_id, guildData.founded_at, guildData.config, guildData.resources,
          guildData.stats, guildData.territories, guildData.guild_halls, guildData.allies,
          guildData.enemies, guildData.neutral, guildData.active_perks, guildData.unlocked_perks,
          guildData.is_active, guildData.updated_at
        ]
      );

      // Insert default roles
      for (const role of defaultRoles) {
        await this.db.run(
          `INSERT INTO guild_roles 
           (guild_id, role_id, role_name, priority, permissions, color, is_default, max_members) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            guild.id, role.id, role.name, role.priority,
            JSON.stringify(role.permissions), role.color, role.isDefault ? 1 : 0, role.maxMembers
          ]
        );
        guild.roles.set(role.id, role);
      }

      // Add founder as first member
      await guild.addMember(founderPlayerId, 'founder', this.db);

      await this.db.run('COMMIT');

      // Cache the guild
      this.guilds.set(guild.id, guild);
      this.guildMembers.set(founderPlayerId, guild.id);

      // Award achievement
      if (this.db.awardAchievement) {
        await this.db.awardAchievement(founderPlayerId, 'guild', 'founder', 'Founded a guild');
      }

      return guild;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get guild by ID
   */
  getGuild(guildId) {
    return this.guilds.get(guildId) || null;
  }

  /**
   * Get guild by player ID
   */
  getPlayerGuild(playerId) {
    const guildId = this.guildMembers.get(playerId);
    return guildId ? this.guilds.get(guildId) : null;
  }

  /**
   * Search for guilds
   */
  async searchGuilds(criteria = {}) {
    let sql = 'SELECT * FROM guilds WHERE is_active = 1';
    const params = [];

    if (criteria.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${criteria.name}%`);
    }

    if (criteria.tag) {
      sql += ' AND tag LIKE ?';
      params.push(`%${criteria.tag.toUpperCase()}%`);
    }

    if (criteria.guildType) {
      sql += ' AND JSON_EXTRACT(config, "$.guildType") = ?';
      params.push(criteria.guildType);
    }

    if (criteria.recruitmentOpen !== undefined) {
      sql += ' AND JSON_EXTRACT(config, "$.recruitmentOpen") = ?';
      params.push(criteria.recruitmentOpen ? 1 : 0);
    }

    if (criteria.minLevel) {
      sql += ' AND JSON_EXTRACT(stats, "$.guildLevel") >= ?';
      params.push(criteria.minLevel);
    }

    if (criteria.maxLevel) {
      sql += ' AND JSON_EXTRACT(stats, "$.guildLevel") <= ?';
      params.push(criteria.maxLevel);
    }

    sql += ' ORDER BY JSON_EXTRACT(stats, "$.guildLevel") DESC, name ASC';

    if (criteria.limit) {
      sql += ' LIMIT ?';
      params.push(criteria.limit);
    }

    const results = await this.db.all(sql, params);
    return results.map(data => {
      const guild = Guild.fromDatabase(data);
      return guild.getSummary();
    });
  }

  /**
   * Apply to join a guild
   */
  async applyToGuild(playerId, guildId, message = '') {
    if (this.guildMembers.has(playerId)) {
      throw new Error('Player is already a member of a guild');
    }

    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    if (!guild.config.recruitmentOpen) {
      throw new Error('Guild is not accepting new members');
    }

    if (guild.stats.totalMembers >= guild.config.maxMembers) {
      throw new Error('Guild is at maximum capacity');
    }

    // Check minimum level requirement
    const player = await this.db.get('SELECT level FROM player_stats WHERE player_id = ?', [playerId]);
    if (!player || player.level < guild.config.minimumLevel) {
      throw new Error(`Player must be level ${guild.config.minimumLevel} or higher`);
    }

    // Check if application already exists
    const existing = await this.db.get(
      'SELECT id FROM guild_applications WHERE player_id = ? AND guild_id = ? AND status = ?',
      [playerId, guildId, 'pending']
    );

    if (existing) {
      throw new Error('Application already pending');
    }

    const applicationId = uuidv4();

    // If guild doesn't require applications, auto-accept
    if (!guild.config.requiresApplication) {
      await guild.addMember(playerId, null, this.db);
      this.guildMembers.set(playerId, guildId);
      return { status: 'accepted', applicationId };
    }

    // Create application
    await this.db.run(
      `INSERT INTO guild_applications 
       (id, player_id, guild_id, message, status, applied_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [applicationId, playerId, guildId, message, 'pending', Date.now()]
    );

    return { status: 'pending', applicationId };
  }

  /**
   * Process guild application (accept/reject)
   */
  async processApplication(applicationId, decision, processedBy) {
    const application = await this.db.get(
      'SELECT * FROM guild_applications WHERE id = ? AND status = ?',
      [applicationId, 'pending']
    );

    if (!application) {
      throw new Error('Application not found or already processed');
    }

    const guild = this.guilds.get(application.guild_id);
    if (!guild) {
      throw new Error('Guild not found');
    }

    // Check if processor has permission
    if (!guild.hasPermission(processedBy, 'members.invite')) {
      throw new Error('Insufficient permissions to process applications');
    }

    await this.db.run('BEGIN TRANSACTION');

    try {
      // Update application status
      await this.db.run(
        'UPDATE guild_applications SET status = ?, processed_by = ?, processed_at = ? WHERE id = ?',
        [decision, processedBy, Date.now(), applicationId]
      );

      if (decision === 'accepted') {
        // Add member to guild
        await guild.addMember(application.player_id, null, this.db);
        this.guildMembers.set(application.player_id, guild.id);
      }

      await this.db.run('COMMIT');
      return { status: decision, guildId: guild.id };
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Leave guild
   */
  async leaveGuild(playerId) {
    const guildId = this.guildMembers.get(playerId);
    if (!guildId) {
      throw new Error('Player is not in a guild');
    }

    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    const member = guild.members.get(playerId);
    if (!member) {
      throw new Error('Member not found');
    }

    // Founder cannot leave, must transfer leadership or disband
    if (member.roleId === 'founder') {
      throw new Error('Guild founder cannot leave. Transfer leadership or disband the guild.');
    }

    await guild.removeMember(playerId, this.db);
    this.guildMembers.delete(playerId);

    return { success: true, formerGuild: guild.name };
  }

  /**
   * Kick member from guild
   */
  async kickMember(kickerId, targetPlayerId, reason = '') {
    const guild = this.getPlayerGuild(kickerId);
    if (!guild) {
      throw new Error('Kicker is not in a guild');
    }

    if (!guild.hasPermission(kickerId, 'members.kick')) {
      throw new Error('Insufficient permissions to kick members');
    }

    if (!guild.members.has(targetPlayerId)) {
      throw new Error('Target player is not a member');
    }

    const kickerMember = guild.members.get(kickerId);
    const targetMember = guild.members.get(targetPlayerId);

    // Check role hierarchy
    const kickerRole = guild.roles.get(kickerMember.roleId);
    const targetRole = guild.roles.get(targetMember.roleId);

    if (kickerRole.priority >= targetRole.priority && kickerId !== guild.founderId) {
      throw new Error('Cannot kick members of equal or higher rank');
    }

    // Cannot kick founder
    if (targetMember.roleId === 'founder') {
      throw new Error('Cannot kick guild founder');
    }

    await guild.removeMember(targetPlayerId, this.db);
    this.guildMembers.delete(targetPlayerId);

    // Log the kick event
    await this.db.run(
      `INSERT INTO guild_events 
       (id, guild_id, event_type, player_id, target_player_id, data, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), guild.id, 'member_kicked', kickerId, targetPlayerId, JSON.stringify({ reason }), Date.now()]
    );

    return { success: true, kickedPlayer: targetPlayerId };
  }

  /**
   * Promote/demote guild member
   */
  async changeMemberRole(changerId, targetPlayerId, newRoleId) {
    const guild = this.getPlayerGuild(changerId);
    if (!guild) {
      throw new Error('Changer is not in a guild');
    }

    if (!guild.hasPermission(changerId, 'members.promote') && !guild.hasPermission(changerId, 'members.demote')) {
      throw new Error('Insufficient permissions to change member roles');
    }

    if (!guild.members.has(targetPlayerId)) {
      throw new Error('Target player is not a member');
    }

    const changerMember = guild.members.get(changerId);
    const targetMember = guild.members.get(targetPlayerId);
    const newRole = guild.roles.get(newRoleId);

    if (!newRole) {
      throw new Error('Invalid role');
    }

    // Check role hierarchy permissions
    const changerRole = guild.roles.get(changerMember.roleId);
    const targetRole = guild.roles.get(targetMember.roleId);

    if (changerRole.priority >= targetRole.priority && changerId !== guild.founderId) {
      throw new Error('Cannot change roles of equal or higher rank members');
    }

    if (changerRole.priority >= newRole.priority && changerId !== guild.founderId) {
      throw new Error('Cannot promote to equal or higher rank than yourself');
    }

    // Special handling for founder role
    if (newRoleId === 'founder') {
      if (changerId !== guild.founderId) {
        throw new Error('Only founder can transfer founder role');
      }
      // Transfer founder status
      await this.transferFoundership(guild.id, changerId, targetPlayerId);
    } else {
      const result = await guild.changeMemberRole(targetPlayerId, newRoleId, this.db);

      // Log the role change
      await this.db.run(
        `INSERT INTO guild_events 
         (id, guild_id, event_type, player_id, target_player_id, data, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), guild.id, 'role_changed', changerId, targetPlayerId, JSON.stringify(result), Date.now()]
      );
    }

    return { success: true, newRole: newRoleId };
  }

  /**
   * Transfer guild leadership (founder role)
   */
  async transferFoundership(guildId, currentFounderId, newFounderId) {
    const guild = this.guilds.get(guildId);
    if (!guild || guild.founderId !== currentFounderId) {
      throw new Error('Only the current founder can transfer leadership');
    }

    if (!guild.members.has(newFounderId)) {
      throw new Error('Target player is not a guild member');
    }

    await this.db.run('BEGIN TRANSACTION');

    try {
      // Change the new founder's role
      await guild.changeMemberRole(newFounderId, 'founder', this.db);
      
      // Change the old founder to leader role
      await guild.changeMemberRole(currentFounderId, 'leader', this.db);

      // Update guild founder ID
      guild.founderId = newFounderId;
      await this.db.run(
        'UPDATE guilds SET founder_id = ?, updated_at = ? WHERE id = ?',
        [newFounderId, Date.now(), guildId]
      );

      // Log the transfer
      await this.db.run(
        `INSERT INTO guild_events 
         (id, guild_id, event_type, player_id, target_player_id, data, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), guildId, 'leadership_transferred', currentFounderId, newFounderId, JSON.stringify({}), Date.now()]
      );

      await this.db.run('COMMIT');
      return { success: true, newFounder: newFounderId };
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Disband guild
   */
  async disbandGuild(playerId, confirmationCode) {
    const guild = this.getPlayerGuild(playerId);
    if (!guild) {
      throw new Error('Player is not in a guild');
    }

    if (guild.founderId !== playerId) {
      throw new Error('Only the founder can disband the guild');
    }

    if (confirmationCode !== `DISBAND_${guild.tag}`) {
      throw new Error('Invalid confirmation code');
    }

    await this.db.run('BEGIN TRANSACTION');

    try {
      // Remove all members from cache
      for (const memberId of guild.members.keys()) {
        this.guildMembers.delete(memberId);
      }

      // Mark guild as inactive instead of deleting
      guild.isActive = false;
      await this.db.run(
        'UPDATE guilds SET is_active = 0, disbanded_at = ?, updated_at = ? WHERE id = ?',
        [Date.now(), Date.now(), guild.id]
      );

      // Log disbanding
      await this.db.run(
        `INSERT INTO guild_events 
         (id, guild_id, event_type, player_id, data, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), guild.id, 'guild_disbanded', playerId, JSON.stringify({}), Date.now()]
      );

      await this.db.run('COMMIT');

      // Remove from cache
      this.guilds.delete(guild.id);

      return { success: true, disbandedGuild: guild.name };
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Contribute resources to guild
   */
  async contributeResources(playerId, resourceType, amount) {
    const guild = this.getPlayerGuild(playerId);
    if (!guild) {
      throw new Error('Player is not in a guild');
    }

    if (!guild.hasPermission(playerId, 'resources.deposit')) {
      throw new Error('Insufficient permissions to deposit resources');
    }

    await guild.depositResources(resourceType, amount, playerId, this.db);

    // Award guild experience for contributions
    const expAmount = Math.floor(typeof amount === 'number' ? amount * 0.1 : 50);
    const result = guild.awardExperience(expAmount, 'resource_contribution');

    if (result.levelUp) {
      // Notify guild members of level up
      await this.db.run(
        `INSERT INTO guild_events 
         (id, guild_id, event_type, data, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), guild.id, 'guild_level_up', JSON.stringify({ newLevel: result.newLevel }), Date.now()]
      );
    }

    await this.saveGuild(guild);
    return { success: true, resources: guild.resources, levelUp: result.levelUp };
  }

  /**
   * Set diplomatic relations between guilds
   */
  async setGuildRelation(initiatorPlayerId, targetGuildId, relationType) {
    const initiatorGuild = this.getPlayerGuild(initiatorPlayerId);
    if (!initiatorGuild) {
      throw new Error('Player is not in a guild');
    }

    if (!initiatorGuild.hasPermission(initiatorPlayerId, 'diplomacy.manage')) {
      throw new Error('Insufficient permissions to manage diplomacy');
    }

    const targetGuild = this.guilds.get(targetGuildId);
    if (!targetGuild) {
      throw new Error('Target guild not found');
    }

    if (initiatorGuild.id === targetGuildId) {
      throw new Error('Cannot set diplomatic relations with own guild');
    }

    // Set relation for both guilds
    await initiatorGuild.setDiplomaticRelation(targetGuildId, relationType, this.db);
    await targetGuild.setDiplomaticRelation(initiatorGuild.id, relationType, this.db);

    await this.saveGuild(initiatorGuild);
    await this.saveGuild(targetGuild);

    return { success: true, relation: relationType };
  }

  /**
   * Get guild member bonuses (integration with skill system)
   */
  async getMemberBonuses(playerId) {
    const guild = this.getPlayerGuild(playerId);
    if (!guild) {
      return {};
    }

    const bonuses = guild.calculateMemberBonuses();

    // Additional bonuses based on member contribution and role
    const member = guild.members.get(playerId);
    if (member) {
      const role = guild.roles.get(member.roleId);
      if (role) {
        // Add role-specific bonuses
        if (role.id === 'leader' || role.id === 'founder') {
          bonuses.leadership_bonus = 0.05; // 5% leadership bonus
        }
      }

      // Add contribution-based bonuses
      const contributionBonus = Math.min(member.contributionPoints / 10000, 0.1); // Up to 10% bonus
      bonuses.contribution_bonus = contributionBonus;
    }

    return bonuses;
  }

  /**
   * Get guild leaderboard
   */
  async getGuildLeaderboard(category = 'level', limit = 10) {
    let orderBy = 'JSON_EXTRACT(stats, "$.guildLevel") DESC';
    
    switch (category) {
      case 'members':
        orderBy = 'JSON_EXTRACT(stats, "$.totalMembers") DESC';
        break;
      case 'resources':
        orderBy = 'JSON_EXTRACT(resources, "$.credits") DESC';
        break;
      case 'territories':
        orderBy = 'JSON_LENGTH(territories) DESC';
        break;
      case 'experience':
        orderBy = 'JSON_EXTRACT(stats, "$.experiencePoints") DESC';
        break;
    }

    const guilds = await this.db.all(
      `SELECT * FROM guilds WHERE is_active = 1 ORDER BY ${orderBy} LIMIT ?`,
      [limit]
    );

    return guilds.map((data, index) => {
      const guild = Guild.fromDatabase(data);
      return {
        rank: index + 1,
        ...guild.getSummary()
      };
    });
  }

  /**
   * Save guild to database
   */
  async saveGuild(guild) {
    const data = guild.serialize();
    await this.db.run(
      `UPDATE guilds SET 
       name = ?, tag = ?, description = ?, config = ?, resources = ?, stats = ?,
       territories = ?, guild_halls = ?, allies = ?, enemies = ?, neutral = ?,
       active_perks = ?, unlocked_perks = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.name, data.tag, data.description, data.config, data.resources, data.stats,
        data.territories, data.guild_halls, data.allies, data.enemies, data.neutral,
        data.active_perks, data.unlocked_perks, data.updated_at, guild.id
      ]
    );
  }

  /**
   * Get guild events/activity log
   */
  async getGuildEvents(guildId, limit = 50) {
    return await this.db.all(
      `SELECT ge.*, p1.username as player_name, p2.username as target_player_name
       FROM guild_events ge
       LEFT JOIN players p1 ON ge.player_id = p1.id
       LEFT JOIN players p2 ON ge.target_player_id = p2.id
       WHERE ge.guild_id = ?
       ORDER BY ge.timestamp DESC LIMIT ?`,
      [guildId, limit]
    );
  }

  /**
   * Get guild statistics
   */
  async getGuildStats() {
    const totalGuilds = await this.db.get('SELECT COUNT(*) as count FROM guilds WHERE is_active = 1');
    const totalMembers = await this.db.get('SELECT COUNT(*) as count FROM guild_members');
    const avgGuildSize = await this.db.get(
      'SELECT AVG(JSON_EXTRACT(stats, "$.totalMembers")) as avg FROM guilds WHERE is_active = 1'
    );

    const guildsByType = await this.db.all(
      `SELECT JSON_EXTRACT(config, '$.guildType') as type, COUNT(*) as count 
       FROM guilds WHERE is_active = 1 
       GROUP BY JSON_EXTRACT(config, '$.guildType')`
    );

    return {
      totalGuilds: totalGuilds.count,
      totalMembers: totalMembers.count,
      averageGuildSize: Math.round(avgGuildSize.avg || 0),
      guildsByType
    };
  }

  /**
   * Process periodic guild updates (should be called regularly)
   */
  async processPeriodicUpdates() {
    for (const guild of this.guilds.values()) {
      // Update member activity status
      for (const [playerId, member] of guild.members.entries()) {
        const player = await this.db.get(
          'SELECT last_login FROM players WHERE id = ?', 
          [playerId]
        );
        
        if (player) {
          const lastLogin = new Date(player.last_login).getTime();
          const daysSinceLogin = (Date.now() - lastLogin) / (24 * 60 * 60 * 1000);
          
          // Mark as inactive if not logged in for 7 days
          if (daysSinceLogin > 7) {
            if (member.lastActive > lastLogin) {
              member.lastActive = lastLogin;
              guild.stats.activeMembers = Math.max(0, guild.stats.activeMembers - 1);
            }
          }
        }
      }

      // Save updated guild data
      await this.saveGuild(guild);
    }
  }
}

module.exports = GuildSystem;