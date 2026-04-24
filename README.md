# Salesforce Agentforce Inspector

A developer-centric Chrome Extension (Manifest V3) designed to bridge the gap between "Black Box" AI reasoning and actionable Apex/Data Cloud debugging. It focuses on local log parsing, session persistence, and grounding data validation.

## Features

- **Atlas Trace Capture** – Intercepts and parses XHR/Fetch requests from the Salesforce Agent Builder to extract the reasoning chain (Plan, Tool Selection, and Thought Process).
- **Wasm-Powered Log Grepper** – Uses WebAssembly (with a JavaScript fallback) to instantly scan massive Apex Debug Logs for `AGENT_PLANNING` and `DATA_GROUNDING` events without freezing the UI.
- **Grounding Health Check** – One-click verification that checks if the record IDs retrieved by the agent actually contain the data required by the prompt.
- **Session Ghosting** – Persists the last 5 agent interactions in a sidebar that follows the developer across different Salesforce tabs (e.g., from Copilot Builder to Setup or the Developer Console).

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Manifest | V3 |
| Frontend | React 18 + Tailwind CSS |
| Processing | WebAssembly (Rust via `wasm-bindgen`) with JS fallback |
| Storage | `chrome.storage.local` (session ghosting) + `chrome.storage.session` (trace data) |
| API Monitoring | `chrome.declarativeNetRequest` |
| Keep-alive | `chrome.alarms` |
| Heavy Processing | `chrome.offscreen` (Wasm log parsing) |

## Security

- **No External Egress** – All log parsing and reasoning analysis happens locally in the extension's background script or Wasm module.
- **Credential Masking** – Automatically redacts `SessionId`, `Authorization` headers, emails, phone numbers, and SSNs from any "Export to JSON" feature.
- **CSP** – Strictly follows `script-src 'self' 'wasm-unsafe-eval'`.
- **Scoped Permissions** – `host_permissions` limited to `*.salesforce.com` and `*.force.com`.
- **No `eval()`** – Zero use of `eval()` or `new Function()`.

## Project Structure

```
├── public/                  # Static files copied to dist as-is
│   ├── manifest.json        # MV3 manifest
│   ├── background.js        # Service worker (keep-alive, session mgmt, message routing)
│   ├── content.js           # Content script (fetch/XHR interception via postMessage)
│   ├── offscreen.html       # Offscreen document HTML
│   ├── offscreen.js         # Offscreen document (Wasm + JS fallback log parser)
│   ├── icons/               # Extension icons (16, 32, 48, 128px)
│   └── wasm/                # Compiled Wasm output (after `npm run build:wasm`)
├── src/                     # React side panel source
│   ├── index.html           # Side panel HTML (Vite entry)
│   ├── main.jsx             # React entry point
│   ├── App.jsx              # Main app with tab navigation
│   ├── App.css              # Tailwind + custom JSON syntax highlight styles
│   ├── components/
│   │   ├── Header.jsx       # Session ID, status, export button
│   │   ├── Timeline.jsx     # Vertical timeline of agent reasoning steps
│   │   ├── StepDetail.jsx   # JSON detail view for a selected step
│   │   ├── SessionList.jsx  # Ghost session browser (last 5 sessions)
│   │   ├── LogParser.jsx    # Apex Debug Log paste & parse UI
│   │   └── GroundingCheck.jsx # Record ID grounding health check UI
│   └── utils/
│       └── credentialMasker.js  # PII/credential redaction utility
├── wasm-src/                # Rust source for the Wasm log parser
│   ├── Cargo.toml
│   └── src/lib.rs
├── scripts/
│   └── generate-icons.js    # Generates PNG icons with the canvas package
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- (Optional, for Wasm) Rust + `wasm-pack`

### Install dependencies

```bash
npm install
```

### Build the side panel

```bash
npm run build
```

The `dist/` folder is the ready-to-load Chrome extension.

### Build the Wasm log parser (optional)

```bash
# Install wasm-pack if not already installed
cargo install wasm-pack

# Add the wasm32 target
rustup target add wasm32-unknown-unknown

# Build the Wasm module
npm run build:wasm
```

If the Wasm module is not built, the extension automatically falls back to a pure-JavaScript implementation of the same log parser.

### Generate icons

```bash
npm run icons
```

## Loading the Extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

## How It Works

### Atlas Trace Capture

The content script (`public/content.js`) injects a small page-level script via an inline `<script>` tag (no `eval`) that wraps the native `fetch` and `XMLHttpRequest` APIs. Any request URL matching `/copilot/sessions/` or `/einstein/copilot/` is intercepted; the response body is posted back to the content script via `window.postMessage` and then forwarded to the background service worker as a `COPILOT_EVENT` message.

### Log Parser

The offscreen document (`public/offscreen.js`) receives `PARSE_LOG_OFFSCREEN` messages from the background worker. It uses the compiled Wasm module (if available) or the JS fallback to scan the log string line-by-line for `AGENT_PLANNING` and `DATA_GROUNDING` events and returns a structured JSON summary.

### Session Ghosting

The background service worker stores the last 5 intercepted interactions in both `chrome.storage.session` (for the current browser session) and `chrome.storage.local` (for persistence across restarts). The Sessions tab in the side panel lets you reload any of these ghost sessions.

### Keep-alive

A `chrome.alarms` alarm fires every ~20 seconds to prevent the MV3 service worker from being terminated during active debugging sessions.
