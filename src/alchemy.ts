/**
 * alchemy.ts
 * Multi-pool Alchemy WebSocket listener (single chain).
 * - Subscribes to Deposit events for all pools in POOLS env.
 * - Formats community-friendly alerts per pool:
 *   "💰 (X amount) TOKEN have just been deposited on (pool name):\nCheck txn <link>"
 */

import { WebSocketProvider, Interface, Log, id, formatUnits } from 'ethers';
import {
  ALCHEMY_WEBSOCKET_URL,
  EVENT_ABI_JSON,
  EVENT_SIGNATURE,
  hasDecodingConfig,
  POOLS,
  type PoolConfig
} from './config.js';
import { sendTelegramMessage } from './telegram.js';

// Detect chain from URL to build correct explorer links
function getExplorerBase(url: string): string {
  if (url.includes('sepolia')) return 'https://sepolia.etherscan.io';
  return 'https://etherscan.io';
}

// Create a provider using Alchemy WebSocket URL
const provider = new WebSocketProvider(ALCHEMY_WEBSOCKET_URL);

// Prepare an Interface for decoding if possible (shared across pools)
let iface: Interface | null = null;
let eventFragmentName: string | null = null;
let eventTopic: string | undefined;

if (hasDecodingConfig()) {
  try {
    if (EVENT_ABI_JSON) {
      const parsed = JSON.parse(EVENT_ABI_JSON);
      iface = new Interface(parsed);
      // Attempt to pick the first event fragment name
      const fragments = (iface as any).fragments as Array<any>;
      const ev = fragments?.find((f) => f.type === 'event');
      if (ev) eventFragmentName = ev.name as string;
    } else if (EVENT_SIGNATURE) {
      const name = EVENT_SIGNATURE.split('(')[0] || 'Deposit';
      const params = EVENT_SIGNATURE.slice(EVENT_SIGNATURE.indexOf('(') + 1, -1);
      const abi = [`event ${name}(${params})`];
      iface = new Interface(abi);
      eventFragmentName = name;
    }

    // Compute event topic hash using id(signature)
    if (iface && eventFragmentName) {
      const ev = iface.getEvent(eventFragmentName);
      if (ev) {
        const sigName: string = ev.name;
        const types: string = (ev.inputs ?? []).map((i: any) => i.type).join(',');
        const signature = `${sigName}(${types})`;
        eventTopic = id(signature);
      }
    }
  } catch (e) {
    console.warn('[Alchemy] Failed to build Interface or derive topic. Will use raw logs.', e);
    iface = null;
    eventFragmentName = null;
    eventTopic = undefined;
  }
}

/**
 * Start subscriptions for all pools listed in POOLS.
 * CONTRACT_ADDRESS is ignored when POOLS is provided.
 */
export function startLogSubscription(): void {
  if (!POOLS.length) {
    console.warn('[Alchemy] No pools configured in POOLS env. Nothing to subscribe to.');
    return;
  }

  const explorer = getExplorerBase(ALCHEMY_WEBSOCKET_URL);

  for (const pool of POOLS) {
    const filter: {
      address: string;
      topics?: (string | string[] | null)[];
    } = {
      address: pool.address
    };
    if (eventTopic) filter.topics = [eventTopic];

    console.log('[Alchemy] Subscribing to pool:', { name: pool.name, address: pool.address, topics: filter.topics });

    provider.on(filter, async (log: Log) => {
      try {
        await handleLogForPool(log, pool, explorer);
      } catch (e) {
        console.error('[Alchemy] Error handling log for pool', pool.name, e);
      }
    });
  }

  // Attach basic websocket diagnostics if available
  const ws: any = (provider as any).websocket ?? (provider as any)._websocket;
  if (ws && typeof ws.on === 'function') {
    ws.on('error', (err: unknown) => {
      console.error('[Alchemy] WebSocket error:', err);
    });
    ws.on('close', (code: number) => {
      console.error('[Alchemy] WebSocket closed with code:', code);
    });
  }
}

async function handleLogForPool(log: Log, pool: PoolConfig, explorer: string): Promise<void> {
  const txHash = log.transactionHash;
  const txUrl = `${explorer}/tx/${txHash}`;

  if (iface && eventTopic) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed) {
        // Extract the assets amount (Deposit(sender, owner, assets, shares))
        let amountRaw: bigint | null = null;

        // Prefer named "assets"
        const maybeAssets = (parsed.args as any)?.assets;
        if (typeof maybeAssets === 'bigint') {
          amountRaw = maybeAssets;
        } else if (Array.isArray(parsed.args) || typeof (parsed.args as any)?.[2] !== 'undefined') {
          const byIndex = (parsed.args as any)[2];
          if (typeof byIndex === 'bigint') amountRaw = byIndex;
        }

        if (amountRaw !== null) {
          const formatted = formatUnits(amountRaw, pool.decimals);
          const symbol = pool.name.toUpperCase().includes('USDT') ? 'USDT' : 'USDC'; // simple heuristic
          const msg = [
            `💰 <b>${formatted} ${symbol}</b> have just been deposited on <b>${pool.name}</b>:`,
            `Check txn <a href="${txUrl}">view on Etherscan</a>`
          ].join('\n');
          await sendTelegramMessage(msg);
          return;
        }
      }
    } catch (e) {
      console.warn(`[Alchemy] Failed to decode with provided ABI/signature for pool "${pool.name}". Falling back to raw log.`, e);
      // fallthrough to raw
    }
  }

  const msg = [
    `💰 <b>New deposit</b> on <b>${pool.name}</b>`,
    `Check txn <a href="${txUrl}">view on Etherscan</a>`
  ].join('\n');
  await sendTelegramMessage(msg);
}