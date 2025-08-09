/**
 * Physics worker thread for offloading intensive calculations
 * Handles collision detection, movement, and ore collection computations
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
  // Main thread - Physics Worker Manager
  class PhysicsWorkerManager {
    constructor(numWorkers = 2) {
      this.workers = [];
      this.taskQueue = [];
      this.activeJobs = new Map();
      this.jobIdCounter = 0;
      this.roundRobinIndex = 0;
      
      // Performance metrics
      this.metrics = {
        jobsProcessed: 0,
        averageProcessingTime: 0,
        queuedJobs: 0,
        activeWorkers: 0
      };

      this.initializeWorkers(numWorkers);
    }

    /**
     * Initialize worker threads
     */
    initializeWorkers(numWorkers) {
      for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(__filename, {
          workerData: { workerId: i }
        });

        worker.on('message', (message) => {
          this.handleWorkerMessage(worker, message);
        });

        worker.on('error', (error) => {
          console.error(`Physics worker ${i} error:`, error);
          this.handleWorkerError(worker, i);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`Physics worker ${i} stopped with exit code ${code}`);
            this.handleWorkerExit(worker, i);
          }
        });

        this.workers.push({
          worker,
          id: i,
          busy: false,
          jobsCompleted: 0
        });
      }

      this.metrics.activeWorkers = numWorkers;
      console.log(`Initialized ${numWorkers} physics worker threads`);
    }

    /**
     * Process physics calculations for game objects
     */
    async processPhysics(players, ores, gameConstants) {
      const jobId = this.jobIdCounter++;
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const job = {
          id: jobId,
          type: 'processPhysics',
          data: { players, ores, gameConstants },
          resolve,
          reject,
          startTime
        };

        this.activeJobs.set(jobId, job);
        this.assignJobToWorker(job);
      });
    }

    /**
     * Process collision detection between entities
     */
    async processCollisions(entities, spatialGridData) {
      const jobId = this.jobIdCounter++;
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const job = {
          id: jobId,
          type: 'processCollisions',
          data: { entities, spatialGridData },
          resolve,
          reject,
          startTime
        };

        this.activeJobs.set(jobId, job);
        this.assignJobToWorker(job);
      });
    }

    /**
     * Calculate ore collection for players
     */
    async calculateOreCollection(players, ores) {
      const jobId = this.jobIdCounter++;
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const job = {
          id: jobId,
          type: 'calculateOreCollection',
          data: { players, ores },
          resolve,
          reject,
          startTime
        };

        this.activeJobs.set(jobId, job);
        this.assignJobToWorker(job);
      });
    }

    /**
     * Assign job to an available worker using round-robin
     */
    assignJobToWorker(job) {
      // Find an available worker
      let assignedWorker = null;
      
      for (let i = 0; i < this.workers.length; i++) {
        const workerIndex = (this.roundRobinIndex + i) % this.workers.length;
        const workerInfo = this.workers[workerIndex];
        
        if (!workerInfo.busy) {
          assignedWorker = workerInfo;
          this.roundRobinIndex = (workerIndex + 1) % this.workers.length;
          break;
        }
      }

      if (assignedWorker) {
        assignedWorker.busy = true;
        assignedWorker.worker.postMessage({
          jobId: job.id,
          type: job.type,
          data: job.data
        });
      } else {
        // All workers busy, queue the job
        this.taskQueue.push(job);
        this.metrics.queuedJobs++;
      }
    }

    /**
     * Handle messages from worker threads
     */
    handleWorkerMessage(worker, message) {
      const { jobId, result, error } = message;
      const job = this.activeJobs.get(jobId);
      
      if (!job) {
        console.warn(`Received result for unknown job ${jobId}`);
        return;
      }

      // Find worker info
      const workerInfo = this.workers.find(w => w.worker === worker);
      if (workerInfo) {
        workerInfo.busy = false;
        workerInfo.jobsCompleted++;
      }

      // Update metrics
      const processingTime = Date.now() - job.startTime;
      this.metrics.jobsProcessed++;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.jobsProcessed - 1) + processingTime) / 
        this.metrics.jobsProcessed;

      // Resolve or reject the job
      if (error) {
        job.reject(new Error(error));
      } else {
        job.resolve(result);
      }

      this.activeJobs.delete(jobId);

      // Process next job in queue
      if (this.taskQueue.length > 0) {
        const nextJob = this.taskQueue.shift();
        this.metrics.queuedJobs--;
        this.assignJobToWorker(nextJob);
      }
    }

    /**
     * Handle worker errors
     */
    handleWorkerError(worker, workerId) {
      const workerInfo = this.workers.find(w => w.id === workerId);
      if (workerInfo) {
        workerInfo.busy = false;
      }
      
      // Restart the worker
      this.restartWorker(workerId);
    }

    /**
     * Handle worker exit
     */
    handleWorkerExit(worker, workerId) {
      this.restartWorker(workerId);
    }

    /**
     * Restart a worker
     */
    restartWorker(workerId) {
      console.log(`Restarting physics worker ${workerId}`);
      
      const newWorker = new Worker(__filename, {
        workerData: { workerId }
      });

      newWorker.on('message', (message) => {
        this.handleWorkerMessage(newWorker, message);
      });

      newWorker.on('error', (error) => {
        console.error(`Physics worker ${workerId} error:`, error);
        this.handleWorkerError(newWorker, workerId);
      });

      newWorker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Physics worker ${workerId} stopped with exit code ${code}`);
          this.handleWorkerExit(newWorker, workerId);
        }
      });

      // Update worker info
      const workerInfo = this.workers.find(w => w.id === workerId);
      if (workerInfo) {
        workerInfo.worker = newWorker;
        workerInfo.busy = false;
      }
    }

    /**
     * Get performance statistics
     */
    getStats() {
      return {
        ...this.metrics,
        activeJobs: this.activeJobs.size,
        queuedJobs: this.taskQueue.length,
        workerStats: this.workers.map(w => ({
          id: w.id,
          busy: w.busy,
          jobsCompleted: w.jobsCompleted
        }))
      };
    }

    /**
     * Shutdown all workers
     */
    async shutdown() {
      const terminationPromises = this.workers.map(workerInfo => {
        return workerInfo.worker.terminate();
      });

      await Promise.all(terminationPromises);
      this.workers = [];
      this.activeJobs.clear();
      this.taskQueue = [];
      
      console.log('Physics workers shut down');
    }

    /**
     * Health check
     */
    healthCheck() {
      const healthyWorkers = this.workers.filter(w => !w.busy).length;
      
      return {
        status: healthyWorkers > 0 ? 'healthy' : 'busy',
        totalWorkers: this.workers.length,
        availableWorkers: healthyWorkers,
        activeJobs: this.activeJobs.size,
        queuedJobs: this.taskQueue.length,
        metrics: this.metrics
      };
    }
  }

  module.exports = PhysicsWorkerManager;

} else {
  // Worker thread - Physics calculations
  const workerId = workerData.workerId;
  
  console.log(`Physics worker ${workerId} started`);

  /**
   * Process physics calculations
   */
  function processPhysics(players, ores, gameConstants) {
    const results = {
      updatedPlayers: [],
      collectedOres: [],
      collisions: []
    };

    // Process player movements and collisions
    players.forEach(player => {
      const updatedPlayer = { ...player };
      
      // Apply movement based on inputs
      if (player.inputs) {
        const speed = player.shipProperties?.speed || gameConstants.BASE_SPEED || 2.0;
        
        if (player.inputs.up) updatedPlayer.y -= speed;
        if (player.inputs.down) updatedPlayer.y += speed;
        if (player.inputs.left) updatedPlayer.x -= speed;
        if (player.inputs.right) updatedPlayer.x += speed;
      }

      // Check ore collection
      const collectionRange = player.shipProperties?.collectionRange || gameConstants.BASE_COLLECTION_RANGE || 40;
      const collectedOreIds = [];

      ores.forEach(ore => {
        const dx = updatedPlayer.x - ore.x;
        const dy = updatedPlayer.y - ore.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= collectionRange) {
          collectedOreIds.push(ore.id);
          results.collectedOres.push({
            playerId: player.id,
            oreId: ore.id,
            value: ore.value
          });
        }
      });

      results.updatedPlayers.push(updatedPlayer);
    });

    return results;
  }

  /**
   * Process collision detection
   */
  function processCollisions(entities, spatialGridData) {
    const collisions = [];
    
    // Simple collision detection using spatial grid data
    entities.forEach((entity1, index1) => {
      entities.slice(index1 + 1).forEach(entity2 => {
        const dx = entity1.x - entity2.x;
        const dy = entity1.y - entity2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const minDistance = (entity1.radius || 20) + (entity2.radius || 20);
        
        if (distance < minDistance) {
          collisions.push({
            entity1: entity1.id,
            entity2: entity2.id,
            distance,
            overlap: minDistance - distance
          });
        }
      });
    });

    return { collisions };
  }

  /**
   * Calculate ore collection efficiently
   */
  function calculateOreCollection(players, ores) {
    const collections = [];

    players.forEach(player => {
      const collectionRange = player.shipProperties?.collectionRange || 40;
      const cargoCapacity = player.shipProperties?.cargoCapacity || 1000;
      
      if (player.resources >= cargoCapacity) {
        return; // Cargo full
      }

      ores.forEach(ore => {
        const dx = player.x - ore.x;
        const dy = player.y - ore.y;
        const distanceSquared = dx * dx + dy * dy;
        const rangeSquared = collectionRange * collectionRange;

        if (distanceSquared <= rangeSquared) {
          collections.push({
            playerId: player.id,
            oreId: ore.id,
            value: ore.value,
            efficiency: player.shipProperties?.componentCounts?.cargo ? 
              1 + (player.shipProperties.componentCounts.cargo * 0.1) : 1
          });
        }
      });
    });

    return { collections };
  }

  // Handle messages from main thread
  parentPort.on('message', (message) => {
    const { jobId, type, data } = message;

    try {
      let result;

      switch (type) {
        case 'processPhysics':
          result = processPhysics(data.players, data.ores, data.gameConstants);
          break;
        case 'processCollisions':
          result = processCollisions(data.entities, data.spatialGridData);
          break;
        case 'calculateOreCollection':
          result = calculateOreCollection(data.players, data.ores);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      parentPort.postMessage({ jobId, result });
    } catch (error) {
      parentPort.postMessage({ jobId, error: error.message });
    }
  });
}