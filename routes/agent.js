// routes/agent.js — Strike Sentry
const express = require('express');
const router = express.Router();
const alpaca = require('../utils/alpaca');
const fs = require('fs');

const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const LOG_PATH = '/tmp/agent_orders.log';

function log(entry) {
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

function keywordFallback(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('buy')) return { action: 'buy', confidence: 0.4, reasoning: 'keyword fallback: "buy" detected' };
  if (p.includes('sell')) return { action: 'sell', confidence: 0.4, reasoning: 'keyword fallback: "sell" detected' };
  return { action: 'hold', confidence: 0.3, reasoning: 'keyword fallback: no clear signal' };
}

router.post('/decide', async (req, res) => {
  const { symbol, context } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  let decision;
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content:
            'You are a cautious trading agent. Given market context, respond ONLY with JSON: ' +
            '{"action": "buy"|"sell"|"hold", "confidence": 0-1, "reasoning": "short string"}. ' +
            'Default to "hold" if uncertain.',
        },
        { role: 'user', content: `Symbol: ${symbol}\nContext: ${context || 'none provided'}` },
      ],
    });
    decision = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error('GROQ ERROR:', err.message); console.error('GROQ ERROR:', err.message); console.error('GROQ ERROR:', err.message); decision = keywordFallback(context || symbol);
  }

  log({ stage: 'decide', symbol, decision });
  res.json({ symbol, decision });
});

router.post('/preview', async (req, res) => {
  const {
    symbol, qty, notional, side, order_type, type, time_in_force,
    limit_price, stop_price, order_class, estimatedPrice,
  } = req.body;
  try {
    const preview = await alpaca.previewOrder({
      symbol, qty, notional, side, order_type, type, time_in_force,
      limit_price, stop_price, order_class, estimatedPrice,
    });
    log({ stage: 'preview', symbol, side, preview });
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/order', async (req, res) => {
  const {
    symbol, qty, notional, side, order_type, type, time_in_force,
    limit_price, stop_price, order_class,
  } = req.body;

  const { payload, valid, warnings } = await alpaca.previewOrder({
    symbol, qty, notional, side, order_type, type, time_in_force, limit_price, stop_price, order_class,
  });

  if (!valid) {
    log({ stage: 'submit_rejected', payload, warnings });
    return res.status(400).json({ error: 'Order failed validation', warnings });
  }

  try {
    const order = await require('../utils/alpacaCli').submitOrderViaCli(payload);
    log({ stage: 'submit', payload, order });
    res.json(order);
  } catch (err) {
    log({ stage: 'submit_error', payload, error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.get('/order/:id', async (req, res) => {
  try {
    const order = await alpaca.getOrder(req.params.id);
    log({ stage: 'track', orderId: req.params.id, status: order.status });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/positions', async (_req, res) => {
  try {
    res.json(await alpaca.listPositions());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const { proposeCashSecuredPut } = require('../strategies/cashSecuredPut');

router.post('/strategy/cash-secured-put', async (req, res) => {
  const { ticker, currentPrice, expiryDate, contracts, otmPercent, estimatedPremium } = req.body;
  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' });
  }
  try {
    const proposal = await proposeCashSecuredPut({
      ticker, currentPrice, expiryDate, contracts, otmPercent, estimatedPremium,
    });
    log({ stage: 'strategy_cash_secured_put', ticker, proposal });
    res.json(proposal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
