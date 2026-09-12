/**
 * REPEAT Observer — service worker.
 *
 * Receives batched semantic events from content scripts and forwards them to
 * a locally running REPEAT instance. If REPEAT is not running, events are
 * dropped rather than buffered indefinitely — an observer that hoards data it
 * cannot deliver is exactly what a privacy panel should not have to explain.
 */

const REPEAT_ENDPOINT = 'http://localhost:3000/api/observe';
const MAX_BUFFER = 200;

let buffer = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'repeat:events') return false;

  buffer.push(...message.events);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);

  void deliver();
  sendResponse({ received: message.events.length });
  return true;
});

async function deliver() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await fetch(REPEAT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // REPEAT is not listening. Drop the batch.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ repeatEnabled: true });
});
