const dot = document.getElementById('dot');
const label = document.getElementById('label');
const toggle = document.getElementById('toggle');
const deliveryDot = document.getElementById('delivery-dot');
const delivery = document.getElementById('delivery');
const complete = document.getElementById('complete');
const recent = document.getElementById('recent');
const empty = document.getElementById('empty');

function render(enabled) {
  dot.classList.toggle('off', !enabled);
  label.textContent = enabled ? 'Observing' : 'Paused';
  toggle.textContent = enabled ? 'Pause' : 'Resume';
}

function clock(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function renderRecent(list) {
  recent.innerHTML = '';
  empty.style.display = list.length ? 'none' : 'block';
  for (const e of [...list].reverse()) {
    const li = document.createElement('li');
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = clock(e.at);
    const a = document.createElement('span');
    a.className = 'a';
    a.textContent = e.action;
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = e.keys && e.keys.length ? e.keys.join(', ') : '';
    li.append(t, a, k);
    recent.appendChild(li);
  }
}

function renderDelivery(d) {
  if (!d) {
    deliveryDot.className = 'dot off';
    delivery.textContent = 'REPEAT: not contacted yet';
    return;
  }
  deliveryDot.className = d.ok ? 'dot' : 'dot bad';
  delivery.textContent = d.ok
    ? `REPEAT received ${d.count} at ${clock(d.at)}`
    : `REPEAT not reachable (${d.status || 'offline'}) — is npm run dev running?`;
}

chrome.storage.local.get(['repeatEnabled', 'repeatRecent', 'repeatDelivery'], (r) => {
  render(r.repeatEnabled !== false);
  renderRecent(r.repeatRecent || []);
  renderDelivery(r.repeatDelivery);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.repeatRecent) renderRecent(changes.repeatRecent.newValue || []);
  if (changes.repeatDelivery) renderDelivery(changes.repeatDelivery.newValue);
  if (changes.repeatEnabled) render(changes.repeatEnabled.newValue !== false);
});

toggle.addEventListener('click', () => {
  chrome.storage.local.get(['repeatEnabled'], ({ repeatEnabled }) => {
    const next = repeatEnabled === false;
    chrome.storage.local.set({ repeatEnabled: next }, () => render(next));
  });
});

complete.addEventListener('click', () => {
  complete.disabled = true;
  chrome.runtime.sendMessage({ type: 'repeat:complete' }, () => {
    complete.disabled = false;
  });
});
