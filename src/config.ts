/**
 * config.ts
 * Loads and validates environment variables.
 * Now supports multi-pool configuration via POOLS JSON.
 * We keep CONTRACT_ADDRESS in .env but the code ignores it when POOLS is present.
 */

import 'dotenv/config';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optionalEnv(name: string, def: string = ''): string {
  const v = process.env[name];
  return (v ?? def).toString().trim();
}

// Required envs
export const ALCHEMY_WEBSOCKET_URL = requireEnv('ALCHEMY_WEBSOCKET_URL');

// Legacy single-contract var (kept but unused if POOLS is set)
export const CONTRACT_ADDRESS = optionalEnv('CONTRACT_ADDRESS').toLowerCase();

// Optional decoding helpers
export const EVENT_SIGNATURE = optionalEnv('EVENT_SIGNATURE'); // e.g. Deposit(address,uint256)
export const EVENT_ABI_JSON = optionalEnv('EVENT_ABI_JSON');

// Telegram
export const TELEGRAM_BOT_TOKEN = requireEnv('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_CHAT_ID = requireEnv('TELEGRAM_CHAT_ID'); // can be number or @channel username; we keep string

/**
 * Multi-pool support
 * Provide POOLS as a JSON array in .env, example:
 * POOLS=[{"address":"0x...","name":"Superior Quality Private Credit USDC","decimals":6},{"address":"0x...","name":"Superior Quality Private Credit USDT","decimals":6}]
 */
export type PoolConfig = {
  address: string;
  name: string;
  decimals: number; // token decimals for formatting (e.g., 6 for USDC/USDT)
};

export const POOLS: PoolConfig[] = (() => {
  const raw = optionalEnv('POOLS');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PoolConfig[];
    // Basic validation and normalization
    return parsed.map((p, idx) => {
      if (!p.address || !p.name || typeof p.decimals !== 'number') {
        throw new Error(`Invalid POOLS[${idx}] entry, expected {address,name,decimals}`);
      }
      return {
        address: String(p.address).toLowerCase(),
        name: String(p.name),
        decimals: Number(p.decimals)
      };
    });
  } catch (e) {
    throw new Error(`Failed to parse POOLS JSON: ${(e as Error).message}`);
  }
})();

/**
 * Small helper indicating whether we can decode logs.
 * Either a valid EVENT_SIGNATURE or a valid EVENT_ABI_JSON should be provided.
 */
export function hasDecodingConfig(): boolean {
  if (EVENT_SIGNATURE) return true;
  if (EVENT_ABI_JSON) {
    try {
      const parsed = JSON.parse(EVENT_ABI_JSON);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}