/**
 * Guild System Core Class for StarForgeFrontier
 * Manages guild structure, hierarchy, roles, and operations
 */

const { v4: uuidv4 } = require('uuid');

class Guild {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.tag = data.tag; // 3-5 character guild tag
    this.description = data.description || '';
    this.founderId = data.founderId;
    this.foundedAt = data.foundedAt || Date.now();
    
    // Guild configuration
    this.config = {
      maxMembers: data.maxMembers || 50,
      recruitmentOpen: data.recruitmentOpen !== undefined ? data.recruitmentOpen : true,
      requiresApplication: data.requiresApplication !== undefined ? data.requiresApplication : false,
      minimumLevel: data.minimumLevel || 1,
      timezone: data.timezone || 'UTC',
      primaryLanguage: data.primaryLanguage || 'EN',
      guildType: data.guildType || 'MIXED', // COMBAT, TRADING, EXPLORATION, MIXED
      ...data.config
    };

    // Guild resources and assets
    this.resources = {
      credits: data.credits || 0,
      ores: data.ores || {},
      reputation: data.reputation || 0,
      influence: data.influence || 0,
      researchPoints: data.researchPoints || 0,
      ...data.resources
    };

    // Guild statistics
    this.stats = {
      totalMembers: data.totalMembers || 0,
      activeMembers: data.activeMembers || 0,
      totalResourcesEarned: data.totalResourcesEarned || 0,
      totalTradesCompleted: data.totalTradesCompleted || 0,
      totalCombatVictories: data.totalCombatVictories || 0,
      totalSectorsExplored: data.totalSectorsExplored || 0,
      guildLevel: data.guildLevel || 1,
      experiencePoints: data.experiencePoints || 0,
      ...data.stats
    };

    // Guild territories and holdings
    this.territories = data.territories || [];
    this.guildHalls = data.guildHalls || [];
    
    // Diplomatic relations
    this.allies = data.allies || [];
    this.enemies = data.enemies || [];
    this.neutral = data.neutral || [];

    // Guild perks and bonuses
    this.activePerks = data.activePerks || [];
    this.unlockedPerks = data.unlockedPerks || [];

    // Internal tracking
    this.members = new Map(); // Will be populated from database
    this.roles = new Map(); // Will be populated from database
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.updatedAt = Date.now();
  }

  /**
   * Initialize default guild roles
   */
  createDefaultRoles() {
    const defaultRoles = [
      {
        id: 'founder',
        name: 'Founder',
        priority: 0, // Highest priority
        permissions: [
          'guild.disband', 'guild.edit', 'guild.manage_roles',
          'members.invite', 'members.kick', 'members.promote', 'members.demote',
          'resources.manage', 'resources.withdraw', 'resources.deposit',
          'diplomacy.manage', 'territories.manage', 'halls.manage',
          'research.manage', 'perks.manage', 'wars.declare', 'wars.end'
        ],
        color: '#FFD700',
        isDefault: false,
        maxMembers: 1
      },
      {
        id: 'leader',
        name: 'Guild Leader',
        priority: 1,
        permissions: [
          'guild.edit', 'members.invite', 'members.kick', 'members.promote',
          'resources.manage', 'resources.withdraw', 'diplomacy.manage',
          'territories.manage', 'halls.manage', 'research.manage'
        ],
        color: '#FF6B35',
        isDefault: false,
        maxMembers: 3
      },
      {
        id: 'officer',
        name: 'Officer',
        priority: 2,
        permissions: [
          'members.invite', 'members.kick_junior', 'resources.withdraw_limited',
          'diplomacy.suggest', 'halls.use_advanced'
        ],
        color: '#4ECDC4',
        isDefault: false,
        maxMembers: 10
      },
      {
        id: 'veteran',
        name: 'Veteran',
        priority: 3,
        permissions: [
          'members.invite', 'resources.deposit', 'halls.use',
          'research.contribute', 'wars.participate'
        ],
        color: '#45B7D1',
        isDefault: false,
        maxMembers: -1 // Unlimited
      },
      {
        id: 'member',
        name: 'Member',
        priority: 4,
        permissions: [
          'resources.deposit', 'halls.use_basic', 'research.contribute', 'wars.participate'
        ],
        color: '#96CEB4',
        isDefault: true, // Default role for new members
        maxMembers: -1
      },
      {
        id: 'recruit',
        name: 'Recruit',
        priority: 5, // Lowest priority
        permissions: ['halls.use_basic', 'research.contribute'],
        color: '#FFEAA7',
        isDefault: false,
        maxMembers: -1
      }
    ];

    return defaultRoles;
  }

  /**
   * Add a member to the guild
   */
  async addMember(playerId, roleId = null, database = null) {
    if (this.members.has(playerId)) {
      throw new Error('Player is already a member');
    }

    if (this.stats.totalMembers >= this.config.maxMembers) {
      throw new Error('Guild is at maximum capacity');
    }

    const defaultRole = roleId || Array.from(this.roles.values()).find(role => role.isDefault)?.id || 'member';
    
    const member = {
      playerId,
      guildId: this.id,
      roleId: defaultRole,
      joinedAt: Date.now(),
      contributionPoints: 0,
      lastActive: Date.now(),
      permissions: this.roles.get(defaultRole)?.permissions || []
    };

    this.members.set(playerId, member);
    this.stats.totalMembers++;
    this.stats.activeMembers++;
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        `INSERT INTO guild_members 
         (player_id, guild_id, role_id, joined_at, contribution_points) 
         VALUES (?, ?, ?, ?, ?)`,
        [playerId, this.id, defaultRole, member.joinedAt, 0]
      );
    }

    return member;
  }

  /**
   * Remove a member from the guild
   */
  async removeMember(playerId, database = null) {
    if (!this.members.has(playerId)) {
      throw new Error('Player is not a member');
    }

    // Prevent founder from being removed
    const member = this.members.get(playerId);
    if (member.roleId === 'founder') {
      throw new Error('Founder cannot be removed from guild');
    }

    this.members.delete(playerId);
    this.stats.totalMembers--;
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run('DELETE FROM guild_members WHERE player_id = ? AND guild_id = ?', [playerId, this.id]);
    }

    return true;
  }

  /**
   * Promote or demote a member
   */
  async changeMemberRole(playerId, newRoleId, database = null) {
    if (!this.members.has(playerId)) {
      throw new Error('Player is not a member');
    }

    if (!this.roles.has(newRoleId)) {
      throw new Error('Invalid role');
    }

    const member = this.members.get(playerId);
    const oldRoleId = member.roleId;
    const newRole = this.roles.get(newRoleId);

    // Check role capacity limits
    if (newRole.maxMembers > 0) {
      const currentCount = Array.from(this.members.values()).filter(m => m.roleId === newRoleId).length;
      if (currentCount >= newRole.maxMembers) {
        throw new Error(`Role ${newRole.name} is at maximum capacity`);
      }
    }

    member.roleId = newRoleId;
    member.permissions = newRole.permissions;
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_members SET role_id = ? WHERE player_id = ? AND guild_id = ?',
        [newRoleId, playerId, this.id]
      );
    }

    return { oldRole: oldRoleId, newRole: newRoleId };
  }

  /**
   * Check if a member has a specific permission
   */
  hasPermission(playerId, permission) {
    const member = this.members.get(playerId);
    if (!member) return false;

    return member.permissions.includes(permission);
  }

  /**
   * Add resources to guild treasury
   */
  async depositResources(resourceType, amount, playerId, database = null) {
    if (resourceType === 'credits') {
      this.resources.credits += amount;
    } else if (resourceType === 'ores') {
      if (!this.resources.ores[amount.oreType]) {
        this.resources.ores[amount.oreType] = 0;
      }
      this.resources.ores[amount.oreType] += amount.quantity;
    } else {
      if (!this.resources[resourceType]) {
        this.resources[resourceType] = 0;
      }
      this.resources[resourceType] += amount;
    }

    // Award contribution points to member
    if (playerId && this.members.has(playerId)) {
      const member = this.members.get(playerId);
      member.contributionPoints += Math.floor(amount * 0.1); // 10% of amount as contribution
    }

    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        `INSERT INTO guild_resource_transactions 
         (id, guild_id, player_id, transaction_type, resource_type, amount, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), this.id, playerId, 'deposit', resourceType, JSON.stringify(amount), Date.now()]
      );
    }

    return this.resources;
  }

  /**
   * Withdraw resources from guild treasury
   */
  async withdrawResources(resourceType, amount, playerId, database = null) {
    if (resourceType === 'credits') {
      if (this.resources.credits < amount) {
        throw new Error('Insufficient guild credits');
      }
      this.resources.credits -= amount;
    } else if (resourceType === 'ores') {
      if (!this.resources.ores[amount.oreType] || this.resources.ores[amount.oreType] < amount.quantity) {
        throw new Error(`Insufficient guild ${amount.oreType} ore`);
      }
      this.resources.ores[amount.oreType] -= amount.quantity;
    } else {
      if (!this.resources[resourceType] || this.resources[resourceType] < amount) {
        throw new Error(`Insufficient guild ${resourceType}`);
      }
      this.resources[resourceType] -= amount;
    }

    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        `INSERT INTO guild_resource_transactions 
         (id, guild_id, player_id, transaction_type, resource_type, amount, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), this.id, playerId, 'withdraw', resourceType, JSON.stringify(amount), Date.now()]
      );
    }

    return this.resources;
  }

  /**
   * Calculate guild bonuses for members
   */
  calculateMemberBonuses() {
    const bonuses = {
      experience_gain: 0,
      resource_gain: 0,
      trading_bonus: 0,
      combat_bonus: 0,
      exploration_bonus: 0
    };

    // Base bonuses from guild level
    const levelBonus = Math.floor(this.stats.guildLevel / 5) * 0.01; // 1% per 5 levels
    bonuses.experience_gain += levelBonus;

    // Active perk bonuses
    for (const perkId of this.activePerks) {
      const perk = this.getGuildPerk(perkId);
      if (perk && perk.effects) {
        for (const [effect, value] of Object.entries(perk.effects)) {
          if (bonuses[effect] !== undefined) {
            bonuses[effect] += value;
          }
        }
      }
    }

    // Territory bonuses
    bonuses.resource_gain += this.territories.length * 0.02; // 2% per territory

    return bonuses;
  }

  /**
   * Get available guild perks
   */
  getAvailablePerks() {
    const allPerks = {
      resource_bonus: {
        id: 'resource_bonus',
        name: 'Resource Efficiency',
        description: 'Increases resource collection by 10% for all members',
        cost: 1000,
        requiredLevel: 5,
        effects: { resource_gain: 0.1 }
      },
      experience_boost: {
        id: 'experience_boost',
        name: 'Experience Boost',
        description: 'Increases experience gain by 15% for all members',
        cost: 1500,
        requiredLevel: 8,
        effects: { experience_gain: 0.15 }
      },
      trading_network: {
        id: 'trading_network',
        name: 'Trading Network',
        description: 'Reduces trading costs and increases profits by 8%',
        cost: 2000,
        requiredLevel: 12,
        effects: { trading_bonus: 0.08 }
      },
      combat_coordination: {
        id: 'combat_coordination',
        name: 'Combat Coordination',
        description: 'Increases combat effectiveness by 12% when fighting together',
        cost: 2500,
        requiredLevel: 15,
        effects: { combat_bonus: 0.12 }
      },
      deep_space_access: {
        id: 'deep_space_access',
        name: 'Deep Space Access',
        description: 'Unlocks access to dangerous high-reward sectors',
        cost: 3000,
        requiredLevel: 20,
        effects: { exploration_bonus: 0.2 }
      }
    };

    return Object.values(allPerks).filter(perk => 
      this.stats.guildLevel >= perk.requiredLevel && 
      !this.activePerks.includes(perk.id)
    );
  }

  /**
   * Get guild perk by ID
   */
  getGuildPerk(perkId) {
    const allPerks = this.getAvailablePerks();
    return allPerks.find(perk => perk.id === perkId);
  }

  /**
   * Activate a guild perk
   */
  async activatePerk(perkId, database = null) {
    const perk = this.getGuildPerk(perkId);
    if (!perk) {
      throw new Error('Invalid or unavailable perk');
    }

    if (this.resources.credits < perk.cost) {
      throw new Error('Insufficient guild credits');
    }

    if (this.activePerks.includes(perkId)) {
      throw new Error('Perk already active');
    }

    this.resources.credits -= perk.cost;
    this.activePerks.push(perkId);
    this.unlockedPerks.push(perkId);
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        `INSERT INTO guild_perks 
         (guild_id, perk_id, activated_at, cost_paid) 
         VALUES (?, ?, ?, ?)`,
        [this.id, perkId, Date.now(), perk.cost]
      );
    }

    return perk;
  }

  /**
   * Set diplomatic relations with another guild
   */
  async setDiplomaticRelation(otherGuildId, relationType, database = null) {
    // Remove from all relation arrays first
    this.allies = this.allies.filter(id => id !== otherGuildId);
    this.enemies = this.enemies.filter(id => id !== otherGuildId);
    this.neutral = this.neutral.filter(id => id !== otherGuildId);

    // Add to appropriate array
    switch (relationType) {
      case 'ALLY':
        this.allies.push(otherGuildId);
        break;
      case 'ENEMY':
        this.enemies.push(otherGuildId);
        break;
      case 'NEUTRAL':
        this.neutral.push(otherGuildId);
        break;
      default:
        throw new Error('Invalid relation type');
    }

    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        `INSERT OR REPLACE INTO guild_relations 
         (guild_id, target_guild_id, relation_type, established_at) 
         VALUES (?, ?, ?, ?)`,
        [this.id, otherGuildId, relationType, Date.now()]
      );
    }

    return relationType;
  }

  /**
   * Get diplomatic relation with another guild
   */
  getDiplomaticRelation(otherGuildId) {
    if (this.allies.includes(otherGuildId)) return 'ALLY';
    if (this.enemies.includes(otherGuildId)) return 'ENEMY';
    if (this.neutral.includes(otherGuildId)) return 'NEUTRAL';
    return 'UNKNOWN';
  }

  /**
   * Award experience points to the guild
   */
  awardExperience(amount, source = 'unknown') {
    this.stats.experiencePoints += amount;
    
    // Check for level up
    const requiredExp = this.getRequiredExperienceForLevel(this.stats.guildLevel + 1);
    if (this.stats.experiencePoints >= requiredExp) {
      this.stats.guildLevel++;
      this.stats.experiencePoints -= requiredExp;
      
      // Unlock new perks or bonuses
      return { levelUp: true, newLevel: this.stats.guildLevel };
    }

    return { levelUp: false };
  }

  /**
   * Calculate required experience for a guild level
   */
  getRequiredExperienceForLevel(level) {
    // Exponential growth: level^2 * 1000
    return Math.pow(level, 2) * 1000;
  }

  /**
   * Get guild summary for display
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      tag: this.tag,
      description: this.description,
      memberCount: this.stats.totalMembers,
      maxMembers: this.config.maxMembers,
      guildLevel: this.stats.guildLevel,
      guildType: this.config.guildType,
      recruitmentOpen: this.config.recruitmentOpen,
      foundedAt: this.foundedAt,
      territories: this.territories.length,
      allies: this.allies.length,
      enemies: this.enemies.length
    };
  }

  /**
   * Get full guild data for management
   */
  getFullData() {
    return {
      id: this.id,
      name: this.name,
      tag: this.tag,
      description: this.description,
      founderId: this.founderId,
      foundedAt: this.foundedAt,
      config: this.config,
      resources: this.resources,
      stats: this.stats,
      territories: this.territories,
      guildHalls: this.guildHalls,
      allies: this.allies,
      enemies: this.enemies,
      neutral: this.neutral,
      activePerks: this.activePerks,
      unlockedPerks: this.unlockedPerks,
      isActive: this.isActive,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Serialize guild data for database storage
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      tag: this.tag,
      description: this.description,
      founder_id: this.founderId,
      founded_at: this.foundedAt,
      config: JSON.stringify(this.config),
      resources: JSON.stringify(this.resources),
      stats: JSON.stringify(this.stats),
      territories: JSON.stringify(this.territories),
      guild_halls: JSON.stringify(this.guildHalls),
      allies: JSON.stringify(this.allies),
      enemies: JSON.stringify(this.enemies),
      neutral: JSON.stringify(this.neutral),
      active_perks: JSON.stringify(this.activePerks),
      unlocked_perks: JSON.stringify(this.unlockedPerks),
      is_active: this.isActive,
      updated_at: this.updatedAt
    };
  }

  /**
   * Create guild from database data
   */
  static fromDatabase(data) {
    return new Guild({
      id: data.id,
      name: data.name,
      tag: data.tag,
      description: data.description,
      founderId: data.founder_id,
      foundedAt: data.founded_at,
      config: data.config ? JSON.parse(data.config) : {},
      resources: data.resources ? JSON.parse(data.resources) : {},
      stats: data.stats ? JSON.parse(data.stats) : {},
      territories: data.territories ? JSON.parse(data.territories) : [],
      guildHalls: data.guild_halls ? JSON.parse(data.guild_halls) : [],
      allies: data.allies ? JSON.parse(data.allies) : [],
      enemies: data.enemies ? JSON.parse(data.enemies) : [],
      neutral: data.neutral ? JSON.parse(data.neutral) : [],
      activePerks: data.active_perks ? JSON.parse(data.active_perks) : [],
      unlockedPerks: data.unlocked_perks ? JSON.parse(data.unlocked_perks) : [],
      isActive: data.is_active,
      updatedAt: data.updated_at
    });
  }
}

module.exports = Guild;