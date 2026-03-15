-- Migration: Create price_history_ohlc table for candlestick chart data
-- Run this on the live database to add OHLC support

CREATE TABLE IF NOT EXISTS price_history_ohlc (
    id BIGSERIAL PRIMARY KEY,
    skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    exterior VARCHAR(50) DEFAULT 'Factory New',
    interval VARCHAR(10) NOT NULL,
    open_price DECIMAL(12, 2) NOT NULL,
    high_price DECIMAL(12, 2) NOT NULL,
    low_price DECIMAL(12, 2) NOT NULL,
    close_price DECIMAL(12, 2) NOT NULL,
    volume INT DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,
    UNIQUE(skin_id, market_id, interval, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_composite
  ON price_history_ohlc(skin_id, market_id, interval, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_interval
  ON price_history_ohlc(interval, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_skin_interval
  ON price_history_ohlc(skin_id, interval, timestamp DESC);
