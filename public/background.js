// Salesforce Agentforce Inspector - Background Service Worker

const MAX_SESSIONS = 5;
const ALARM_NAME = 'keepAlive';
const ALARM_PERIOD_MINUTES = 0.33; // ~20 seconds

// ── Keep-alive alarm ──────────────────────────────────────────────────────────
chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Service worker stays alive
  }
});

// ── Install handler ───────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
});

// ── Offscreen document management ─────────────────────────────────────────────
let offscreenCreating = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  }).catch(() => []);

  if (existingContexts.length > 0) return;

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'WebAssembly log parsing for Apex Debug Logs',
  });

  try {
    await offscreenCreating;
  } finally {
    offscreenCreating = null;
  }
}

// ── Session management ────────────────────────────────────────────────────────
async function saveSession(eventData) {
  const result = await chrome.storage.session.get(['copilotEvents']).catch(() => ({}));
  const events = result.copilotEvents || [];
  events.unshift({ ...eventData, timestamp: Date.now() });
  if (events.length > MAX_SESSIONS) events.splice(MAX_SESSIONS);
  await chrome.storage.session.set({ copilotEvents: events });

  // Also persist to local storage for session ghosting
  const localResult = await chrome.storage.local.get(['ghostSessions']).catch(() => ({}));
  const ghostSessions = localResult.ghostSessions || [];

  const session = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    orgUrl: eventData.orgUrl || '',
    stepCount: eventData.steps ? eventData.steps.length : 1,
    data: eventData,
  };

  ghostSessions.unshift(session);
  if (ghostSessions.length > MAX_SESSIONS) ghostSessions.splice(MAX_SESSIONS);
  await chrome.storage.local.set({ ghostSessions });

  return events;
}

async function getSessions() {
  const sessionResult = await chrome.storage.session.get(['copilotEvents']).catch(() => ({}));
  const localResult = await chrome.storage.local.get(['ghostSessions']).catch(() => ({}));
  return {
    currentEvents: sessionResult.copilotEvents || [],
    ghostSessions: localResult.ghostSessions || [],
  };
}

// ── Grounding health check ─────────────────────────────────────────────────────
async function runGroundingCheck(recordIds) {
  const results = [];
  for (const recordId of recordIds) {
    results.push({
      recordId,
      status: 'unknown',
      message: 'Grounding check requires Salesforce API access from the page context.',
      timestamp: Date.now(),
    });
  }
  return results;
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'COPILOT_EVENT': {
          const events = await saveSession(message.data);
          // Forward to side panel (broadcast to all extension views)
          chrome.runtime.sendMessage({
            type: 'SESSIONS_UPDATED',
            data: { latestEvent: message.data, events },
          }).catch(() => {});
          sendResponse({ success: true, eventCount: events.length });
          break;
        }

        case 'PARSE_LOG': {
          await ensureOffscreenDocument();
          // Forward to offscreen document
          const parseResult = await chrome.runtime.sendMessage({
            type: 'PARSE_LOG_OFFSCREEN',
            data: message.data,
          }).catch((err) => ({ error: err.message }));
          sendResponse(parseResult);
          break;
        }

        case 'GET_SESSIONS': {
          const sessions = await getSessions();
          sendResponse({ success: true, ...sessions });
          break;
        }

        case 'GROUNDING_CHECK': {
          const checkResults = await runGroundingCheck(
            message.data.recordIds || []
          );
          sendResponse({ success: true, results: checkResults });
          break;
        }

        case 'EXPORT_SESSION': {
          const data = JSON.stringify(message.data, null, 2);
          const masked = data
            .replace(/"(sessionId|SessionId|session_id)":\s*"[^"]+"/gi, '"sessionId": "[REDACTED]"')
            .replace(/"(authorization|Authorization)":\s*"[^"]+"/gi, '"Authorization": "[REDACTED]"')
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
            .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
          sendResponse({ success: true, data: masked });
          break;
        }

        case 'CLEAR_SESSIONS': {
          await chrome.storage.session.remove(['copilotEvents']);
          await chrome.storage.local.remove(['ghostSessions']);
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('[AgentforceInspector] Background error:', err);
      sendResponse({ error: err.message });
    }
  })();
  return true; // keep message channel open
});

// ── Tab updated handler (open side panel on Salesforce tabs) ──────────────────
function isSalesforceUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'salesforce.com' || hostname.endsWith('.salesforce.com') ||
           hostname === 'force.com' || hostname.endsWith('.force.com');
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isSalesforceUrl(tab.url)) {
    chrome.sidePanel.setOptions({
      tabId,
      path: 'index.html',
      enabled: true,
    }).catch(() => {});
  }
});

// ── Action click handler (open side panel) ────────────────────────────────────
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});
