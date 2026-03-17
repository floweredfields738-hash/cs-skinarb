// Generic CSV export utility

export function exportToCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return;

  // Auto-detect columns if not provided
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

  // Build CSV header
  const header = cols.map(c => `"${c.label}"`).join(',');

  // Build rows
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Pre-configured exports ──────────────────────────

export function exportArbitrage(opportunities: any[]) {
  exportToCSV(opportunities.map(o => ({
    skin: o.skin_name || o.name,
    exterior: o.exterior || '',
    buy_market: o.source_market,
    sell_market: o.target_market,
    buy_price: parseFloat(o.buy_price).toFixed(2),
    sell_price: parseFloat(o.sell_price).toFixed(2),
    net_profit: parseFloat(o.net_profit).toFixed(2),
    roi_percent: parseFloat(o.roi).toFixed(1),
    confidence: o.confidence || '',
    risk: o.risk_level,
    buy_link: o.buy_link || '',
    sell_link: o.sell_link || '',
  })), 'cskinarb_arbitrage', [
    { key: 'skin', label: 'Skin' },
    { key: 'exterior', label: 'Exterior' },
    { key: 'buy_market', label: 'Buy Market' },
    { key: 'sell_market', label: 'Sell Market' },
    { key: 'buy_price', label: 'Buy Price ($)' },
    { key: 'sell_price', label: 'Sell Price ($)' },
    { key: 'net_profit', label: 'Net Profit ($)' },
    { key: 'roi_percent', label: 'ROI (%)' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'risk', label: 'Risk' },
    { key: 'buy_link', label: 'Buy Link' },
    { key: 'sell_link', label: 'Sell Link' },
  ]);
}

export function exportTrades(trades: any[]) {
  exportToCSV(trades.map(t => ({
    date: new Date(t.created_at).toLocaleDateString(),
    type: t.trade_type,
    skin: t.skin_name,
    quantity: t.quantity,
    price: parseFloat(t.price_per_unit).toFixed(2),
    fee: parseFloat(t.fee).toFixed(2),
    net: parseFloat(t.net_value).toFixed(2),
    market: t.market_name || '',
    notes: t.notes || '',
  })), 'cskinarb_trades', [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'skin', label: 'Skin' },
    { key: 'quantity', label: 'Qty' },
    { key: 'price', label: 'Price ($)' },
    { key: 'fee', label: 'Fee ($)' },
    { key: 'net', label: 'Net ($)' },
    { key: 'market', label: 'Market' },
    { key: 'notes', label: 'Notes' },
  ]);
}

export function exportInventory(items: any[]) {
  exportToCSV(items.map(i => ({
    name: i.name || i.market_hash_name,
    exterior: i.exterior || '',
    rarity: i.rarity || '',
    quantity: i.quantity,
    price: i.market_price ? i.market_price.toFixed(2) : '',
    total_value: i.total_value ? i.total_value.toFixed(2) : '',
    tradable: i.tradable ? 'Yes' : 'No',
  })), 'cskinarb_inventory', [
    { key: 'name', label: 'Name' },
    { key: 'exterior', label: 'Exterior' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'quantity', label: 'Qty' },
    { key: 'price', label: 'Price ($)' },
    { key: 'total_value', label: 'Total Value ($)' },
    { key: 'tradable', label: 'Tradable' },
  ]);
}

export function exportWatchlist(items: any[]) {
  exportToCSV(items.map(i => ({
    name: i.name || i.skin_name,
    price: i.current_price ? parseFloat(i.current_price).toFixed(2) : '',
    target: i.target_price ? parseFloat(i.target_price).toFixed(2) : '',
  })), 'cskinarb_watchlist', [
    { key: 'name', label: 'Skin' },
    { key: 'price', label: 'Current Price ($)' },
    { key: 'target', label: 'Target Price ($)' },
  ]);
}
