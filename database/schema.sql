-- CS Skin Intelligence Platform - PostgreSQL Schema
-- Complete relational database design for professional trading platform

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    steam_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    email VARCHAR(255),
    account_level INT DEFAULT 0,
    is_premium BOOLEAN DEFAULT FALSE,
    steam_balance DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'dark',
    currency VARCHAR(10) DEFAULT 'USD',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_alerts BOOLEAN DEFAULT FALSE,
    price_alert_threshold DECIMAL(5, 2) DEFAULT 5.0,
    high_volume_alert BOOLEAN DEFAULT TRUE,
    arbitrage_alert BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- SKIN METADATA
-- ============================================================================

CREATE TABLE skins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL UNIQUE,
    weapon_name VARCHAR(255) NOT NULL,
    skin_name VARCHAR(255) NOT NULL,
    rarity VARCHAR(50) NOT NULL, -- Covert, Classified, Restricted, etc.
    case_name VARCHAR(255),
    case_origin VARCHAR(255),
    release_date DATE,
    min_float DECIMAL(8, 6) DEFAULT 0,
    max_float DECIMAL(8, 6) DEFAULT 1,
    has_souvenir BOOLEAN DEFAULT FALSE,
    is_knife BOOLEAN DEFAULT FALSE,
    is_glove BOOLEAN DEFAULT FALSE,
    is_agent BOOLEAN DEFAULT FALSE,
    sticker_support BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE float_distributions (
    id SERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    float_min DECIMAL(8, 6),
    float_max DECIMAL(8, 6),
    count INT DEFAULT 0,
    percentage DECIMAL(5, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MARKET DATA
-- ============================================================================

CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- 'steam', 'buff163', 'skinport', 'csfloat'
    display_name VARCHAR(150),
    api_url TEXT,
    fee_percentage DECIMAL(5, 2) DEFAULT 0,
    min_transaction_fee DECIMAL(10, 2) DEFAULT 0,
    max_transaction_fee DECIMAL(10, 2) DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    supports_float BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE market_prices (
    id BIGSERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    quantity INT DEFAULT -1, -- -1 means unlimited
    volume INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_souvenir BOOLEAN DEFAULT FALSE,
    min_float DECIMAL(8, 6),
    max_float DECIMAL(8, 6),
    listing_url TEXT,
    seller_id VARCHAR(255)
);

CREATE TABLE price_history (
    id BIGSERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    volume INT DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,
    is_souvenir BOOLEAN DEFAULT FALSE
);

CREATE TABLE price_history_ohlc (
    id BIGSERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    exterior VARCHAR(50) DEFAULT 'Factory New',
    interval VARCHAR(10) NOT NULL, -- '1h', '4h', '1d', '1w'
    open_price DECIMAL(12, 2) NOT NULL,
    high_price DECIMAL(12, 2) NOT NULL,
    low_price DECIMAL(12, 2) NOT NULL,
    close_price DECIMAL(12, 2) NOT NULL,
    volume INT DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,
    UNIQUE(skin_id, market_id, interval, timestamp)
);

CREATE TABLE price_statistics (
    id SERIAL PRIMARY KEY,
    skin_id INT NOT NULL UNIQUE REFERENCES skins(id) ON DELETE CASCADE,
    avg_price_7d DECIMAL(12, 2),
    avg_price_30d DECIMAL(12, 2),
    min_price_7d DECIMAL(12, 2),
    max_price_7d DECIMAL(12, 2),
    min_price_30d DECIMAL(12, 2),
    max_price_30d DECIMAL(12, 2),
    price_volatility DECIMAL(5, 2), -- 0-100
    trading_volume_7d INT DEFAULT 0,
    trading_volume_30d INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AI SCORING & ANALYSIS
-- ============================================================================

CREATE TABLE opportunity_scores (
    id SERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    overall_score DECIMAL(5, 2) NOT NULL, -- 0-100
    undervaluation_score DECIMAL(5, 2), -- 0-100
    volume_trend_score DECIMAL(5, 2), -- 0-100
    rarity_weight_score DECIMAL(5, 2), -- 0-100
    case_popularity_score DECIMAL(5, 2), -- 0-100
    float_rarity_score DECIMAL(5, 2), -- 0-100
    recommendation VARCHAR(50), -- 'strong_buy', 'buy', 'neutral', 'sell', 'avoid'
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE price_predictions (
    id SERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    predicted_price DECIMAL(12, 2) NOT NULL,
    confidence_score DECIMAL(5, 2), -- 0-100
    trend_direction VARCHAR(50), -- 'up', 'down', 'stable'
    prediction_strength VARCHAR(50), -- 'strong', 'moderate', 'weak'
    moving_avg_7d DECIMAL(12, 2),
    moving_avg_30d DECIMAL(12, 2),
    volatility_forecast DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculated_at TIMESTAMP
);

CREATE TABLE market_analysis (
    id SERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    average_price DECIMAL(12, 2),
    lowest_price DECIMAL(12, 2),
    highest_price DECIMAL(12, 2),
    avg_volume INT DEFAULT 0,
    market_cap DECIMAL(15, 2),
    demand_index DECIMAL(5, 2), -- 0-100
    supply_index DECIMAL(5, 2), -- 0-100
    liquidity_rating VARCHAR(50), -- 'high', 'medium', 'low'
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ARBITRAGE OPPORTUNITIES
-- ============================================================================

CREATE TABLE arbitrage_opportunities (
    id BIGSERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    source_market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    target_market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    buy_price DECIMAL(12, 2) NOT NULL,
    sell_price DECIMAL(12, 2) NOT NULL,
    gross_profit DECIMAL(12, 2) NOT NULL,
    fee_cost DECIMAL(12, 2) NOT NULL,
    net_profit DECIMAL(12, 2) NOT NULL,
    profit_margin DECIMAL(5, 2) NOT NULL, -- Percentage
    roi DECIMAL(5, 2) NOT NULL, -- Return on investment %
    exterior VARCHAR(50), -- 'Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'
    buy_link TEXT,
    sell_link TEXT,
    liquidity_score DECIMAL(5, 2), -- 0-100
    risk_level VARCHAR(50), -- 'low', 'medium', 'high'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    executed_by INT REFERENCES users(id),
    executed_at TIMESTAMP
);

-- ============================================================================
-- USER PORTFOLIOS
-- ============================================================================

CREATE TABLE portfolios (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    steam_inventory_id VARCHAR(255),
    total_value DECIMAL(12, 2) DEFAULT 0,
    total_invested DECIMAL(12, 2) DEFAULT 0,
    total_profit DECIMAL(12, 2) DEFAULT 0,
    profit_percentage DECIMAL(5, 2) DEFAULT 0,
    total_items INT DEFAULT 0,
    last_imported TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE portfolio_items (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id INT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    purchase_price DECIMAL(12, 2) NOT NULL,
    current_price DECIMAL(12, 2),
    float_value DECIMAL(8, 6),
    condition VARCHAR(50), -- 'FN', 'MW', 'FT', 'WW', 'BS'
    is_souvenir BOOLEAN DEFAULT FALSE,
    purchase_date TIMESTAMP,
    stickers JSONB,
    notes TEXT,
    profit DECIMAL(12, 2),
    profit_percentage DECIMAL(5, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    portfolio_id INT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    total_value DECIMAL(12, 2),
    total_profit DECIMAL(12, 2),
    item_count INT,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- WATCHLISTS & ALERTS
-- ============================================================================

CREATE TABLE watchlists (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE watchlist_items (
    id SERIAL PRIMARY KEY,
    watchlist_id INT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    target_price DECIMAL(12, 2),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- 'price_drop', 'price_rise', 'high_opportunity', 'arbitrage'
    trigger_condition VARCHAR(255) NOT NULL,
    trigger_value DECIMAL(12, 2),
    is_active BOOLEAN DEFAULT TRUE,
    send_email BOOLEAN DEFAULT FALSE,
    send_push BOOLEAN DEFAULT FALSE,
    last_triggered TIMESTAMP,
    trigger_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alert_history (
    id BIGSERIAL PRIMARY KEY,
    alert_id INT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    skin_id INT REFERENCES skins(id),
    alert_value DECIMAL(12, 2),
    user_notified BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- TRADES & TRANSACTIONS
-- ============================================================================

CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    trade_type VARCHAR(50) NOT NULL, -- 'buy', 'sell'
    market_id INT REFERENCES markets(id),
    quantity INT NOT NULL DEFAULT 1,
    price_per_unit DECIMAL(12, 2) NOT NULL,
    total_value DECIMAL(12, 2) NOT NULL,
    fee DECIMAL(12, 2) DEFAULT 0,
    net_value DECIMAL(12, 2),
    trade_status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    trade_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE trade_history (
    id BIGSERIAL PRIMARY KEY,
    trade_id BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    status_change VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ANALYTICS & INSIGHTS
-- ============================================================================

CREATE TABLE market_trends (
    id SERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    trend_period VARCHAR(50), -- '24h', '7d', '30d'
    trend_direction VARCHAR(50), -- 'up', 'down', 'stable'
    trend_strength VARCHAR(50), -- 'strong', 'moderate', 'weak'
    momentum_score DECIMAL(5, 2),
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE case_performance (
    id SERIAL PRIMARY KEY,
    case_name VARCHAR(255) NOT NULL,
    avg_skin_price DECIMAL(12, 2),
    total_supply INT,
    demand_level VARCHAR(50),
    performance_score DECIMAL(5, 2), -- 0-100
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100), -- 'view_skin', 'add_watchlist', 'execute_trade'
    skin_id INT REFERENCES skins(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM & AUDIT
-- ============================================================================

CREATE TABLE api_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INT,
    response_time INT, -- milliseconds
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255),
    metric_value DECIMAL(15, 2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_steam_id ON users(steam_id);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);

-- Skins
CREATE INDEX idx_skins_name ON skins(name);
CREATE INDEX idx_skins_weapon ON skins(weapon_name);
CREATE INDEX idx_skins_rarity ON skins(rarity);

-- Market Prices (CRITICAL)
CREATE INDEX idx_market_prices_skin_id ON market_prices(skin_id);
CREATE INDEX idx_market_prices_market_id ON market_prices(market_id);
CREATE INDEX idx_market_prices_composite ON market_prices(skin_id, market_id, last_updated);
CREATE INDEX idx_market_prices_timestamp ON market_prices(last_updated DESC);

-- Price History
CREATE INDEX idx_price_history_skin_id ON price_history(skin_id);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp DESC);
CREATE INDEX idx_price_history_composite ON price_history(skin_id, timestamp DESC);

-- Price History OHLC (Candlestick)
CREATE INDEX idx_price_history_ohlc_composite ON price_history_ohlc(skin_id, market_id, interval, timestamp DESC);
CREATE INDEX idx_price_history_ohlc_interval ON price_history_ohlc(interval, timestamp DESC);
CREATE INDEX idx_price_history_ohlc_skin_interval ON price_history_ohlc(skin_id, interval, timestamp DESC);

-- Opportunity Scores
CREATE INDEX idx_opportunity_scores_skin_id ON opportunity_scores(skin_id);
CREATE INDEX idx_opportunity_scores_overall ON opportunity_scores(overall_score DESC);
CREATE INDEX idx_opportunity_scores_expires ON opportunity_scores(expires_at);

-- Arbitrage Opportunities
CREATE INDEX idx_arbitrage_opportunities_skin_id ON arbitrage_opportunities(skin_id);
CREATE INDEX idx_arbitrage_opportunities_profit ON arbitrage_opportunities(profit_margin DESC);
CREATE INDEX idx_arbitrage_opportunities_active ON arbitrage_opportunities(is_active, created_at DESC);
CREATE INDEX idx_arbitrage_opportunities_expires ON arbitrage_opportunities(expires_at);

-- Portfolios
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_portfolio_items_portfolio_id ON portfolio_items(portfolio_id);
CREATE INDEX idx_portfolio_items_skin_id ON portfolio_items(skin_id);

-- Watchlists
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

-- Alerts
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_skin_id ON alerts(skin_id);
CREATE INDEX idx_alerts_active ON alerts(is_active, user_id);
CREATE INDEX idx_alert_history_alert_id ON alert_history(alert_id);
CREATE INDEX idx_alert_history_timestamp ON alert_history(triggered_at DESC);

-- Trades
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_skin_id ON trades(skin_id);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_status ON trades(trade_status);

-- Activity
CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);

-- Logging
CREATE INDEX idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at DESC);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

CREATE MATERIALIZED VIEW market_leaderboard AS
SELECT 
    s.id,
    s.name,
    AVG(os.overall_score) as avg_opportunity_score,
    COUNT(t.id) as trade_count,
    SUM(CASE WHEN t.trade_type = 'buy' THEN 1 ELSE 0 END) as buy_count,
    AVG(mp.price) as current_avg_price
FROM skins s
LEFT JOIN opportunity_scores os ON s.id = os.skin_id
LEFT JOIN trades t ON s.id = t.skin_id
LEFT JOIN market_prices mp ON s.id = mp.skin_id
GROUP BY s.id, s.name
ORDER BY avg_opportunity_score DESC;

CREATE INDEX idx_market_leaderboard_score ON market_leaderboard(avg_opportunity_score DESC);

CREATE MATERIALIZED VIEW user_portfolio_performance AS
SELECT 
    p.user_id,
    p.id as portfolio_id,
    SUM(pi.quantity) as total_items,
    SUM(pi.current_price * pi.quantity) as total_current_value,
    SUM(pi.purchase_price * pi.quantity) as total_invested,
    SUM(pi.profit * pi.quantity) as total_profit,
    (SUM(pi.profit * pi.quantity) / NULLIF(SUM(pi.purchase_price * pi.quantity), 0)) * 100 as roi_percentage
FROM portfolios p
LEFT JOIN portfolio_items pi ON p.id = pi.portfolio_id
GROUP BY p.user_id, p.id;

-- ============================================================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_portfolio_value()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE portfolios
    SET total_value = (
        SELECT COALESCE(SUM(quantity * current_price), 0)
        FROM portfolio_items
        WHERE portfolio_id = NEW.portfolio_id
    ),
    last_updated = CURRENT_TIMESTAMP
    WHERE id = NEW.portfolio_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_portfolio_value
AFTER INSERT OR UPDATE ON portfolio_items
FOR EACH ROW
EXECUTE FUNCTION update_portfolio_value();

CREATE OR REPLACE FUNCTION create_price_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO price_history (skin_id, market_id, price, currency, volume, timestamp, is_souvenir)
    VALUES (NEW.skin_id, NEW.market_id, NEW.price, NEW.currency, NEW.volume, CURRENT_TIMESTAMP, NEW.is_souvenir);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_price_history
AFTER UPDATE ON market_prices
FOR EACH ROW
WHEN (NEW.price IS DISTINCT FROM OLD.price)
EXECUTE FUNCTION create_price_history();

CREATE TRIGGER trigger_create_price_history_insert
AFTER INSERT ON market_prices
FOR EACH ROW
EXECUTE FUNCTION create_price_history();

-- ============================================================================
-- INITIAL DATA (Optional seed data)
-- ============================================================================

INSERT INTO markets (name, display_name, fee_percentage) VALUES
('steam', 'Steam Community Market', 13),
('buff163', 'Buff163', 5),
('skinport', 'Skinport', 10),
('csfloat', 'CSFloat', 3);
