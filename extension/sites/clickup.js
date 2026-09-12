/**
 * REPEAT Observer — ClickUp extractor (app.clickup.com).
 *
 * ClickUp's web app DOM is not documented and changes often, so this file
 * is a trigger, not the truth: it notices the create-task modal, the Create
 * click and the new task's URL, and REPEAT confirms the task through the
 * ClickUp API (the board it shows is read from the API, not from here).
 * Anything it cannot recognise falls back to content.js's generic verb
 * table, which already maps "assign", "tag", "priority" and "create task"
 * labels to the right semantic actions.
 */
(() => {
  const api = globalThis.REPEAT_OBSERVER;
  if (!api) return;

  const text = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const PRIORITY = { urgent: 'critical', high: 'high', normal: 'medium', low: 'low' };

  function dialogOf(el) {
    return el ? el.closest('dialog[open], [role="dialog"], [class*="modal" i]') : null;
  }

  /** The task-name field in the create modal: an editable labelled "Task name", else the first editable. */
  function taskTitle(dialog) {
    const editable = dialog.querySelectorAll('input, textarea, [contenteditable="true"]');
    for (const el of editable) {
      const name = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('data-test') || ''}`.toLowerCase();
      if (/task name|title/.test(name)) return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : text(el);
    }
    const first = editable[0];
    return first ? (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement ? first.value : text(first)) : '';
  }

  let lastCreateHint = 0;
  let lastPath = location.pathname;
  const seenTasks = new Set();

  api.registerSite({
    name: 'clickup',
    handleClick(control, label) {
      const dialog = dialogOf(control);
      if (dialog && /^create task$/i.test(label)) {
        lastCreateHint = Date.now();
        return api.buildEvent('tracker.create_issue', 'commit the ticket to the tracker', {
          issueTitle: (taskTitle(dialog) || '').trim().slice(0, 200),
          createdAtHint: lastCreateHint,
        });
      }
      if (dialog && /^(task|new task|\+ ?task|create)$/i.test(label) && !lastCreateHint) {
        // The modal opening.
        return api.buildEvent('tracker.open_composer', 'begin authoring an engineering ticket', { url: location.origin + location.pathname });
      }
      // A priority option: Urgent / High / Normal / Low.
      const severity = PRIORITY[label.toLowerCase()];
      if (severity && control.closest('[role="menu"], [role="listbox"], [class*="priorit" i]')) {
        return api.buildEvent('tracker.set_priority', 'record how urgent the issue is', { severity });
      }
      return null;
    },

    watch() {
      // A task opens at /t/<id>. Right after a Create click that is the new
      // task; otherwise it is the human opening an existing one.
      setInterval(() => {
        if (location.pathname === lastPath) return;
        lastPath = location.pathname;
        const match = /^\/t\/([a-z0-9]+)$/i.exec(location.pathname);
        if (!match || seenTasks.has(match[1])) return;
        seenTasks.add(match[1]);
        const url = location.origin + location.pathname;
        if (lastCreateHint && Date.now() - lastCreateHint < 30_000) {
          api.emit(
            api.buildEvent('tracker.create_issue', 'ticket confirmed by the tracker', {
              taskId: match[1],
              url,
              issueTitle: (document.title.split('|')[0] || '').trim().slice(0, 200),
              confirmedAfterHintMs: Date.now() - lastCreateHint,
            }),
          );
        }
      }, 500);
    },
  });
})();
