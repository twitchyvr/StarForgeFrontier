/**
 * Hazard System Frontend - Visual effects, warnings, and user interface
 * Handles all client-side hazard visualization and interaction
 */

class HazardVisualizer {
  constructor(canvas, audioContext) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioContext = audioContext;
    
    // Visual effects state
    this.activeHazards = new Map(); // hazardId -> visualization data
    this.particleSystems = new Map(); // hazardId -> particle system
    this.visualEffects = []; // Screen effects like fog, static, etc.
    this.warnings = []; // Active warnings
    this.audioQueue = []; // Queued audio effects
    
    // Screen effects canvas layers
    this.effectsCanvas = document.createElement('canvas');
    this.effectsCtx = this.effectsCanvas.getContext('2d');
    this.effectsCanvas.width = canvas.width;
    this.effectsCanvas.height = canvas.height;
    
    // Animation state
    this.animationTime = 0;
    this.lastUpdateTime = Date.now();
    
    // Hazard visualization definitions
    this.hazardVisuals = {
      ASTEROID_FIELD: {
        color: '#8B7355',
        shape: 'asteroids',
        particleCount: 50,
        animation: 'rotating',
        glowColor: 'rgba(139, 115, 85, 0.3)',
        soundLoop: 'asteroid_ambient'
      },
      
      SOLAR_FLARE: {
        color: '#FF4500',
        shape: 'energy_burst',
        particleCount: 100,
        animation: 'expanding_pulse',
        glowColor: 'rgba(255, 69, 0, 0.8)',
        soundLoop: 'solar_flare_ambient',
        screenEffect: 'electromagnetic_static'
      },
      
      NEBULA_INTERFERENCE: {
        color: '#FF6B9D',
        shape: 'gas_cloud',
        particleCount: 200,
        animation: 'swirling',
        glowColor: 'rgba(255, 107, 157, 0.4)',
        soundLoop: 'nebula_static',
        screenEffect: 'fog_overlay'
      },
      
      GRAVITATIONAL_ANOMALY: {
        color: '#2C003E',
        shape: 'gravity_well',
        particleCount: 80,
        animation: 'spiral_inward',
        glowColor: 'rgba(44, 0, 62, 0.9)',
        soundLoop: 'gravity_distortion',
        screenEffect: 'lens_distortion'
      },
      
      MAGNETIC_STORM: {
        color: '#9370DB',
        shape: 'field_lines',
        particleCount: 60,
        animation: 'electromagnetic_pulse',
        glowColor: 'rgba(147, 112, 219, 0.6)',
        soundLoop: 'magnetic_interference',
        screenEffect: 'compass_spin'
      },
      
      COSMIC_RADIATION: {
        color: '#00FF00',
        shape: 'particle_stream',
        particleCount: 120,
        animation: 'particle_flow',
        glowColor: 'rgba(0, 255, 0, 0.5)',
        soundLoop: 'geiger_counter',
        screenEffect: 'radiation_overlay'
      },
      
      TEMPORAL_ANOMALY: {
        color: '#00FFFF',
        shape: 'time_distortion',
        particleCount: 40,
        animation: 'time_ripple',
        glowColor: 'rgba(0, 255, 255, 0.7)',
        soundLoop: 'temporal_hum',
        screenEffect: 'time_distortion_effect'
      },
      
      WORMHOLE: {
        color: '#00CED1',
        shape: 'portal',
        particleCount: 150,
        animation: 'rotating_vortex',
        glowColor: 'rgba(0, 206, 209, 0.8)',
        soundLoop: 'wormhole_hum',
        screenEffect: 'portal_glow'
      }
    };
    
    this.initialize();
  }

  /**
   * Initialize the hazard visualization system
   */
  initialize() {
    // Create particle system pools for performance
    this.particlePool = [];
    for (let i = 0; i < 1000; i++) {
      this.particlePool.push(this.createParticle());
    }
    this.availableParticles = [...this.particlePool];
    
    // Initialize audio system
    this.initializeAudio();
    
    // Set up resize handling
    window.addEventListener('resize', () => {
      this.effectsCanvas.width = this.canvas.width;
      this.effectsCanvas.height = this.canvas.height;
    });
    
    console.log('Hazard visualization system initialized');
  }

  /**
   * Initialize audio system for hazard sounds
   */
  initializeAudio() {
    this.audioBuffers = new Map();
    this.activeAudioSources = new Map();
    
    // List of audio files to preload
    const audioFiles = [
      'asteroid_ambient', 'solar_flare_ambient', 'nebula_static',
      'gravity_distortion', 'magnetic_interference', 'geiger_counter',
      'temporal_hum', 'wormhole_hum', 'critical_alarm', 'high_warning',
      'medium_beep', 'low_tone', 'info_chime'
    ];
    
    // Note: In a real implementation, you would load actual audio files
    console.log('Audio system initialized for hazard sounds');
  }

  /**
   * Update hazard visualizations
   */
  update(deltaTime, cameraX, cameraY) {
    const now = Date.now();
    this.animationTime += deltaTime;
    this.lastUpdateTime = now;
    
    // Update particle systems
    this.updateParticleSystems(deltaTime);
    
    // Update screen effects
    this.updateScreenEffects(deltaTime);
    
    // Update warnings
    this.updateWarnings(deltaTime);
    
    // Process audio queue
    this.processAudioQueue();
    
    // Clean up expired effects
    this.cleanupExpiredEffects();
  }

  /**
   * Render all hazard visualizations
   */
  render(cameraX, cameraY) {
    // Render hazard objects
    this.renderHazardObjects(cameraX, cameraY);
    
    // Render particle systems
    this.renderParticleSystems(cameraX, cameraY);
    
    // Render screen effects
    this.renderScreenEffects();
    
    // Render warning UI
    this.renderWarningUI();
  }

  /**
   * Add a hazard to visualization
   */
  addHazard(hazardData) {
    const visual = this.hazardVisuals[hazardData.type];
    if (!visual) {
      console.warn(`No visual definition for hazard type: ${hazardData.type}`);
      return;
    }

    const hazardVis = {
      id: hazardData.id,
      type: hazardData.type,
      x: hazardData.x,
      y: hazardData.y,
      intensity: hazardData.magnitude || 1.0,
      visual: visual,
      createdAt: Date.now(),
      properties: hazardData.properties || {},
      isActive: true
    };

    this.activeHazards.set(hazardData.id, hazardVis);
    
    // Create particle system
    this.createParticleSystemForHazard(hazardVis);
    
    // Start ambient audio if specified
    if (visual.soundLoop) {
      this.playAmbientSound(hazardData.id, visual.soundLoop, hazardData.magnitude);
    }
    
    // Add screen effect if specified
    if (visual.screenEffect) {
      this.addScreenEffect(visual.screenEffect, hazardData.magnitude);
    }
    
    console.log(`Added hazard visualization: ${hazardData.type} at (${hazardData.x}, ${hazardData.y})`);
  }

  /**
   * Remove a hazard from visualization
   */
  removeHazard(hazardId) {
    const hazardVis = this.activeHazards.get(hazardId);
    if (!hazardVis) return;

    hazardVis.isActive = false;
    
    // Clean up particle system
    this.cleanupParticleSystem(hazardId);
    
    // Stop ambient audio
    this.stopAmbientSound(hazardId);
    
    // Remove from active hazards
    this.activeHazards.delete(hazardId);
    
    console.log(`Removed hazard visualization: ${hazardId}`);
  }

  /**
   * Update hazard properties (intensity, position, etc.)
   */
  updateHazard(hazardId, updateData) {
    const hazardVis = this.activeHazards.get(hazardId);
    if (!hazardVis) return;

    Object.assign(hazardVis, updateData);
    
    // Update particle system intensity
    const particleSystem = this.particleSystems.get(hazardId);
    if (particleSystem) {
      particleSystem.intensity = hazardVis.intensity;
    }
    
    // Update ambient audio volume
    if (hazardVis.visual.soundLoop && updateData.intensity !== undefined) {
      this.updateAmbientSoundVolume(hazardId, updateData.intensity);
    }
  }

  /**
   * Create particle system for a hazard
   */
  createParticleSystemForHazard(hazardVis) {
    const visual = hazardVis.visual;
    const particleSystem = {
      hazardId: hazardVis.id,
      type: visual.shape,
      x: hazardVis.x,
      y: hazardVis.y,
      intensity: hazardVis.intensity,
      color: visual.color,
      glowColor: visual.glowColor,
      animation: visual.animation,
      particleCount: Math.floor(visual.particleCount * hazardVis.intensity),
      particles: [],
      createdAt: Date.now(),
      isActive: true
    };

    // Create particles based on hazard type
    this.initializeParticlesForType(particleSystem, hazardVis);
    
    this.particleSystems.set(hazardVis.id, particleSystem);
  }

  /**
   * Initialize particles for specific hazard types
   */
  initializeParticlesForType(particleSystem, hazardVis) {
    const count = particleSystem.particleCount;
    
    for (let i = 0; i < count; i++) {
      if (this.availableParticles.length === 0) break;
      
      const particle = this.availableParticles.pop();
      this.resetParticleForHazardType(particle, particleSystem, hazardVis);
      particleSystem.particles.push(particle);
    }
  }

  /**
   * Reset particle properties for specific hazard type
   */
  resetParticleForHazardType(particle, particleSystem, hazardVis) {
    const baseX = particleSystem.x;
    const baseY = particleSystem.y;
    
    switch (hazardVis.type) {
      case 'ASTEROID_FIELD':
        particle.x = baseX + (Math.random() - 0.5) * 300;
        particle.y = baseY + (Math.random() - 0.5) * 300;
        particle.vx = (Math.random() - 0.5) * 20;
        particle.vy = (Math.random() - 0.5) * 20;
        particle.size = 2 + Math.random() * 8;
        particle.rotation = Math.random() * Math.PI * 2;
        particle.rotationSpeed = (Math.random() - 0.5) * 0.1;
        particle.shape = 'asteroid';
        break;
        
      case 'SOLAR_FLARE':
        const flareAngle = Math.random() * Math.PI * 2;
        const flareDistance = Math.random() * 250;
        particle.x = baseX + Math.cos(flareAngle) * flareDistance;
        particle.y = baseY + Math.sin(flareAngle) * flareDistance;
        particle.vx = Math.cos(flareAngle) * (50 + Math.random() * 100);
        particle.vy = Math.sin(flareAngle) * (50 + Math.random() * 100);
        particle.size = 1 + Math.random() * 4;
        particle.life = 1.0;
        particle.decay = 0.98;
        particle.shape = 'energy_particle';
        break;
        
      case 'NEBULA_INTERFERENCE':
        particle.x = baseX + (Math.random() - 0.5) * 400;
        particle.y = baseY + (Math.random() - 0.5) * 400;
        particle.vx = (Math.random() - 0.5) * 30;
        particle.vy = (Math.random() - 0.5) * 30;
        particle.size = 10 + Math.random() * 30;
        particle.life = 0.3 + Math.random() * 0.7;
        particle.shape = 'gas_wisp';
        break;
        
      case 'GRAVITATIONAL_ANOMALY':
        const gravAngle = Math.random() * Math.PI * 2;
        const gravDistance = 100 + Math.random() * 200;
        particle.x = baseX + Math.cos(gravAngle) * gravDistance;
        particle.y = baseY + Math.sin(gravAngle) * gravDistance;
        particle.orbitAngle = gravAngle;
        particle.orbitRadius = gravDistance;
        particle.orbitSpeed = 0.02 + Math.random() * 0.03;
        particle.size = 1 + Math.random() * 3;
        particle.shape = 'gravity_particle';
        break;
        
      case 'MAGNETIC_STORM':
        particle.x = baseX + (Math.random() - 0.5) * 350;
        particle.y = baseY + (Math.random() - 0.5) * 350;
        particle.fieldX = particle.x;
        particle.fieldY = particle.y;
        particle.amplitude = 20 + Math.random() * 40;
        particle.frequency = 0.05 + Math.random() * 0.1;
        particle.size = 1 + Math.random() * 2;
        particle.shape = 'field_line';
        break;
        
      case 'COSMIC_RADIATION':
        particle.x = baseX + (Math.random() - 0.5) * 600;
        particle.y = baseY + (Math.random() - 0.5) * 600;
        particle.vx = (Math.random() - 0.5) * 200;
        particle.vy = (Math.random() - 0.5) * 200;
        particle.size = 0.5 + Math.random() * 1.5;
        particle.life = 0.5 + Math.random() * 0.5;
        particle.decay = 0.995;
        particle.shape = 'radiation_particle';
        break;
        
      case 'TEMPORAL_ANOMALY':
        particle.x = baseX + (Math.random() - 0.5) * 200;
        particle.y = baseY + (Math.random() - 0.5) * 200;
        particle.originalX = particle.x;
        particle.originalY = particle.y;
        particle.timeOffset = Math.random() * Math.PI * 2;
        particle.rippleAmplitude = 10 + Math.random() * 20;
        particle.size = 2 + Math.random() * 4;
        particle.shape = 'time_particle';
        break;
        
      case 'WORMHOLE':
        const wormAngle = Math.random() * Math.PI * 2;
        const wormRadius = 50 + Math.random() * 100;
        particle.x = baseX + Math.cos(wormAngle) * wormRadius;
        particle.y = baseY + Math.sin(wormAngle) * wormRadius;
        particle.spiralAngle = wormAngle;
        particle.spiralRadius = wormRadius;
        particle.spiralSpeed = 0.05 + Math.random() * 0.1;
        particle.inwardSpeed = 0.5 + Math.random() * 1.0;
        particle.size = 1 + Math.random() * 3;
        particle.shape = 'portal_particle';
        break;
    }
    
    particle.color = particleSystem.color;
    particle.alpha = 0.7 + Math.random() * 0.3;
    particle.isActive = true;
  }

  /**
   * Update all particle systems
   */
  updateParticleSystems(deltaTime) {
    for (const [hazardId, particleSystem] of this.particleSystems.entries()) {
      if (!particleSystem.isActive) continue;
      
      this.updateParticleSystem(particleSystem, deltaTime);
    }
  }

  /**
   * Update individual particle system
   */
  updateParticleSystem(particleSystem, deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    
    for (let i = particleSystem.particles.length - 1; i >= 0; i--) {
      const particle = particleSystem.particles[i];
      
      this.updateParticleByType(particle, particleSystem, dt);
      
      // Remove dead particles
      if (particle.life !== undefined && particle.life <= 0) {
        particle.isActive = false;
        this.availableParticles.push(particle);
        particleSystem.particles.splice(i, 1);
      }
    }
    
    // Maintain particle count for continuous effects
    this.maintainParticleCount(particleSystem);
  }

  /**
   * Update particle based on hazard type
   */
  updateParticleByType(particle, particleSystem, dt) {
    const hazardVis = this.activeHazards.get(particleSystem.hazardId);
    if (!hazardVis) return;
    
    switch (hazardVis.type) {
      case 'ASTEROID_FIELD':
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.rotationSpeed;
        break;
        
      case 'SOLAR_FLARE':
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.life) {
          particle.life *= particle.decay;
          particle.alpha = particle.life;
        }
        break;
        
      case 'NEBULA_INTERFERENCE':
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.98; // Drag
        particle.vy *= 0.98;
        break;
        
      case 'GRAVITATIONAL_ANOMALY':
        particle.orbitAngle += particle.orbitSpeed;
        particle.orbitRadius -= particle.inwardSpeed || 0.5;
        particle.x = particleSystem.x + Math.cos(particle.orbitAngle) * particle.orbitRadius;
        particle.y = particleSystem.y + Math.sin(particle.orbitAngle) * particle.orbitRadius;
        
        if (particle.orbitRadius < 10) {
          particle.life = 0; // Consumed by anomaly
        }
        break;
        
      case 'MAGNETIC_STORM':
        const time = this.animationTime * 0.001;
        particle.x = particle.fieldX + Math.sin(time * particle.frequency) * particle.amplitude;
        particle.y = particle.fieldY + Math.cos(time * particle.frequency) * particle.amplitude;
        break;
        
      case 'COSMIC_RADIATION':
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.life) {
          particle.life *= particle.decay;
          particle.alpha = particle.life;
        }
        break;
        
      case 'TEMPORAL_ANOMALY':
        const timeWave = this.animationTime * 0.002 + particle.timeOffset;
        particle.x = particle.originalX + Math.sin(timeWave) * particle.rippleAmplitude;
        particle.y = particle.originalY + Math.cos(timeWave) * particle.rippleAmplitude;
        particle.alpha = 0.5 + 0.5 * Math.sin(timeWave * 2);
        break;
        
      case 'WORMHOLE':
        particle.spiralAngle += particle.spiralSpeed;
        particle.spiralRadius -= particle.inwardSpeed * dt;
        particle.x = particleSystem.x + Math.cos(particle.spiralAngle) * particle.spiralRadius;
        particle.y = particleSystem.y + Math.sin(particle.spiralAngle) * particle.spiralRadius;
        
        if (particle.spiralRadius < 5) {
          // Reset to outer edge
          particle.spiralRadius = 150;
        }
        break;
    }
  }

  /**
   * Maintain particle count for continuous effects
   */
  maintainParticleCount(particleSystem) {
    const targetCount = particleSystem.particleCount;
    const currentCount = particleSystem.particles.length;
    
    if (currentCount < targetCount && this.availableParticles.length > 0) {
      const hazardVis = this.activeHazards.get(particleSystem.hazardId);
      if (hazardVis) {
        const particle = this.availableParticles.pop();
        this.resetParticleForHazardType(particle, particleSystem, hazardVis);
        particleSystem.particles.push(particle);
      }
    }
  }

  /**
   * Render hazard objects (main shapes/sprites)
   */
  renderHazardObjects(cameraX, cameraY) {
    for (const [hazardId, hazardVis] of this.activeHazards.entries()) {
      if (!hazardVis.isActive) continue;
      
      const screenX = hazardVis.x - cameraX;
      const screenY = hazardVis.y - cameraY;
      
      // Only render if on screen
      if (screenX < -200 || screenX > this.canvas.width + 200 ||
          screenY < -200 || screenY > this.canvas.height + 200) {
        continue;
      }
      
      this.renderHazardObject(hazardVis, screenX, screenY);
    }
  }

  /**
   * Render individual hazard object
   */
  renderHazardObject(hazardVis, screenX, screenY) {
    const ctx = this.ctx;
    const visual = hazardVis.visual;
    const intensity = hazardVis.intensity;
    
    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Draw glow effect
    if (visual.glowColor) {
      const glowRadius = 50 * intensity;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
      gradient.addColorStop(0, visual.glowColor);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.globalAlpha = 0.5 * intensity;
      ctx.fillStyle = gradient;
      ctx.fillRect(-glowRadius, -glowRadius, glowRadius * 2, glowRadius * 2);
    }
    
    // Draw main hazard shape
    ctx.globalAlpha = 0.8;
    this.renderHazardShape(hazardVis, 0, 0);
    
    ctx.restore();
  }

  /**
   * Render hazard shape based on type
   */
  renderHazardShape(hazardVis, x, y) {
    const ctx = this.ctx;
    const visual = hazardVis.visual;
    const intensity = hazardVis.intensity;
    const time = this.animationTime * 0.001;
    
    ctx.strokeStyle = visual.color;
    ctx.fillStyle = visual.color;
    ctx.lineWidth = 2;
    
    switch (hazardVis.type) {
      case 'ASTEROID_FIELD':
        // Draw asteroid field boundary
        ctx.beginPath();
        ctx.setLineDash([10, 5]);
        ctx.strokeStyle = `rgba(139, 115, 85, ${intensity})`;
        ctx.strokeRect(x - 150, y - 150, 300, 300);
        ctx.setLineDash([]);
        break;
        
      case 'SOLAR_FLARE':
        // Draw solar flare burst
        ctx.save();
        ctx.globalAlpha = intensity;
        const rayCount = 12;
        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2 + time;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            x + Math.cos(angle) * (80 + 30 * Math.sin(time * 3)),
            y + Math.sin(angle) * (80 + 30 * Math.sin(time * 3))
          );
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.restore();
        break;
        
      case 'GRAVITATIONAL_ANOMALY':
        // Draw gravity well visualization
        ctx.save();
        for (let r = 20; r < 200; r += 20) {
          ctx.beginPath();
          ctx.arc(x, y, r * intensity, 0, Math.PI * 2);
          ctx.globalAlpha = (1 - r / 200) * intensity;
          ctx.stroke();
        }
        ctx.restore();
        break;
        
      case 'WORMHOLE':
        // Draw wormhole portal
        ctx.save();
        ctx.globalAlpha = intensity;
        const rings = 5;
        for (let i = 0; i < rings; i++) {
          const radius = 20 + i * 15;
          const alpha = 1 - (i / rings);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 206, 209, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.restore();
        break;
        
      case 'TEMPORAL_ANOMALY':
        // Draw time distortion ripples
        ctx.save();
        const ripples = 4;
        for (let i = 0; i < ripples; i++) {
          const phase = time * 2 + i * Math.PI / 2;
          const radius = 30 + 20 * Math.sin(phase);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.globalAlpha = (0.5 + 0.5 * Math.sin(phase)) * intensity;
          ctx.stroke();
        }
        ctx.restore();
        break;
    }
  }

  /**
   * Render particle systems
   */
  renderParticleSystems(cameraX, cameraY) {
    for (const [hazardId, particleSystem] of this.particleSystems.entries()) {
      if (!particleSystem.isActive) continue;
      
      this.renderParticleSystem(particleSystem, cameraX, cameraY);
    }
  }

  /**
   * Render individual particle system
   */
  renderParticleSystem(particleSystem, cameraX, cameraY) {
    const ctx = this.ctx;
    
    ctx.save();
    
    for (const particle of particleSystem.particles) {
      if (!particle.isActive) continue;
      
      const screenX = particle.x - cameraX;
      const screenY = particle.y - cameraY;
      
      // Skip off-screen particles
      if (screenX < -50 || screenX > this.canvas.width + 50 ||
          screenY < -50 || screenY > this.canvas.height + 50) {
        continue;
      }
      
      this.renderParticle(particle, screenX, screenY);
    }
    
    ctx.restore();
  }

  /**
   * Render individual particle
   */
  renderParticle(particle, screenX, screenY) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.globalAlpha = particle.alpha || 1.0;
    ctx.fillStyle = particle.color;
    ctx.strokeStyle = particle.color;
    
    switch (particle.shape) {
      case 'asteroid':
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(particle.rotation || 0);
        ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
        ctx.restore();
        break;
        
      case 'energy_particle':
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'gas_wisp':
        ctx.globalAlpha *= 0.3;
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'gravity_particle':
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        // Draw motion trail
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX - particle.vx * 0.1, screenY - particle.vy * 0.1);
        ctx.stroke();
        break;
        
      case 'field_line':
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'radiation_particle':
        ctx.globalAlpha *= 0.8;
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'time_particle':
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        // Add time distortion effect
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
        
      case 'portal_particle':
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    
    ctx.restore();
  }

  /**
   * Update screen effects
   */
  updateScreenEffects(deltaTime) {
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const effect = this.visualEffects[i];
      effect.age += deltaTime;
      
      if (effect.duration && effect.age > effect.duration) {
        this.visualEffects.splice(i, 1);
      } else {
        this.updateScreenEffect(effect, deltaTime);
      }
    }
  }

  /**
   * Render screen effects
   */
  renderScreenEffects() {
    const ctx = this.effectsCtx;
    ctx.clearRect(0, 0, this.effectsCanvas.width, this.effectsCanvas.height);
    
    for (const effect of this.visualEffects) {
      this.renderScreenEffect(effect, ctx);
    }
    
    // Composite effects onto main canvas
    if (this.visualEffects.length > 0) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.drawImage(this.effectsCanvas, 0, 0);
      this.ctx.restore();
    }
  }

  /**
   * Render individual screen effect
   */
  renderScreenEffect(effect, ctx) {
    switch (effect.type) {
      case 'fog_overlay':
        this.renderFogOverlay(effect, ctx);
        break;
      case 'electromagnetic_static':
        this.renderElectromagneticStatic(effect, ctx);
        break;
      case 'lens_distortion':
        this.renderLensDistortion(effect, ctx);
        break;
      case 'radiation_overlay':
        this.renderRadiationOverlay(effect, ctx);
        break;
    }
  }

  /**
   * Add screen effect
   */
  addScreenEffect(type, intensity, duration = null) {
    const effect = {
      type: type,
      intensity: intensity,
      duration: duration,
      age: 0,
      properties: {}
    };
    
    this.visualEffects.push(effect);
  }

  /**
   * Create a basic particle object
   */
  createParticle() {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      size: 1, alpha: 1, color: '#ffffff',
      life: 1, decay: 1, rotation: 0,
      isActive: false, shape: 'circle'
    };
  }

  /**
   * Cleanup expired effects and systems
   */
  cleanupExpiredEffects() {
    // Remove inactive particle systems
    for (const [hazardId, particleSystem] of this.particleSystems.entries()) {
      if (!particleSystem.isActive) {
        this.cleanupParticleSystem(hazardId);
      }
    }
  }

  /**
   * Cleanup particle system
   */
  cleanupParticleSystem(hazardId) {
    const particleSystem = this.particleSystems.get(hazardId);
    if (!particleSystem) return;
    
    // Return particles to pool
    for (const particle of particleSystem.particles) {
      particle.isActive = false;
      this.availableParticles.push(particle);
    }
    
    this.particleSystems.delete(hazardId);
  }

  /**
   * Play ambient sound for hazard
   */
  playAmbientSound(hazardId, soundId, intensity) {
    // In a real implementation, you would load and play audio files
    console.log(`Playing ambient sound: ${soundId} at intensity ${intensity} for hazard ${hazardId}`);
  }

  /**
   * Stop ambient sound
   */
  stopAmbientSound(hazardId) {
    console.log(`Stopping ambient sound for hazard ${hazardId}`);
  }

  /**
   * Update ambient sound volume
   */
  updateAmbientSoundVolume(hazardId, intensity) {
    console.log(`Updating ambient sound volume for hazard ${hazardId} to ${intensity}`);
  }

  /**
   * Process audio queue
   */
  processAudioQueue() {
    while (this.audioQueue.length > 0) {
      const audioId = this.audioQueue.shift();
      this.playSound(audioId);
    }
  }

  /**
   * Play a sound effect
   */
  playSound(soundId) {
    console.log(`Playing sound effect: ${soundId}`);
  }

  /**
   * Add warning to display
   */
  addWarning(warningData) {
    const warning = {
      id: warningData.id || Date.now().toString(),
      type: warningData.type,
      message: warningData.message,
      priority: warningData.priority || 'INFO',
      duration: warningData.duration || 5000,
      createdAt: Date.now(),
      acknowledged: false
    };
    
    this.warnings.push(warning);
    
    // Play warning sound
    if (warningData.audio) {
      this.audioQueue.push(warningData.audio);
    }
  }

  /**
   * Update warnings
   */
  updateWarnings(deltaTime) {
    const now = Date.now();
    
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const warning = this.warnings[i];
      
      if (now - warning.createdAt > warning.duration) {
        this.warnings.splice(i, 1);
      }
    }
  }

  /**
   * Render warning UI
   */
  renderWarningUI() {
    const ctx = this.ctx;
    const now = Date.now();
    
    let yOffset = 20;
    
    for (const warning of this.warnings) {
      const age = now - warning.createdAt;
      const fadeTime = 1000; // 1 second fade
      let alpha = 1.0;
      
      if (age > warning.duration - fadeTime) {
        alpha = (warning.duration - age) / fadeTime;
      }
      
      this.renderWarning(warning, yOffset, alpha);
      yOffset += 60;
    }
  }

  /**
   * Render individual warning
   */
  renderWarning(warning, yOffset, alpha) {
    const ctx = this.ctx;
    const x = 20;
    const y = yOffset;
    const width = 400;
    const height = 50;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Warning background
    const priorityColors = {
      'CRITICAL': 'rgba(255, 0, 0, 0.8)',
      'HIGH': 'rgba(255, 69, 0, 0.8)',
      'MEDIUM': 'rgba(255, 165, 0, 0.8)',
      'LOW': 'rgba(255, 255, 0, 0.8)',
      'INFO': 'rgba(0, 255, 0, 0.8)'
    };
    
    ctx.fillStyle = priorityColors[warning.priority] || priorityColors['INFO'];
    ctx.fillRect(x, y, width, height);
    
    // Warning border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Warning text
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(warning.message, x + 10, y + 30);
    
    ctx.restore();
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      activeHazards: this.activeHazards.size,
      particleSystems: this.particleSystems.size,
      totalParticles: Array.from(this.particleSystems.values()).reduce(
        (sum, ps) => sum + ps.particles.length, 0
      ),
      visualEffects: this.visualEffects.length,
      activeWarnings: this.warnings.length,
      availableParticles: this.availableParticles.length
    };
  }
}

// Export for use in main game client
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HazardVisualizer;
} else {
  window.HazardVisualizer = HazardVisualizer;
}