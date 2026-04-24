// Salesforce Agentforce Inspector - Content Script
// Intercepts copilot API calls and forwards data to background service worker

(function () {
  'use strict';

  const COPILOT_PATTERNS = [
    /copilot\/sessions/i,
    /einstein\/copilot/i,
    /copilot\/messages/i,
  ];

  function matchesCopilotUrl(url) {
    return COPILOT_PATTERNS.some((p) => p.test(url));
  }

  function isSalesforceHost(hostname) {
    return hostname === 'salesforce.com' || hostname.endsWith('.salesforce.com') ||
           hostname === 'force.com' || hostname.endsWith('.force.com');
  }

  function extractOrgUrl() {
    const { hostname, origin } = window.location;
    return isSalesforceHost(hostname) ? origin : '';
  }

  function sendToBackground(eventData) {
    chrome.runtime.sendMessage({
      type: 'COPILOT_EVENT',
      data: { ...eventData, orgUrl: extractOrgUrl() },
    }).catch(() => {});
  }

  // ── Intercept via page script (postMessage bridge) ────────────────────────
  // We inject a script tag into the page to intercept fetch/XHR at page level
  // Communication back via window.postMessage (no eval used)
  const pageScript = document.createElement('script');
  pageScript.textContent = `
(function() {
  'use strict';

  const COPILOT_RE = [/copilot\\/sessions/i, /einstein\\/copilot/i, /copilot\\/messages/i];
  function isCopilotUrl(url) { return COPILOT_RE.some(r => r.test(url)); }

  // Override fetch
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && input.url) || '');
    const promise = originalFetch.apply(this, arguments);
    if (isCopilotUrl(url)) {
      promise.then(function(response) {
        const cloned = response.clone();
        cloned.text().then(function(body) {
          let parsed = body;
          try { parsed = JSON.parse(body); } catch(e) {}
          window.postMessage({
            __agentforceInspector: true,
            type: 'FETCH_INTERCEPT',
            url: url,
            method: (init && init.method) || 'GET',
            status: response.status,
            body: parsed,
          }, '*');
        }).catch(function(){});
      }).catch(function(){});
    }
    return promise;
  };

  // Override XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    let _url = '';
    let _method = 'GET';
    const origOpen = xhr.open.bind(xhr);
    const origSend = xhr.send.bind(xhr);

    xhr.open = function(method, url) {
      _url = url;
      _method = method;
      return origOpen.apply(xhr, arguments);
    };

    xhr.send = function() {
      if (isCopilotUrl(_url)) {
        xhr.addEventListener('load', function() {
          let body = xhr.responseText;
          try { body = JSON.parse(xhr.responseText); } catch(e) {}
          window.postMessage({
            __agentforceInspector: true,
            type: 'XHR_INTERCEPT',
            url: _url,
            method: _method,
            status: xhr.status,
            body: body,
          }, '*');
        });
      }
      return origSend.apply(xhr, arguments);
    };

    return xhr;
  };
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;
})();
  `;
  (document.head || document.documentElement).appendChild(pageScript);
  pageScript.remove();

  // ── Listen for postMessage from page script ───────────────────────────────
  window.addEventListener('message', function (event) {
    if (
      event.source !== window ||
      !event.data ||
      !event.data.__agentforceInspector
    ) {
      return;
    }

    const { type, url, method, status, body } = event.data;
    sendToBackground({
      interceptType: type,
      url,
      method,
      status,
      body,
      pageUrl: window.location.href,
      timestamp: Date.now(),
    });
  });

  // ── Listen for messages from background / side panel ─────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        title: document.title,
        orgUrl: extractOrgUrl(),
      });
    }
    return false;
  });
})();
