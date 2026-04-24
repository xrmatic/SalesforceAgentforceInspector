// Salesforce Agentforce Inspector - Offscreen Document
// Handles WebAssembly log parsing

'use strict';

// ── Pure JS fallback log parser ───────────────────────────────────────────────
function parseLogJS(logString) {
  const lines = logString.split('\n');
  const agentPlanningEvents = [];
  const dataGroundingEvents = [];

  const agentPlanningRe = /AGENT_PLANNING[|\s](.+)/;
  const dataGroundingRe = /DATA_GROUNDING[|\s](.+)/;
  const timestampRe = /^(\d{2}:\d{2}:\d{2}\.\d+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const tsMatch = line.match(timestampRe);
    const timestamp = tsMatch ? tsMatch[1] : null;

    const apMatch = line.match(agentPlanningRe);
    if (apMatch) {
      let detail = apMatch[1];
      try { detail = JSON.parse(detail); } catch (e) {}
      agentPlanningEvents.push({
        lineNumber: i + 1,
        timestamp,
        raw: line,
        detail,
      });
    }

    const dgMatch = line.match(dataGroundingRe);
    if (dgMatch) {
      let detail = dgMatch[1];
      try { detail = JSON.parse(detail); } catch (e) {}
      dataGroundingEvents.push({
        lineNumber: i + 1,
        timestamp,
        raw: line,
        detail,
      });
    }
  }

  return {
    agentPlanningEvents,
    dataGroundingEvents,
    summary: {
      totalEvents: agentPlanningEvents.length + dataGroundingEvents.length,
      planningCount: agentPlanningEvents.length,
      groundingCount: dataGroundingEvents.length,
    },
  };
}

// ── Wasm loader ───────────────────────────────────────────────────────────────
let wasmParser = null;

async function loadWasm() {
  try {
    const wasmUrl = chrome.runtime.getURL('wasm/log_parser_bg.wasm');
    const jsUrl = chrome.runtime.getURL('wasm/log_parser.js');

    // Dynamic import of the wasm-bindgen generated JS glue
    const wasmModule = await import(jsUrl).catch(() => null);
    if (!wasmModule) return false;

    await wasmModule.default(wasmUrl);
    wasmParser = wasmModule.parse_log;
    return true;
  } catch (err) {
    console.warn('[AgentforceInspector] Wasm load failed, using JS fallback:', err.message);
    return false;
  }
}

// Try to load wasm on startup
loadWasm();

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'PARSE_LOG_OFFSCREEN') return false;

  const logString = message.data?.log || message.data || '';

  try {
    let result;
    if (wasmParser) {
      const raw = wasmParser(logString);
      result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else {
      result = parseLogJS(logString);
    }
    sendResponse({ success: true, result, usedWasm: !!wasmParser });
  } catch (err) {
    // Fallback to JS if wasm throws
    try {
      const result = parseLogJS(logString);
      sendResponse({ success: true, result, usedWasm: false });
    } catch (e2) {
      sendResponse({ success: false, error: e2.message });
    }
  }

  return true;
});
