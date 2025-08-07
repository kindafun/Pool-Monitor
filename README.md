# Pool Monitor - Telegram Alerts for Contract Deposits (Alchemy WS + Ethers v6)

Small TypeScript service that listens to an Ethereum smart contract via Alchemy WebSocket and sends Telegram alerts on new logs/events. It supports decoding if you provide the event ABI or signature; otherwise it falls back to raw log details.

Features
- Alchemy WebSocket subscription to a target contract address
- Optional event decoding (via minimal ABI or signature)
- Telegram alerts with HTML formatting
- Minimal HTTP health endpoint for hosting
- Clean, small, well-commented code

Prerequisites
- Node.js 18+ recommended (Node 19 currently installed works, but ESLint plugins warn on engines)
- An Alchemy API key with WebSocket endpoint for Ethereum mainnet
- A Telegram Bot Token and a Chat ID

Quick Start (local)
1) Install dependencies
   npm install

2) Copy env template and set values
   cp .env.example .env
   Open .env and fill in:
   - ALCHEMY_WEBSOCKET_URL: wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
   - CONTRACT_ADDRESS: 0x00000
   - TELEGRAM_BOT_TOKEN: your bot token
   - TELEGRAM_CHAT_ID: your numeric chat id or @channelusername
   Optional decoding (pick one):
   - EVENT_SIGNATURE: e.g. Deposit(address,uint256)
   - EVENT_ABI_JSON: minimal JSON ABI array containing the event

3) Run in dev (tsx)
   npx tsx watch src/index.ts
   Or via npm:
   npm run dev

4) Verify it connects
   You should see:
   [Startup] Using Alchemy WS: wss://...
   [Startup] Watching contract: 0x4389...
   [Alchemy] Subscribing to logs with filter: { address: '0x...', topics: [...] }

5) Trigger and see Telegram alerts
   On new logs/events for the contract, you will receive a Telegram message. If decoding is configured correctly, the fields will be parsed and printed.

Deploying to Render (Web Service)
- Service Type: Web Service (Node)
- Build Command: npm ci && npm run build
- Start Command: npm start
- Environment Variables: set in Render dashboard (Render does not read local .env automatically)
  - ALCHEMY_WEBSOCKET_URL
  - CONTRACT_ADDRESS
  - TELEGRAM_BOT_TOKEN
  - TELEGRAM_CHAT_ID
  - (optional) EVENT_SIGNATURE
  - (optional) EVENT_ABI_JSON
- Health Check:
  - Render assigns PORT automatically; the app listens on it.
  - After deploy, open: https://YOUR-SERVICE.onrender.com/health -> should return "ok".
- Notes:
  - If you do not need inbound HTTP beyond health checks, do nothing else; the app’s HTTP server is already minimal.
  - If you later add webhooks or endpoints, reuse the same server instance.

How to find the Event ABI or Signature on Etherscan
1) Open the contract page on Etherscan for mainnet:
   https://etherscan.io/address/0xYourContractAddress#code

2) If the contract is verified:
   - Go to the Contract tab, then Code or Read/Write Contract tabs.
   - Look for the event in the source/ABI. The ABI is a big JSON. Copy the event entry. Example event ABI JSON:
     [
       {
         "anonymous": false,
         "inputs": [
           { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
           { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
         ],
         "name": "Deposit",
         "type": "event"
       }
     ]
   - Paste that into EVENT_ABI_JSON in .env (as a single line, or ensure JSON is valid).

3) If you only know the event signature:
   - Collect the canonical signature: EventName(type1,type2,...)
     Example: Deposit(address,uint256)
   - Put that into EVENT_SIGNATURE in .env.

4) If the contract ABI is not verified:
   - Go to the “Events” tab on Etherscan and look for a “Deposit”-like event name or topic.
   - If you only see topic hashes, you can still run the bot in raw log mode (leave signature/ABI blank). The bot will alert with tx hash, topics, and data.
   - Later, after you identify the correct event signature from the source or community docs, fill it in and restart.

Notes on Decoding and Token Amounts
- This template does not assume decimals. It prints bigint values as raw numbers (string). If you know the token decimals for the amount field, modify the formatting in ["src/alchemy.ts"](src/alchemy.ts:1) to use ethers.formatUnits(v, DECIMALS).
- If multiple different Deposit events exist, prefer EVENT_ABI_JSON and include the exact event you want to capture.

Project Structure
- ["src/index.ts"](src/index.ts:1) — Startup, minimal HTTP health server, and lifecycle handling
- ["src/alchemy.ts"](src/alchemy.ts:1) — Alchemy WebSocket provider, log subscription, decoding and message formatting
- ["src/telegram.ts"](src/telegram.ts:1) — Telegram message sender
- ["src/config.ts"](src/config.ts:1) — Loads and validates environment variables
- .env.example — Template for config

Run scripts
- npm run dev — tsx watch the entry point for quick iteration
- npm run build — compile to dist
- npm start — run compiled JS from dist
- npm run typecheck — type-check without emit
- npm run lint — run eslint (note: engine warnings may appear for Node 19)

Testing locally without real events
- Keep EVENT_SIGNATURE/ABI blank. The app will send raw logs for any event on the contract.
- If no new logs occur, temporarily switch to a contract that emits frequent events (e.g., a known token transfer on mainnet) and set a signature or leave blank for raw logs.
- You can also add a console.log in handleLog to print incoming logs to the terminal while keeping Telegram alerts.

Troubleshooting
- Type errors: run npm run typecheck
- Node engine warnings: this template installs ESLint versions compatible with your Node. Warnings may still appear; they do not affect the runtime.
- No messages arriving:
  - Confirm TELEGRAM_CHAT_ID is valid. For private chats, use your numeric chat id (use a bot like @userinfobot to get it). For channels, add the bot as admin and use the @channelusername.
  - Confirm ALCHEMY_WEBSOCKET_URL is correct and on mainnet.
  - Confirm CONTRACT_ADDRESS matches checksummed address (we lowercase internally for filtering).
  - If you provided EVENT_SIGNATURE but nothing arrives, remove it to allow raw logs or verify the signature is correct.

Security
- Do not commit .env with secrets.
- Bot token grants send-message permissions; keep it safe.
