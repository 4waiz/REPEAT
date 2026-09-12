/**
 * REPEAT Observer — service worker.
 *
 * Receives batched semantic events from content scripts and forwards them to
 * a locally running REPEAT instance. If REPEAT is not running, events are
 * dropped rather than buffered indefinitely — an observer that hoards data it
 * cannot deliver is exactly what a privacy panel should not have to explain.
 *
 * It also keeps the last few events and the last delivery result in
 * chrome.storage so the popup can show what was captured and whether REPEAT
 * received it — the only way to test the observer on a real Gmail, ClickUp
 * or Jira tab is to look.
 */

const REPEAT_ENDPOINT = 'http://localhost:3000/api/observe';
const MAX_BUFFER = 200;
const RECENT_LIMIT = 12;

let buffer = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'repeat:events') {
    buffer.push(...message.events);
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
    void remember(message.events);
    void deliver();
    sendResponse({ received: message.events.length });
    return true;
  }

  // The popup's "Finish observation": tells REPEAT the pass is over.
  if (message?.type === 'repeat:complete') {
    const event = {
      timestamp: new Date().toISOString(),
      sourceApp: 'repeat',
      action: 'workflow.complete',
      semanticIntent: 'the human finished this pass',
      structuredData: {},
      confidence: 1,
      origin: 'observed',
    };
    buffer.push(event);
    void remember([event]);
    void deliver().then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

async function remember(events) {
  const { repeatRecent = [] } = await chrome.storage.local.get(['repeatRecent']);
  const recent = [...repeatRecent, ...events.map((e) => ({
    at: e.timestamp,
    app: e.sourceApp,
    action: e.action,
    intent: e.semanticIntent,
    keys: Object.keys(e.structuredData || {}),
  }))].slice(-RECENT_LIMIT);
  await chrome.storage.local.set({ repeatRecent: recent });
}

async function deliver() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const response = await fetch(REPEAT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
    await chrome.storage.local.set({
      repeatDelivery: { ok: response.ok, status: response.status, at: new Date().toISOString(), count: batch.length },
    });
  } catch {
    // REPEAT is not listening. Drop the batch, say so in the popup.
    await chrome.storage.local.set({
      repeatDelivery: { ok: false, status: 0, at: new Date().toISOString(), count: batch.length },
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ repeatEnabled: true, repeatRecent: [] });
});
