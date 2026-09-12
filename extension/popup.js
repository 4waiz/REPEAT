const dot = document.getElementById('dot');
const label = document.getElementById('label');
const toggle = document.getElementById('toggle');

function render(enabled) {
  dot.classList.toggle('off', !enabled);
  label.textContent = enabled ? 'Observing' : 'Paused';
  toggle.textContent = enabled ? 'Pause' : 'Resume';
}

chrome.storage.local.get(['repeatEnabled'], ({ repeatEnabled }) => {
  render(repeatEnabled !== false);
});

toggle.addEventListener('click', () => {
  chrome.storage.local.get(['repeatEnabled'], ({ repeatEnabled }) => {
    const next = repeatEnabled === false;
    chrome.storage.local.set({ repeatEnabled: next }, () => render(next));
  });
});
