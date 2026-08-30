// utils/alpaca.js — Strike Sentry
// Thin wrapper around Alpaca's Trading API (REST). No SDK required.

const PAPER_BASE_URL = 'https://paper-api.alpaca.markets';
const LIVE_BASE_URL = 'https://api.alpaca.markets';

function getBaseUrl() {
  const url = process.env.APCA_API_BASE_URL || PAPER_BASE_URL;
  if (url === LIVE_BASE_URL && process.env.ALLOW_LIVE_TRADING !== 'true') {
    throw new Error(
      'Refusing to trade against LIVE endpoint. Set APCA_API_BASE_URL to the ' +
      'paper endpoint, or explicitly set ALLOW_LIVE_TRADING=true if you really mean it.'
    );
  }
  return url;
}

function authHeaders() {
  const key = process.env.APCA_API_KEY_ID;
  const secret = process.env.APCA_API_SECRET_KEY;
  if (!key || !secret) {
    throw new Error('Missing APCA_API_KEY_ID / APCA_API_SECRET_KEY env vars.');
  }
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    'Content-Type': 'application/json',
  };
}

async function alpacaFetch(path, options = {}) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Alpaca API error ${res.status}: ${JSON.stringify(body)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function getAccount() {
  return alpacaFetch('/v2/account');
}

async function checkBuyingPower(estimatedCost) {
  const account = await getAccount();
  const buyingPower = parseFloat(account.buying_power);
  return {
    buyingPower,
    estimatedCost,
    sufficient: buyingPower >= estimatedCost,
    account,
  };
}

const OCC_OPTION_RE = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/;

function detectAssetClass(symbol) {
  if (OCC_OPTION_RE.test(symbol)) return 'us_option';
  if (symbol.includes('/')) return 'crypto';
  return 'us_equity';
}

const ORDER_MATRIX = {
  us_equity: {
    order_type: ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'],
    time_in_force: ['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'],
    order_class: ['simple', 'bracket', 'oco', 'oto'],
  },
  us_option: {
    order_type: ['market', 'limit', 'stop', 'stop_limit'],
    time_in_force: ['day', 'gtc'],
    order_class: ['simple', 'mleg'],
  },
  crypto: {
    order_type: ['market', 'limit', 'stop_limit'],
    time_in_force: ['gtc', 'ioc'],
    order_class: ['simple'],
  },
};

function validateOrderInputs({ symbol, order_type = 'market', time_in_force, qty, notional }) {
  const assetClass = detectAssetClass(symbol);
  const rules = ORDER_MATRIX[assetClass];
  const errors = [];

  if (!rules.order_type.includes(order_type)) {
    errors.push(`order_type "${order_type}" not valid for ${assetClass}. Allowed: ${rules.order_type.join(', ')}`);
  }

  const tif = time_in_force || (assetClass === 'crypto' ? 'gtc' : 'day');
  if (!rules.time_in_force.includes(tif)) {
    errors.push(`time_in_force "${tif}" not valid for ${assetClass}. Allowed: ${rules.time_in_force.join(', ')}`);
  }

  if (assetClass === 'crypto' && order_type === 'stop_limit' && tif !== 'gtc') {
    errors.push('crypto stop_limit orders must use time_in_force "gtc".');
  }
  if (assetClass === 'crypto' && tif === 'ioc' && !['market', 'limit'].includes(order_type)) {
    errors.push('crypto "ioc" time_in_force only applies to market or limit orders.');
  }
  if (order_type === 'trailing_stop' && !['day', 'gtc'].includes(tif)) {
    errors.push('trailing_stop orders only accept time_in_force "day" or "gtc".');
  }
  if (notional && qty) {
    errors.push('Cannot combine "qty" and "notional" — use one or the other.');
  }

  return { assetClass, timeInForce: tif, valid: errors.length === 0, errors };
}

async function previewOrder({
  symbol, qty, notional, side, order_type = 'market', type, time_in_force,
  limit_price, stop_price, order_class = 'simple', position_intent, estimatedPrice,
}) {
  const orderType = type || order_type;
  const { assetClass, timeInForce, valid, errors } = validateOrderInputs({
    symbol, order_type: orderType, time_in_force, qty, notional,
  });

  const payload = { symbol, side, type: orderType, time_in_force: timeInForce, order_class };
  if (qty) payload.qty = String(qty);
  if (notional) payload.notional = String(notional);
  if (['limit', 'stop_limit'].includes(orderType) && limit_price) payload.limit_price = String(limit_price);
  if (['stop', 'stop_limit', 'trailing_stop'].includes(orderType) && stop_price) payload.stop_price = String(stop_price);
  if (assetClass === 'us_option' && position_intent) payload.position_intent = position_intent;

  const qtyForCost = qty || (notional && estimatedPrice ? notional / estimatedPrice : null);
  const estimatedCost = notional ? Number(notional) : (estimatedPrice && qtyForCost ? estimatedPrice * qtyForCost : null);
  const bpCheck = estimatedCost ? await checkBuyingPower(estimatedCost) : null;

  const warnings = [...errors];
  if (bpCheck && !bpCheck.sufficient) warnings.push('Insufficient buying power for this order.');

  return {
    assetClass,
    payload,
    estimatedCost,
    buyingPowerCheck: bpCheck,
    valid: valid && (!bpCheck || bpCheck.sufficient),
    warnings,
  };
}

async function submitOrder(payload) {
  const { valid, errors } = validateOrderInputs({
    symbol: payload.symbol,
    order_type: payload.type,
    time_in_force: payload.time_in_force,
    qty: payload.qty,
    notional: payload.notional,
  });
  if (!valid) {
    const err = new Error(`Order failed validation: ${errors.join('; ')}`);
    err.validationErrors = errors;
    throw err;
  }
  return alpacaFetch('/v2/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function getOrder(orderId) {
  return alpacaFetch(`/v2/orders/${orderId}`);
}

async function listPositions() {
  return alpacaFetch('/v2/positions');
}

module.exports = {
  getAccount,
  checkBuyingPower,
  detectAssetClass,
  validateOrderInputs,
  previewOrder,
  submitOrder,
  getOrder,
  listPositions,
  authHeaders,
};
