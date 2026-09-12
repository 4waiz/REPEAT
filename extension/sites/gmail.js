/**
 * REPEAT Observer — Gmail extractor (mail.google.com).
 *
 * One job: notice that a message was opened, and say which one. Anchored on
 * the attributes Gmail has kept stable for years (data-legacy-thread-id,
 * data-legacy-message-id, span[email]); the class-based fallbacks are
 * secondary and every miss degrades to a smaller event rather than a wrong
 * one. The body is never read here — REPEAT resolves the content by id
 * through its own Gmail connector, so mail text never leaves the page via
 * the observer.
 *
 * Loaded after content.js on mail.google.com (see manifest.json).
 */
(() => {
  const api = globalThis.REPEAT_OBSERVER;
  if (!api) return;

  const seen = new Set();
  let timer = null;

  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

  /** The message currently open in the reading pane, if any. */
  function currentMessage() {
    const main = document.querySelector('[role="main"]');
    if (!main) return null;

    const heading = main.querySelector('h2[data-legacy-thread-id]') || main.querySelector('.ha h2');
    if (!heading) return null;

    // Expanded message container; the last expanded one is the one being read.
    const expanded = main.querySelectorAll('div.adn.ads.h7');
    const container = expanded.length ? expanded[expanded.length - 1] : main.querySelector('div.adn.ads');

    const idHost =
      (container && (container.querySelector('[data-legacy-message-id]') || container.closest('[data-legacy-message-id]'))) ||
      main.querySelector('[data-legacy-message-id]');
    let messageId = idHost ? idHost.getAttribute('data-legacy-message-id') : '';
    if (!messageId && container) {
      // Older markup: the body div carries an m<hex> class.
      const body = container.querySelector('div.ii.gt');
      const match = body && /\bm([0-9a-f]{8,})\b/.exec(body.className + ' ' + (body.firstElementChild ? body.firstElementChild.className : ''));
      if (match) messageId = match[1];
    }

    const sender =
      (container && (container.querySelector('td.gF span[email]') || container.querySelector('span[email]'))) ||
      main.querySelector('span[email]');
    const dateEl = container ? container.querySelector('.gK .g3, .g3') : null;

    return {
      threadId: heading.getAttribute('data-legacy-thread-id') || '',
      threadPermId: heading.getAttribute('data-thread-perm-id') || '',
      messageId: messageId || '',
      subject: text(heading).slice(0, 200),
      customerEmail: sender ? sender.getAttribute('email') || '' : '',
      customerName: sender ? sender.getAttribute('name') || text(sender) : '',
      receivedAt: dateEl ? dateEl.getAttribute('title') || '' : '',
    };
  }

  function scan() {
    timer = null;
    const message = currentMessage();
    if (!message || !message.subject) return;
    const key = `${message.threadId}/${message.messageId || message.subject}`;
    if (seen.has(key)) return;
    seen.add(key);
    api.emit(
      api.buildEvent('mail.read_message', 'read an inbound message', {
        messageId: message.messageId,
        threadId: message.threadId,
        threadPermId: message.threadPermId,
        subject: message.subject,
        customerEmail: message.customerEmail,
        customerName: message.customerName,
        receivedAt: message.receivedAt,
      }),
    );
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(scan, 150);
  }

  api.registerSite({
    name: 'gmail',
    // Clicks in Gmail are navigation, not workflow verbs; the copy listener
    // in content.js already records "captured content for reuse".
    handleClick: () => null,
    watch() {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
      window.addEventListener('hashchange', schedule);
      schedule();
    },
  });
})();
