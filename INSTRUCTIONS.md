# StarForgeFrontier - Development Instructions

## Project Overview
StarForgeFrontier is a multiplayer spaceship building and space exploration game with full physics, upgrades, and an engaging in-game economy. Built with Node.js backend and HTML5 Canvas frontend.

**Current Version:** 0.1.0  
**Current Branch:** main  
**Project Status:** Initial development phase

## Architecture Overview

### Backend (Node.js)
- **Entry Point:** `server.js`
- **Framework:** Express.js for static file serving
- **WebSocket:** Real-time multiplayer communication using `ws` library
- **Game Loop:** 30fps server-side simulation with deterministic physics
- **State Management:** In-memory game state with player synchronization

### Frontend (HTML5 Canvas)
- **Entry Point:** `public/index.html`
- **Game Engine:** Custom canvas-based renderer in `public/client.js`
- **Styling:** CSS in `public/style.css`
- **Real-time Communication:** WebSocket client for server synchronization

### Core Game Features
- **Multiplayer Support:** Real-time player synchronization
- **Ship Building:** Modular spacecraft construction system
- **Resource Economy:** Ore collection and credit-based upgrade system
- **Dynamic Events:** Scheduled supernova events with resource spawning
- **Physics Simulation:** Server-authoritative movement and collision detection

## Development Workflow

### Branch Strategy
- **main:** Production-ready code, protected branch
- **develop:** Integration branch for feature development
- **feature/[name]:** Individual feature development
- **hotfix/[name]:** Critical production fixes
- **chore/[name]:** Maintenance tasks and tooling updates

### Commit Standards
Following Conventional Commits specification:
- **feat:** New features
- **fix:** Bug fixes
- **docs:** Documentation updates
- **style:** Code formatting changes
- **refactor:** Code restructuring without functional changes
- **test:** Adding or updating tests
- **chore:** Maintenance tasks

Example: `feat(game): add weapon module functionality`

### Development Environment Setup

#### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn package manager
- Git version control

#### Installation
```bash
# Clone repository
git clone <repository-url>
cd StarForgeFrontier

# Install dependencies
npm install

# Start development server
npm start
```

#### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm test` - Run test suite
- `npm run lint` - Check code style
- `npm run build` - Build for production

## Current Project Structure
```
StarForgeFrontier/
├── LICENSE                 # Project license
├── README.md              # Project overview
├── INSTRUCTIONS.md        # This file - development guide
├── package.json           # Node.js dependencies and scripts
├── server.js             # Main server application
├── .gitignore            # Git ignore rules
├── logs/                 # Server logs directory
│   └── production-health-20250808.log
└── public/               # Static frontend assets
    ├── index.html        # Game entry point
    ├── client.js         # Frontend game logic
    └── style.css         # Game styling
```

## Active Development Areas

### Current Sprint Focus
1. **Core Game Mechanics** - Basic multiplayer functionality ✅
2. **UI/UX Enhancement** - Improve game interface and player experience
3. **Performance Optimization** - Server and client-side optimizations
4. **Testing Infrastructure** - Unit and integration test setup
5. **Documentation** - API documentation and player guides

### Known Technical Debt
- Missing automated testing framework
- No error handling for edge cases in multiplayer sync
- Limited input validation on WebSocket messages
- No persistent player data storage
- Missing CI/CD pipeline

### Dependencies
```json
{
  "express": "^4.18.4",    // Web server framework
  "ws": "^8.17.0",         // WebSocket implementation
  "uuid": "^9.0.1"         // Unique identifier generation
}
```

## Quality Assurance

### Code Review Requirements
- All changes must go through pull request review
- Minimum one approval required for merge
- Automated checks must pass (linting, tests)
- Documentation must be updated for API changes

### Testing Strategy
- **Unit Tests:** Individual function testing
- **Integration Tests:** Component interaction testing  
- **End-to-End Tests:** Full gameplay scenario testing
- **Performance Tests:** Load and stress testing for multiplayer

### Deployment Process
- **Development:** Auto-deploy on push to develop branch
- **Staging:** Manual deployment for pre-production testing
- **Production:** Tagged releases with manual approval

## Security Considerations
- Input validation on all WebSocket messages
- Rate limiting for player actions
- Secure connection handling (WSS in production)
- Resource limits to prevent abuse

## Performance Targets
- **Server:** Handle 100+ concurrent players
- **Client:** Maintain 60fps on mid-range hardware
- **Network:** <100ms latency for player actions
- **Memory:** <500MB server memory usage

## Contributing Guidelines

### Before Starting Development
1. Check out develop branch: `git checkout develop`
2. Create feature branch: `git checkout -b feature/your-feature-name`
3. Install dependencies: `npm install`
4. Start development server: `npm start`

### Development Checklist
- [ ] Code follows project style guidelines
- [ ] Unit tests written for new functionality
- [ ] Documentation updated for API changes
- [ ] Manual testing completed
- [ ] Performance impact assessed
- [ ] Security implications reviewed

### Pull Request Process
1. Push feature branch to remote
2. Create pull request targeting develop branch
3. Fill out PR template with changes description
4. Request review from team members
5. Address feedback and update code
6. Merge after approval and passing checks

## Troubleshooting

### Common Issues
- **Port 3000 in use:** Change PORT environment variable
- **WebSocket connection failed:** Check server status and firewall
- **Missing dependencies:** Run `npm install`
- **Game lag:** Check network connection and server performance

### Debug Mode
Set `NODE_ENV=development` for additional logging and debug features.

### Health Monitoring
Production health logs are available in `logs/` directory.
Use `/Users/mattrogers/Documents/Spaghetti/scripts/production-health-monitor.sh` for status checks.

---

**Last Updated:** 2025-01-09  
**Maintained By:** GitOps Orchestrator Agent  
**Version:** 1.0.0