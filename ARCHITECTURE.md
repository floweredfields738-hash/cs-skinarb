# CS Skin Intelligence Platform - Architecture

## 🏗️ Complete Production Architecture

### Project Overview
**Bloomberg Terminal for CS:GO Skins** - Enterprise-grade SaaS platform for professional traders

Real-time analytics, arbitrage detection, AI predictions, portfolio tracking.

---

## 📁 Project Structure

```
cs-skin-intelligence-platform/
│
├── frontend/                          # React + TypeScript + TailwindCSS
│   ├── components/
│   │   ├── dashboard/                 # Dashboard layouts
│   │   │   ├── MarketOverview.tsx
│   │   │   ├── AIPicksList.tsx
│   │   │   ├── ArbitrageGrid.tsx
│   │   │   ├── PortfolioSummary.tsx
│   │   │   └── LiveFeed.tsx
│   │   ├── charts/                    # Chart.js visualizations
│   │   │   ├── PriceChart.tsx
│   │   │   ├── VolumeChart.tsx
│   │   │   ├── FloatDistribution.tsx
│   │   │   └── ProfitChart.tsx
│   │   └── common/                    # Reusable components
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Card.tsx
│   │       ├── Button.tsx
│   │       └── Modal.tsx
│   ├── pages/
│   │   ├── dashboard.tsx              # Main dashboard
│   │   ├── skin-detail.tsx            # Individual skin analysis
│   │   ├── portfolio.tsx              # User inventory
│   │   ├── watchlist.tsx              # Tracked items
│   │   ├── arbitrage.tsx              # Arbitrage opportunities
│   │   └── settings.tsx               # User preferences
│   ├── hooks/
│   │   ├── useMarketData.ts           # Fetch market prices
│   │   ├── useWebSocket.ts            # Real-time updates
│   │   ├── useAuth.ts                 # Authentication
│   │   ├── useAnimation.ts            # Scroll animations
│   │   └── useCache.ts                # Client caching
│   ├── styles/
│   │   ├── globals.css                # Global styles
│   │   ├── animations.css             # Scroll animations
│   │   ├── theme.css                  # Design tokens
│   │   └── components.css             # Component styles
│   ├── utils/
│   │   ├── api.ts                     # API client
│   │   ├── formatters.ts              # Data formatting
│   │   ├── calculations.ts            # Math utilities
│   │   └── validators.ts              # Input validation
│   ├── App.tsx                        # Root component
│   ├── index.tsx                      # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── backend/                           # Node.js + Express
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── skins.ts           # Skin endpoints
│   │   │   │   ├── market.ts          # Market data endpoints
│   │   │   │   ├── portfolio.ts       # Portfolio endpoints
│   │   │   │   ├── arbitrage.ts       # Arbitrage endpoints
│   │   │   │   ├── auth.ts            # Auth endpoints
│   │   │   │   └── alerts.ts          # Alert endpoints
│   │   │   └── index.ts               # API router setup
│   │   ├── services/
│   │   │   ├── steamService.ts        # Steam OAuth & inventory
│   │   │   ├── marketService.ts       # Market data aggregation
│   │   │   ├── priceService.ts        # Price calculations
│   │   │   ├── portfolioService.ts    # Portfolio management
│   │   │   └── alertService.ts        # Alert management
│   │   ├── engines/
│   │   │   ├── opportunityEngine.ts   # AI scoring algorithm
│   │   │   ├── arbitrageEngine.ts     # Arbitrage detection
│   │   │   ├── predictionEngine.ts    # Price predictions
│   │   │   └── marketAnalyzer.ts      # Market analysis
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Skin.ts
│   │   │   ├── MarketPrice.ts
│   │   │   ├── Portfolio.ts
│   │   │   └── ArbitrageOpportunity.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts                # Auth middleware
│   │   │   ├── errorHandler.ts        # Error handling
│   │   │   ├── rateLimit.ts           # Rate limiting
│   │   │   ├── logging.ts             # Request logging
│   │   │   └── validation.ts          # Input validation
│   │   ├── utils/
│   │   │   ├── database.ts            # DB connection
│   │   │   ├── cache.ts               # Redis utilities
│   │   │   ├── websocket.ts           # WebSocket server
│   │   │   ├── logging.ts             # Logging setup
│   │   │   └── errors.ts              # Custom errors
│   │   ├── app.ts                     # Express app setup
│   │   └── server.ts                  # Server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── database/
│   ├── schema.sql                     # Full database schema
│   ├── seeds.sql                      # Initial data
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_add_ai_scores.sql
│       ├── 003_add_price_history.sql
│       └── 004_add_indices.sql
│
├── scripts/
│   ├── market-sync/
│   │   ├── market-data-sync.js        # Fetch & sync prices (5min interval)
│   │   ├── steam-market-fetcher.js    # Steam data
│   │   ├── buff163-fetcher.js         # Buff163 data
│   │   ├── skinport-fetcher.js        # Skinport data
│   │   └── csfloat-fetcher.js         # CSFloat data
│   ├── data-processors/
│   │   ├── normalize-prices.js        # Normalize across markets
│   │   ├── calculate-scores.js        # AI opportunity scoring
│   │   ├── detect-arbitrage.js        # Find arbitrage
│   │   └── predict-prices.js          # Price predictions
│   └── maintenance/
│       ├── cleanup-old-data.js        # Data retention
│       ├── recalculate-indices.js     # DB optimization
│       └── backup.js                  # Database backup
│
├── config/
│   ├── database.ts                    # DB config
│   ├── cache.ts                       # Redis config
│   ├── api-keys.ts                    # API key management
│   └── constants.ts                   # App constants
│
├── deploy/
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.postgres
│   │   ├── Dockerfile.redis
│   │   └── docker-compose.yml
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── ssl.conf
│   ├── kubernetes/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── docs/
│   ├── API.md                         # API documentation
│   ├── DEPLOYMENT.md                  # Deployment guide
│   ├── DEVELOPMENT.md                 # Dev setup
│   └── ARCHITECTURE.md                # This file
│
├── package.json                       # Root package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔧 Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Chart.js** - Data visualization
- **Redux** - State management
- **Axios** - HTTP client
- **Socket.io-client** - WebSockets

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Relational database
- **Redis** - Caching & real-time
- **Socket.io** - WebSocket server
- **Bull** - Job queue

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Local dev
- **Kubernetes** - Production orchestration
- **Nginx** - Reverse proxy
- **GitHub Actions** - CI/CD

---

## 📊 Database Architecture

### Core Tables
1. **users** - User accounts & profiles
2. **skins** - Skin metadata
3. **market_prices** - Current prices across markets
4. **price_history** - Historical price data
5. **float_data** - Float value distributions
6. **trades** - Historical trades
7. **portfolios** - User inventories
8. **portfolio_items** - Items in portfolios
9. **arbitrage_opportunities** - Detected opportunities
10. **watchlists** - User watchlists
11. **alerts** - User alerts & triggers
12. **ai_scores** - AI opportunity scores

### Indexing Strategy
- All foreign keys indexed
- Market prices: (skin_id, market_name, timestamp)
- Price history: (skin_id, date)
- Portfolios: (user_id, created_at)
- Arbitrage opportunities: (profit_margin, created_at)

---

## 🔌 API Architecture

### REST Endpoints

**Authentication**
- POST /api/auth/steam - Steam OAuth
- POST /api/auth/logout
- GET /api/auth/me - Current user

**Skins**
- GET /api/skins - List skins
- GET /api/skins/:id - Skin details
- GET /api/skins/:id/history - Price history
- GET /api/skins/:id/analysis - AI analysis

**Market**
- GET /api/market/prices - Current prices
- GET /api/market/trends - Market trends
- GET /api/market/leaders - Top performers
- GET /api/market/heatmap - Market heatmap

**Portfolio**
- GET /api/portfolio - User inventory
- POST /api/portfolio/import - Import from Steam
- GET /api/portfolio/analysis - Portfolio analysis
- PATCH /api/portfolio/:itemId - Update item

**Arbitrage**
- GET /api/arbitrage - Active opportunities
- GET /api/arbitrage/:id - Opportunity details
- POST /api/arbitrage/:id/execute - Action logging

**Alerts**
- GET /api/alerts - User alerts
- POST /api/alerts - Create alert
- DELETE /api/alerts/:id - Delete alert

### WebSocket Events
- `market:price-update` - Price changes
- `market:trend-change` - New trends
- `arbitrage:new` - New opportunities
- `portfolio:update` - Portfolio changes
- `alert:trigger` - Alert fired

---

## 🤖 AI Engines

### 1. Opportunity Scoring Engine
Calculates opportunity score 0-100 based on:
- Undervaluation (35%)
- Volume trend (20%)
- Rarity weight (15%)
- Case popularity (15%)
- Float rarity (15%)

### 2. Arbitrage Detection
Compares prices across markets:
- Steam Market
- Buff163
- Skinport
- CSFloat

Factors in:
- Transaction fees
- Liquidity
- Profit margins

### 3. Price Prediction Model
Generates predictions using:
- 7-day moving average
- 30-day trend analysis
- Volatility measurement
- Seasonal patterns
- Volume correlation

Output: Strong Buy / Buy / Neutral / Sell / Overvalued + confidence score

---

## 🔄 Data Flow

```
Market Data Sources
    ↓
Market Sync Service (5-minute interval)
    ↓
Normalize & Store in PostgreSQL
    ↓
Calculate AI Scores
    ↓
Detect Arbitrage Opportunities
    ↓
Run Price Predictions
    ↓
Store Results
    ↓
Broadcast via WebSocket
    ↓
Frontend Real-time Updates
```

---

## 🔐 Security Architecture

### Authentication
- Steam OAuth 2.0
- JWT tokens
- Refresh token rotation
- CORS protection

### Data Protection
- SSL/TLS encryption
- SQL injection prevention
- Rate limiting
- Input validation
- CSRF protection

### API Security
- API key validation
- Rate limiting (100 req/min per user)
- Request signing
- Audit logging

---

## 📈 Performance Targets

- Dashboard load: <1s
- Price update latency: <500ms
- Database query: <100ms
- WebSocket broadcast: <200ms
- Mobile responsiveness: <2s

### Optimization Strategies
1. Redis caching on all market data
2. Database indexing on hot queries
3. Pagination (1000 items max per request)
4. GraphQL batch queries
5. Image optimization
6. CDN for static assets
7. Connection pooling

---

## 🚀 Deployment Architecture

### Local Development
- Docker Compose with all services
- Hot reload
- Postgres without persistence
- Redis in-memory

### Staging
- Kubernetes cluster
- SSL certificates
- Persistent storage
- Health checks

### Production
- Multi-region deployment
- Load balancing
- Auto-scaling
- Monitoring & alerts
- Backup strategy

---

## 📊 Monitoring & Analytics

### Application Metrics
- Request latency
- Error rates
- Cache hit ratios
- Database connections
- WebSocket connections

### Business Metrics
- Active users
- Trades executed
- Arbitrage opportunities found
- Revenue

### Tools
- Prometheus for metrics
- Grafana for dashboards
- ELK for logging
- Sentry for error tracking

---

## 📱 Frontend Architecture

### Component Structure
- Atomic design pattern
- Smart/Dumb components
- Custom hooks for logic
- Redux for global state
- Context for themes

### Performance
- Code splitting
- Lazy loading
- Image optimization
- CSS-in-JS optimization
- Virtual scrolling for lists

### Animations
- Framer Motion for complex
- CSS animations for simple
- Intersection Observer for scroll
- GPU-accelerated transforms

---

## 🔄 Real-time Updates

### WebSocket Architecture
- Socket.io for real-time
- Redis pub/sub for message distribution
- Automatic reconnection
- Fallback to polling
- Message queuing

### Update Strategy
1. Market prices update every 5 seconds
2. Arbitrage opportunities checked every minute
3. AI scores recalculated hourly
4. Portfolio values updated on demand
5. Alerts checked in real-time

---

## 📋 Development Workflow

### Version Control
- Git with Github Flow
- Conventional commits
- Branch protection on main
- Code review required

### Testing
- Unit tests (Jest)
- Integration tests (Supertest)
- E2E tests (Cypress)
- Load testing (k6)

### CI/CD
- Automated tests on PR
- Build Docker images
- Deploy to staging
- Manual approval for production
- Automated rollback on failure

---

This architecture is designed for:
✅ **Scalability** - Handle 10,000+ concurrent users
✅ **Reliability** - 99.9% uptime
✅ **Performance** - Sub-second response times
✅ **Security** - Enterprise-grade protection
✅ **Maintainability** - Clean, modular code
✅ **Extensibility** - Easy to add features
