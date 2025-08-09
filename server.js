/*
 * StarForgeFrontier server
 *
 * This Node.js server hosts a small multiplayer space game.  It serves
 * static assets from the `public` folder and exposes a WebSocket API
 * used by clients to synchronise state.  Each connected player is
 * allocated a unique identifier and a small ship made up of modules.
 * Players can move their ship with the arrow or WASD keys, attach
 * additional modules if they have sufficient resources and collect
 * ores floating in space.  Collected ores contribute to a simple
 * economy: ores grant credits that can be spent on upgrades.  The
 * server maintains a deterministic simulation loop that regularly
 * broadcasts the game state to all connected clients.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static assets from the public directory
app.use(express.static('public'));

// In‑memory state
const players = new Map();
let ores = [];

// Game constants
const STARTING_RESOURCES = 100;
const ORE_VALUE = 25;
const MODULE_COSTS = {
  engine: 50,
  cargo: 30
};

// Utility to broadcast JSON data to all clients
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Spawn a handful of ores at random positions within a square play area
function spawnInitialOres() {
  ores = [];
  const num = 20;
  for (let i = 0; i < num; i++) {
    ores.push({
      id: uuidv4(),
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      value: ORE_VALUE
    });
  }
}

// Remove an ore by id
function removeOre(id) {
  ores = ores.filter(o => o.id !== id);
}

// Broadcast full state to all players
function broadcastState() {
  const state = {
    type: 'update',
    players: Array.from(players.values()).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      modules: p.modules,
      resources: p.resources
    })),
    ores
  };
  broadcast(state);
}

// Handle new player connections
wss.on('connection', (ws) => {
  // Create a new player entry
  const id = uuidv4();
  const player = {
    id,
    x: Math.random() * 800 - 400,
    y: Math.random() * 800 - 400,
    modules: [
      { id: 'hull', x: 0, y: 0 }
    ],
    // Input state
    inputs: { up: false, down: false, left: false, right: false },
    resources: STARTING_RESOURCES
  };
  players.set(id, player);

  // Send initial state to the connecting client
  ws.send(JSON.stringify({ type: 'init', id, players: Array.from(players.values()), ores }));

  // Attach player id to websocket for convenience
  ws.playerId = id;

  // When receiving a message, update inputs or handle actions
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      return;
    }
    const p = players.get(ws.playerId);
    if (!p) return;
    if (data.type === 'input') {
      // Store desired movement directions
      p.inputs = {
        up: !!data.up,
        down: !!data.down,
        left: !!data.left,
        right: !!data.right
      };
    } else if (data.type === 'build') {
      // Attempt to add a module to the ship
      const mod = data.module;
      const cost = MODULE_COSTS[mod.id] || 0;
      if (p.resources >= cost) {
        p.resources -= cost;
        p.modules.push(mod);
        // Inform only this player of their resource change
        ws.send(JSON.stringify({ type: 'resources', resources: p.resources }));
      }
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    players.delete(ws.playerId);
    broadcast({ type: 'player_disconnect', id: ws.playerId });
  });
});

// Main simulation loop runs ~30 times per second
const TICK_INTERVAL = 1000 / 30;
setInterval(() => {
  // Update each player's position based on inputs
  players.forEach((p) => {
    const speed = 2;
    if (p.inputs.up) p.y -= speed;
    if (p.inputs.down) p.y += speed;
    if (p.inputs.left) p.x -= speed;
    if (p.inputs.right) p.x += speed;
  });
  // Handle ore collection
  players.forEach((p) => {
    ores.forEach((ore) => {
      const dx = p.x - ore.x;
      const dy = p.y - ore.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 40 * 40) { // within 40px radius
        p.resources += ore.value;
        removeOre(ore.id);
      }
    });
  });
  // If all ores collected, spawn more
  if (ores.length === 0) {
    spawnInitialOres();
  }
  // Broadcast the updated state
  broadcastState();
}, TICK_INTERVAL);

// Initialise ores on startup
spawnInitialOres();

// Start the HTTP server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`StarForgeFrontier server running at http://localhost:${PORT}`);
});
