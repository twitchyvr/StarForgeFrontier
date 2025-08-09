# StarForgeFrontier - Development Instructions

## Project Overview
StarForgeFrontier is a multiplayer spaceship building and space exploration game with full physics, upgrades, and an engaging in-game economy. Built with Node.js backend and HTML5 Canvas frontend.

**Current Version:** 0.2.0  
**Current Branch:** main  
**Project Status:** CI/CD pipeline operational, production-ready deployment

## Architecture Overview

### Backend (Node.js)
- **Entry Point:** `server.js` (legacy) / `server-enhanced.js` (production)
- **Framework:** Express.js with comprehensive middleware stack
- **WebSocket:** Real-time multiplayer communication using `ws` library
- **Game Loop:** 30fps server-side simulation with deterministic physics
- **State Management:** SQLite database with persistent data storage
- **Authentication:** JWT-based user authentication system
- **Health Monitoring:** Built-in health check endpoints and metrics

### Frontend (HTML5 Canvas)
- **Entry Point:** `public/index.html`
- **Game Engine:** Enhanced canvas renderer in `public/client-enhanced.js`
- **Authentication:** Dedicated auth interface (`public/auth.html`)
- **Styling:** Responsive CSS with dark mode support
- **Real-time Communication:** WebSocket client with reconnection handling

### Core Game Features
- **Multiplayer Support:** Real-time player synchronization with persistent sessions
- **Ship Building:** Modular spacecraft construction system
- **Resource Economy:** Ore collection and credit-based upgrade system
- **Dynamic Events:** Scheduled supernova events with resource spawning
- **Physics Simulation:** Server-authoritative movement and collision detection
- **User Management:** Registration, login, and profile systems
- **Data Persistence:** Player progress and game state preservation

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
- `npm start` - Start production server (enhanced)
- `npm run dev` - Start development server with hot reload
- `npm test` - Run comprehensive test suite (107 tests)
- `npm run lint` - Check code style
- `npm run build` - Build for production
- `npm run deploy` - Deploy to production
- `npm run backup` - Create database backup
- `npm run monitor` - Start monitoring dashboard
- `npm run health` - Run health checks

## Current Project Structure
```
StarForgeFrontier/
├── .github/workflows/      # GitHub Actions CI/CD pipelines
│   ├── ci.yml             # Continuous integration workflow
│   ├── deploy.yml         # Deployment automation
│   ├── render-deploy.yml  # Render.com deployment
│   └── test.yml          # Testing workflow
├── monitoring/            # Observability and monitoring
│   ├── prometheus.yml     # Metrics collection config
│   ├── starforge_rules.yml # Alerting rules
│   └── grafana/          # Dashboard configurations
├── nginx/                 # Reverse proxy configuration
│   └── nginx.conf        # Load balancing and SSL
├── scripts/              # Utility and automation scripts
│   ├── backup.js         # Database backup system
│   └── monitor.js        # Real-time monitoring dashboard
├── tests/                # Comprehensive test suite
│   ├── client/           # Frontend tests
│   └── server/           # Backend tests (107 total tests)
├── public/               # Enhanced frontend assets
│   ├── index.html        # Main game interface
│   ├── auth.html         # Authentication interface
│   ├── client-enhanced.js # Enhanced game client
│   ├── auth.js           # Authentication logic
│   ├── style.css         # Responsive game styling
│   └── auth.css          # Authentication styling
├── DEPLOYMENT.md         # Comprehensive deployment guide
├── Dockerfile            # Multi-stage container build
├── docker-compose.yml    # Production stack configuration
├── render.yaml           # Render.com deployment config
├── healthcheck.js        # Health monitoring utility
├── server-enhanced.js    # Production server with full features
├── database.js           # SQLite database management
├── package.json          # Dependencies and deployment scripts
└── logs/                 # Application and health logs
```

## Active Development Areas

### Current Sprint Focus
1. **Core Game Mechanics** - Basic multiplayer functionality ✅
2. **UI/UX Enhancement** - Enhanced interface with authentication ✅
3. **Data Persistence** - SQLite integration and user management ✅
4. **Testing Infrastructure** - Comprehensive test suite (107 tests) ✅
5. **CI/CD Pipeline** - Automated deployment and monitoring ✅
6. **Performance Optimization** - Server and client-side optimizations
7. **Documentation** - API documentation and player guides

### Known Technical Debt
- Limited error handling for edge cases in multiplayer sync
- Enhanced input validation needed for WebSocket messages
- Performance optimization for high-concurrency scenarios
- Advanced monitoring alerts and dashboards
- Mobile responsiveness improvements

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
- **Staging:** Automated deployment for pre-production testing
- **Production:** Automated deployment to Render.com (Virginia region)
- **Monitoring:** Real-time health checks and performance monitoring
- **Rollback:** Zero-downtime rollback capabilities
- **Backup:** Automated database backup and restore system

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

---

## CI/CD Pipeline Status

### GitHub Actions Workflows
- ✅ **CI Pipeline:** Automated testing on all PRs and pushes
- ✅ **Deployment:** Automated production deployment to Render.com
- ✅ **Security Scanning:** Trivy vulnerability scanning
- ✅ **Quality Gates:** Code quality checks and test coverage

### Production Deployment
- **Platform:** Render.com (Virginia region)
- **Database:** SQLite with automated backups
- **Monitoring:** Prometheus + Grafana dashboards
- **Health Checks:** Automated endpoint monitoring
- **SSL/TLS:** Automatic HTTPS with Let's Encrypt

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with tests
3. Push triggers CI pipeline (107 tests)
4. Create PR with automated checks
5. Merge triggers production deployment
6. Health checks verify deployment success

---

**Last Updated:** 2025-08-09  
**Maintained By:** GitOps Orchestrator Agent  
**Version:** 2.0.0