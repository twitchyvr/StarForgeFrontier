# StarForgeFrontier Deployment Guide

This guide covers deployment options and CI/CD pipeline setup for StarForgeFrontier.

## 🚀 Quick Deployment (Render.com)

The easiest way to deploy StarForgeFrontier is using Render.com, which is already configured:

### Prerequisites
- GitHub account with this repository
- Render.com account (free tier available)

### Steps
1. **Fork/Clone** this repository to your GitHub account
2. **Connect to Render**:
   - Go to [Render.com](https://render.com)
   - Connect your GitHub account
   - Select this repository
3. **Configure Service**:
   - Service Type: `Web Service`
   - Build Command: `npm ci --only=production`
   - Start Command: `node server-enhanced.js`
   - Environment: `Node`
   - Region: `Virginia` (best for East Coast users)
4. **Environment Variables** (optional):
   ```
   NODE_ENV=production
   DATABASE_PATH=/opt/render/project/src/data/starforge.db
   ```
5. **Deploy**: Click "Create Web Service"

The service will be available at: `https://your-service-name.onrender.com`

## 🐳 Docker Deployment

### Local Development
```bash
# Build and run locally
npm run docker:build
npm run docker:run

# Or use docker-compose
npm run docker:up
```

### Production with Docker Compose
```bash
# Start full production stack
docker-compose up -d

# View logs
docker-compose logs -f starforge

# Stop services
docker-compose down
```

This includes:
- StarForgeFrontier application
- Redis for session storage
- Nginx reverse proxy
- Prometheus monitoring
- Grafana dashboards
- Automated backups

## ☁️ Cloud Deployment Options

### AWS (Elastic Container Service)
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t starforgefrontier .
docker tag starforgefrontier:latest $ECR_REGISTRY/starforgefrontier:latest
docker push $ECR_REGISTRY/starforgefrontier:latest

# Deploy to ECS (requires ECS cluster setup)
aws ecs update-service --cluster starforge-cluster --service starforge-service --force-new-deployment
```

### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/starforgefrontier
gcloud run deploy --image gcr.io/PROJECT_ID/starforgefrontier --platform managed
```

### DigitalOcean App Platform
```yaml
# .do/app.yaml
name: starforgefrontier
services:
- name: web
  source_dir: /
  github:
    repo: your-username/StarForgeFrontier
    branch: main
  run_command: node server-enhanced.js
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: "production"
```

### Kubernetes
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: starforgefrontier
spec:
  replicas: 2
  selector:
    matchLabels:
      app: starforgefrontier
  template:
    metadata:
      labels:
        app: starforgefrontier
    spec:
      containers:
      - name: starforgefrontier
        image: starforgefrontier:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_PATH
          value: "/data/starforge.db"
        volumeMounts:
        - name: data-storage
          mountPath: /data
      volumes:
      - name: data-storage
        persistentVolumeClaim:
          claimName: starforge-data
```

## 🔧 CI/CD Pipeline

### GitHub Actions (Automatic)
The repository includes three GitHub Actions workflows:

1. **Continuous Integration** (`.github/workflows/ci.yml`)
   - Triggers on push/PR to main/develop
   - Runs tests on Node.js 16.x, 18.x, 20.x
   - Builds Docker images
   - Security scanning with Trivy

2. **Test Suite** (`.github/workflows/test.yml`)  
   - Comprehensive testing with coverage reports
   - Upload to Codecov
   - Security auditing

3. **Render Deployment** (`.github/workflows/render-deploy.yml`)
   - Automatic deployment to Render.com
   - Health checks and monitoring
   - Rollback capabilities

### Manual Deployment
```bash
# Run full test suite
npm test

# Build Docker image
npm run docker:build

# Deploy to production (varies by platform)
npm run deploy:render  # For Render.com
# OR
docker-compose up -d   # For self-hosted
```

## 📊 Monitoring & Health Checks

### Built-in Endpoints
- **Health Check**: `/api/health` - Service health status
- **Metrics**: `/metrics` - Prometheus metrics
- **Nginx Status**: `/nginx_status` - Web server stats (if using nginx)

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "memory": {
    "used": 128,
    "total": 256
  },
  "players": {
    "active": 15,
    "sessions": 12
  },
  "database": {
    "initialized": true
  }
}
```

### Monitoring Scripts
```bash
# Manual health check
npm run health-check

# Continuous monitoring
node scripts/monitor.js

# Single check
node scripts/monitor.js once
```

### Grafana Dashboards
Access at `http://localhost:3001` (docker-compose setup):
- Player metrics and online counts
- System resource usage
- Request rates and response times
- Database performance
- Error tracking

## 💾 Database & Backups

### Automatic Backups (Docker Compose)
The backup service automatically:
- Creates hourly database backups
- Keeps 7 days of backups
- Stores in `./backups/` directory

### Manual Backup Management
```bash
# Create backup
npm run backup

# Using backup script directly
node scripts/backup.js create
node scripts/backup.js list
node scripts/backup.js restore <filename>
```

### Database Location
- **Local**: `starforge.db`
- **Render**: `/opt/render/project/src/data/starforge.db`
- **Docker**: `/app/data/starforge.db` (mounted volume)

## 🔒 Security Considerations

### Environment Variables
Set these in your deployment platform:
```
NODE_ENV=production
DATABASE_PATH=/path/to/persistent/starforge.db
GRAFANA_PASSWORD=secure_password_here
```

### Production Hardening
1. **Enable HTTPS** (handled by Render automatically)
2. **Set secure headers** (implemented in nginx config)
3. **Rate limiting** (configured in nginx)
4. **Database encryption** (consider encrypted storage)
5. **Access logs** (enabled by default)

### Security Features
- ✅ bcrypt password hashing
- ✅ SQL injection prevention
- ✅ Input validation
- ✅ CORS protection
- ✅ Rate limiting (nginx)
- ✅ Security headers

## 🚨 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check database file permissions
ls -la starforge.db
chmod 644 starforge.db

# Verify database integrity
sqlite3 starforge.db "PRAGMA integrity_check;"
```

**Memory Issues**
```bash
# Check memory usage
node scripts/monitor.js once

# Restart service (Docker)
docker-compose restart starforge
```

**WebSocket Connection Problems**
```bash
# Test WebSocket connection
node -e "
const ws = require('ws');
const client = new ws('ws://localhost:3000');
client.on('open', () => console.log('Connected'));
client.on('error', console.error);
"
```

### Logs and Debugging
```bash
# Docker logs
docker-compose logs -f starforge

# Health check
curl https://your-app.onrender.com/api/health

# Metrics
curl https://your-app.onrender.com/metrics

# Enable debug mode
NODE_ENV=development npm start
```

## 📈 Scaling

### Horizontal Scaling
For high traffic, consider:
1. **Load Balancer**: Multiple server instances behind nginx
2. **Database**: Move to PostgreSQL with connection pooling
3. **Session Store**: Redis for shared sessions
4. **CDN**: CloudFlare for static assets

### Performance Optimization
- Enable gzip compression (nginx)
- Use Redis for session storage
- Database query optimization
- Static asset caching
- WebSocket connection pooling

## 🔄 Updates and Maintenance

### Zero-Downtime Deployment
```bash
# Using docker-compose
docker-compose pull
docker-compose up -d --no-deps starforge

# Health check after deployment
sleep 30
curl -f http://localhost:3000/api/health
```

### Database Migrations
```bash
# Backup before updates
npm run backup

# Run any migration scripts
node scripts/migrate.js

# Verify deployment
npm run health-check
```

## 📞 Support

For deployment issues:
1. Check the health endpoint: `/api/health`
2. Review application logs
3. Verify environment variables
4. Test database connectivity
5. Check network/firewall settings

The CI/CD pipeline will automatically test and deploy changes when you push to the main branch.