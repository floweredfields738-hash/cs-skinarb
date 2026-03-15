# CS Skin Intelligence Platform

A professional-grade Bloomberg Terminal clone for Counter-Strike: Global Offensive skin trading. Built with React, TypeScript, Node.js, PostgreSQL, and advanced AI engines for real-time market analytics.

## 🎯 Features

### Real-Time Market Data
- Live price feeds from 4 markets (Steam, Buff163, Skinport, CSGOFloat)
- 5-minute market data synchronization
- Historical price tracking (90 days)
- Volume and trend analysis

### AI-Powered Analytics
- **Opportunity Scoring**: Weighted algorithm (0-100 scale) evaluating undervaluation, volume trends, rarity, and float conditions
- **Arbitrage Detection**: Cross-market price comparison with liquidity scoring and risk assessment
- **Price Prediction**: ML-based forecasting using moving averages, volatility, and trend analysis

### Professional Features
- Real-time WebSocket updates
- Portfolio management and tracking
- Watchlist management with alerts
- Multi-market arbitrage detection
- Detailed skin analytics and history
- User-specific alert system

## 🏗️ Architecture

```
cs-skin-intelligence-platform/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── api/routes/     # REST API endpoints
│   │   ├── engines/        # AI engines
│   │   ├── middleware/     # Auth, logging, errors
│   │   ├── utils/          # Database, cache, WebSocket
│   │   ├── app.ts          # Express setup
│   │   └── server.ts       # Server entry point
│   └── package.json
├── frontend/               # React + TypeScript
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── store/         # Redux state management
│   │   ├── styles/        # Tailwind CSS
│   │   └── App.tsx        # Main App component
│   └── package.json
├── scripts/               # Background jobs
│   ├── market-sync/       # Market data fetcher
│   └── data-processors/   # AI engine triggers
├── database/              # PostgreSQL schema
├── docker-compose.yml    # Docker orchestration
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (optional)
- PostgreSQL 15+ (local) or Docker
- Redis (local) or Docker

### Local Development

1. **Clone and setup**
```bash
cd cs-skin-intelligence-platform

# Copy environment variables
cp .env.example .env

# Update .env with your configuration
```

2. **Backend setup**
```bash
cd backend
npm install
npm run build

# Start development server
npm run dev
```

3. **Database setup**
```bash
# Create database and run migrations
npm run migrate

# Load sample data (optional)
npm run seed
```

4. **Market sync job**
```bash
# In another terminal
cd scripts/market-sync
npm run sync
```

5. **Frontend setup**
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Docker Deployment

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## 🔧 Environment Variables

See `.env.example` for all available options. Key variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# Steam OAuth
STEAM_API_KEY=your-key
STEAM_REALM=http://localhost:5000

# Frontend
FRONTEND_URL=http://localhost:3000

# Data Sync
MARKET_SYNC_INTERVAL=300000    # 5 minutes
DATA_PROCESSING_INTERVAL=600000 # 10 minutes
```

## 📊 API Endpoints

### Public (No Auth)
- `GET /api/skins` - Browse all skins
- `GET /api/skins/:id` - Skin details
- `GET /api/market/prices` - Market prices
- `GET /api/market/trends` - Market trends
- `POST /api/auth/steam` - Steam login

### Protected (Auth Required)
- `GET /api/portfolio` - User portfolio
- `POST /api/portfolio/items/add` - Add item
- `GET /api/arbitrage` - Arbitrage opportunities
- `GET /api/alerts` - User alerts
- `POST /api/alerts` - Create alert

## 🤖 AI Engines

### Opportunity Score (0-100)
```
Score = (Undervaluation × 0.35) + (Volume × 0.20) + (Rarity × 0.15) 
       + (Case × 0.15) + (Float × 0.15)
```

**Recommendations:**
- ≥75: Strong Buy
- ≥60: Buy
- ≥40: Neutral
- ≥20: Sell
- <20: Avoid

### Arbitrage Detection
- Cross-market price comparison (Steam, Buff163, Skinport, CSGOFloat)
- Fee calculations per market (Steam 13%, Buff 5%, Skinport 10%, CSGOFloat 3%)
- Liquidity scoring (0-100)
- Risk assessment (Low/Medium/High)
- 10-minute opportunity window

### Price Prediction
- Moving averages (7-day, 30-day)
- Volatility calculation (std deviation)
- Trend analysis (direction + strength)
- Confidence scoring (20-95%)

## 📈 Database Schema

**Core Tables:**
- `users` - User accounts
- `skins` - Skin metadata
- `market_prices` - Multi-market prices
- `price_history` - Historical prices
- `portfolios` - User portfolios
- `portfolio_items` - Portfolio holdings
- `arbitrage_opportunities` - Current opportunities
- `price_alerts` - User-defined alerts
- `watchlists` - User watchlists

**Optimizations:**
- 30+ strategic indexes
- Materialized views for analytics
- Triggers for automatic updates
- Connection pooling (20 max)

## 🔐 Security

- Steam OAuth 2.0 authentication
- JWT tokens (7-day expiry)
- Refresh token rotation (30-day)
- Rate limiting (100 req/15min general, 30 req/1min API)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Helmet.js security headers
- HTTPS ready (Docker Nginx config)

## 📦 Deployment

### Production Docker
```bash
# With nginx reverse proxy
docker-compose --profile production up -d
```

### Kubernetes
```bash
# Using Terraform for infrastructure
cd deploy/terraform
terraform apply

# Deploy with Helm
helm install cs-skin-platform ./deploy/helm
```

### Environment-Specific
- `NODE_ENV=production` - Enables production optimizations
- Enable HTTPS with SSL certificates
- Configure Steam OAuth redirect URLs
- Set strong JWT secrets
- Use environment-specific databases

## 📊 Performance

- **Sub-second response times** for market data queries (indexed)
- **Real-time updates** via WebSocket (500ms latency)
- **1000+ concurrent users** with connection pooling
- **10K+ skins handled** efficiently with pagination
- **Redis caching** with 1-hour TTL for common queries
- **Lazy loading** of historical data

## 🧪 Testing

```bash
cd backend
npm test                  # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

cd frontend
npm test                # Jest tests
```

## 📝 Development

### Code Style
- TScript strict mode enabled
- ESLint configuration provided
- Prettier formatting
- Pre-commit hooks

```bash
# Lint
npm run lint

# Format
npm run format
```

### Logging

Winston logger with:
- 4 levels: error, warn, info, debug
- File output: `logs/error.log`, `logs/combined.log`
- Console output with colors
- Request timing and duration

## 🔄 Data Flow

1. **Market Data Sync** (every 5 min)
   - Fetch from 4 markets → Store in DB → Update statistics

2. **Data Processing** (every 10 min)
   - Calculate opportunity scores
   - Detect arbitrage opportunities
   - Generate price predictions

3. **Real-Time Updates**
   - WebSocket broadcasts to connected clients
   - User alerts triggered
   - Cache invalidation

## 📚 Documentation

- `ARCHITECTURE.md` - System design (2,850 lines)
- `database/schema.sql` - Schema with comments
- API documentation via JSDoc
- Inline code comments for complex logic

## 🐛 Troubleshooting

**Database connection fails:**
- Ensure PostgreSQL is running
- Check DATABASE_URL environment variable
- Verify credentials in .env

**Redis connection fails:**
- Ensure Redis is running on localhost:6379
- Check REDIS_HOST and REDIS_PORT

**Market data not syncing:**
- Check STEAM_API_KEY is set
- Review logs: `docker-compose logs backend`
- Verify market API endpoints are accessible

**Frontend can't reach API:**
- Check backend is running on port 5000
- Verify FRONTEND_URL in backend .env
- Check VITE_API_URL in frontend .env

## 📄 License

Proprietary - Built for professional CS:GO traders

## 🤝 Support

For issues and questions:
1. Check ARCHITECTURE.md for system design
2. Review logs in `logs/` directory
3. Verify environment configuration

---

Built with ❤️ for serious CS:GO traders
