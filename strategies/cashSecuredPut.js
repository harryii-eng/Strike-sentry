// strategies/cashSecuredPut.js — Strike Sentry
const alpaca = require('../utils/alpaca');
const market = require('../utils/market');

function selectStrike(currentPrice, otmPercent = 0.08) {
  return currentPrice * (1 - otmPercent);
}

async function proposeCashSecuredPut({
  ticker, currentPrice, contracts = 1, otmPercent = 0.08,
}) {
  if (!currentPrice) {
    currentPrice = await market.getLatestPrice(ticker);
    if (!currentPrice) {
      return { ok: false, reason: `Could not fetch a live price for ${ticker}.` };
    }
  }

  const targetStrike = selectStrike(currentPrice, otmPercent);
  const best = await market.findBestPutContract(ticker, targetStrike);

  if (!best) {
    return {
      ok: false,
      reason: `No quoted put contracts found near strike ${targetStrike.toFixed(2)} for ${ticker}.`,
      targetStrike,
    };
  }

  const { symbol, strike, expiryDate, premium: estimatedPremium } = best;
  const cashRequired = strike * 100 * contracts;
  const premiumReceived = estimatedPremium * 100 * contracts;
  const netCashAtRisk = cashRequired - premiumReceived;

  const bpCheck = await alpaca.checkBuyingPower(netCashAtRisk);
  if (!bpCheck.sufficient) {
    return {
      ok: false,
      reason: `Insufficient buying power: need $${netCashAtRisk.toFixed(2)}, have $${bpCheck.buyingPower.toFixed(2)}.`,
      symbol, strike, cashRequired, premiumReceived, netCashAtRisk,
    };
  }

  const preview = await alpaca.previewOrder({
    symbol,
    qty: contracts,
    side: 'sell',
    order_type: 'limit',
    time_in_force: 'day',
    limit_price: estimatedPremium,
    position_intent: 'sell_to_open',
  });

  return {
    ok: preview.valid,
    symbol,
    strike,
    expiryDate,
    contracts,
    estimatedPremium,
    cashRequired,
    premiumReceived,
    netCashAtRisk,
    breakEven: strike - estimatedPremium,
    preview,
  };
}

module.exports = { proposeCashSecuredPut };
