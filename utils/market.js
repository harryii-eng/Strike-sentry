// utils/market.js — Strike Sentry
const { authHeaders } = require('./alpaca');

const DATA_BASE_URL = 'https://data.alpaca.markets';
const TRADING_BASE_URL = process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets';

async function alpacaGet(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Alpaca API error ${res.status}: ${JSON.stringify(body)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function getLatestPrice(symbol) {
  const data = await alpacaGet(DATA_BASE_URL, `/v2/stocks/${symbol}/trades/latest`);
  return data.trade?.p ?? null;
}

async function getOptionExpirations(underlyingSymbol, { minDaysOut = 14, maxDaysOut = 60 } = {}) {
  const today = new Date();
  const gte = new Date(today.getTime() + minDaysOut * 86400000).toISOString().slice(0, 10);
  const lte = new Date(today.getTime() + maxDaysOut * 86400000).toISOString().slice(0, 10);

  const data = await alpacaGet(
    TRADING_BASE_URL,
    `/v2/options/contracts?underlying_symbols=${underlyingSymbol}&expiration_date_gte=${gte}&expiration_date_lte=${lte}&type=put&status=active&limit=100`
  );

  const expirations = [...new Set((data.option_contracts || []).map((c) => c.expiration_date))].sort();
  return expirations;
}

async function getNearestExpiration(underlyingSymbol, opts) {
  const dates = await getOptionExpirations(underlyingSymbol, opts);
  return dates[0] || null;
}

async function getOptionChainSnapshot(underlyingSymbol, { type, strikeGte, strikeLte } = {}) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (strikeGte != null) params.set('strike_price_gte', strikeGte);
  if (strikeLte != null) params.set('strike_price_lte', strikeLte);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await alpacaGet(DATA_BASE_URL, `/v1beta1/options/snapshots/${underlyingSymbol}${qs}`);
  return data.snapshots || {};
}

async function getPremiumEstimate(underlyingSymbol, occSymbol, { type = 'put', strike } = {}) {
  const snapshots = await getOptionChainSnapshot(underlyingSymbol, {
    type,
    strikeGte: strike ? strike - 3 : undefined,
    strikeLte: strike ? strike + 3 : undefined,
  });
  const snap = snapshots[occSymbol];
  if (!snap) return null;
  const bid = snap.latestQuote?.bp;
  const ask = snap.latestQuote?.ap;
  if (bid != null && ask != null) return (bid + ask) / 2;
  return snap.latestTrade?.p ?? null;
}

module.exports = {
  getLatestPrice,
  getOptionExpirations,
  getNearestExpiration,
  getOptionChainSnapshot,
  getPremiumEstimate,
};

// --- Pick a real, quoted contract near a target strike -----------------------
// Avoids the mismatch between /v2/options/contracts (lists ALL active
// contracts, including illiquid ones with no quotes) and the snapshots
// endpoint (only has data for contracts that actually trade).

function parseOccSymbol(occSymbol) {
  const m = occSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const [, ticker, dateStr, typeChar, strikeStr] = m;
  const expiryDate = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
  const strike = parseInt(strikeStr, 10) / 1000;
  return { ticker, expiryDate, type: typeChar === 'P' ? 'put' : 'call', strike };
}

async function findBestPutContract(underlyingSymbol, targetStrike, { strikeWindow = 5 } = {}) {
  const snapshots = await getOptionChainSnapshot(underlyingSymbol, {
    type: 'put',
    strikeGte: targetStrike - strikeWindow,
    strikeLte: targetStrike + strikeWindow,
  });

  const candidates = Object.entries(snapshots)
    .map(([symbol, snap]) => {
      const parsed = parseOccSymbol(symbol);
      if (!parsed) return null;
      const bid = snap.latestQuote?.bp;
      const ask = snap.latestQuote?.ap;
      const premium = (bid != null && ask != null) ? (bid + ask) / 2 : snap.latestTrade?.p;
      if (premium == null) return null; // skip contracts with no real quote
      return { symbol, ...parsed, premium };
    })
    .filter(Boolean);

  if (candidates.length === 0) return null;

  // Prefer the strike closest to target, then the nearest expiry.
  candidates.sort((a, b) => {
    const strikeDiff = Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike);
    if (strikeDiff !== 0) return strikeDiff;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });

  return candidates[0];
}

module.exports.parseOccSymbol = parseOccSymbol;
module.exports.findBestPutContract = findBestPutContract;
