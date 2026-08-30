// utils/alpacaCli.js — Strike Sentry
// Order submission via Alpaca's official CLI (alpacahq/cli), satisfying the
// hackathon requirement to use Alpaca's Trading API + CLI (not raw REST for orders).

const { execFile } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const execFileAsync = util.promisify(execFile);

const ALPACA_BIN = process.env.ALPACA_CLI_PATH || path.join(__dirname, '..', 'bin', 'alpaca');
try {
  fs.chmodSync(ALPACA_BIN, 0o755);
} catch (e) {}

function buildOrderArgs(payload) {
  const args = ['order', 'submit', '--quiet'];
  const flagMap = {
    symbol: '--symbol',
    side: '--side',
    type: '--type',
    qty: '--qty',
    notional: '--notional',
    time_in_force: '--time-in-force',
    limit_price: '--limit-price',
    stop_price: '--stop-price',
    order_class: '--order-class',
    position_intent: '--position-intent',
  };
  for (const [key, flag] of Object.entries(flagMap)) {
    if (payload[key] != null) {
      args.push(flag, String(payload[key]));
    }
  }
  return args;
}

async function submitOrderViaCli(payload) {
  const args = buildOrderArgs(payload);
  try {
    const { stdout } = await execFileAsync(ALPACA_BIN, args, {
      env: {
        ...process.env,
        ALPACA_API_KEY: process.env.APCA_API_KEY_ID,
        ALPACA_SECRET_KEY: process.env.APCA_API_SECRET_KEY,
      },
      timeout: 15000,
    });
    return JSON.parse(stdout);
  } catch (err) {
    const stderrMsg = err.stderr || err.message;
    const cliErr = new Error(`Alpaca CLI order submission failed: ${stderrMsg}`);
    cliErr.cliStderr = stderrMsg;
    throw cliErr;
  }
}

module.exports = { submitOrderViaCli, buildOrderArgs };
