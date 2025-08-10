/**
 * StarForgeFrontier optimization utilities
 * Centralized exports for all performance enhancement modules
 */

const SpatialIndex = require('./spatial-index');
const DeltaStateManager = require('./delta-state');
const DatabasePool = require('./database-pool');
const BroadcastManager = require('./broadcast-manager');
const PhysicsWorkerManager = require('./physics-worker');
const PlayerCullingSystem = require('./player-culling');
const { ObjectPool, ObjectPoolManager } = require('./object-pool');
const { LoadTestClient, LoadTestManager } = require('./load-testing');
const PerformanceMonitor = require('./performance-monitor');
const MessageFrequencyOptimizer = require('./message-optimizer');

module.exports = {
  SpatialIndex,
  DeltaStateManager,
  DatabasePool,
  BroadcastManager,
  PhysicsWorkerManager,
  PlayerCullingSystem,
  ObjectPool,
  ObjectPoolManager,
  LoadTestClient,
  LoadTestManager,
  PerformanceMonitor,
  MessageFrequencyOptimizer
};