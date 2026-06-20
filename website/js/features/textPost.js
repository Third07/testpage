/**
 * textPost.js — Feature 4: Simple Text & Link Posting
 */
const TextPost = (function () {
  function render(container, pages) {
    container.innerHTML = '';

    const selector = UI.createPageSelector(pages, { multi: true, id: 'text-post-pages' });
    container.appendChild(selector.el);

    const form = document.createElement('div');
    form.className = 'card';
    form.innerHTML = `
      <div class="card__title">New Post</div>
      <div class="form-group">
        <label>Message</label>
        <textarea id="text-post-msg" placeholder="What's on your mind?"></textarea>
      </div>
      <div class="form-group">
        <label>Link URL (optional)</label>
        <input type="url" id="text-post-link" placeholder="https://example.com">
        <div class="form-hint">If provided, Facebook will generate a link preview.</div>
      </div>
      <div class="form-group" id="schedule-group">
        <label><input type="checkbox" id="text-post-schedule-check"> Schedule for later</label>
        <input type="datetime-local" id="text-post-schedule" style="display:none;margin-top:8px;">
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn--primary" id="text-post-btn">📤 Publish Now</button>
        <button class="btn btn--outline" id="text-preview-btn">👁️ Preview</button>
      </div>
      <div id="text-post-preview" style="margin-top:16px;display:none"></div>
      <div id="text-post-result" style="margin-top:16px;"></div>
    `;
    container.appendChild(form);

    const scheduleCheck = form.querySelector('#text-post-schedule-check');
    const scheduleInput = form.querySelector('#text-post-schedule');
    scheduleCheck.addEventListener('change', () => {
      scheduleInput.style.display = scheduleCheck.checked ? '' : 'none';
    });

    form.querySelector('#text-preview-btn').addEventListener('click', () => {
      const msg = form.querySelector('#text-post-msg').value.trim();
      const link = form.querySelector('#text-post-link').value.trim();
      const preview = form.querySelector('#text-post-preview');
      if (!msg && !link) { UI.toast('Enter some text or a link to preview.', 'warning'); return; }
      preview.style.display = '';
      preview.innerHTML = buildPreview(msg, link, pages[0]);
    });

    form.querySelector('#text-post-btn').addEventListener('click', async () => {
      const targets = selector.getSelected();
      if (!targets.length) { UI.toast('Select at least one page.', 'warning'); return; }

      const msg = form.querySelector('#text-post-msg').value.trim();
      const link = form.querySelector('#text-post-link').value.trim();
      if (!msg && !link) { UI.toast('Enter a message or a link.', 'warning'); return; }

      const isScheduled = scheduleCheck.checked;
      const scheduleTime = scheduleInput.value;

      if (isScheduled && scheduleTime) {
        const ts = new Date(scheduleTime).getTime();
        if (ts < Date.now()) { UI.toast('Schedule time must be in the future.', 'warning'); return; }
        Scheduled.addQueue({ type: 'text', targetIds: targets.map(t => t.id), message: msg, link, scheduledAt: ts });
        UI.toast('Added to scheduled queue!', 'success');
        App.updateQueueBadge();
        return;
      }

      const btn = form.querySelector('#text-post-btn');
      btn.disabled = true;
      btn.textContent = 'Publishing…';
      const resultDiv = form.querySelector('#text-post-result');
      resultDiv.innerHTML = '';

      try {
        const results = await API.publishToMultiplePages(targets.map(t => t.id), pid => API.publishText(pid, msg, link));
        const success = results.filter(r => r.success);
        const fail = results.filter(r => !r.success);
        if (success.length) UI.toast(`Published to ${success.length} page(s)`, 'success');
        if (fail.length) UI.toast(`Failed on ${fail.length} page(s)`, 'error');
        resultDiv.innerHTML = buildResultHTML(results);
      } catch (e) {
        UI.toast('Publish failed: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📤 Publish Now';
      }
    });
  }

  function buildPreview(msg, link, page) {
    return `
      <div class="post-preview">
        <div class="post-preview__header">
          <img class="post-preview__avatar" src="${page?.picture?.data?.url || ''}" onerror="this.style.display='none'">
          <div><div class="post-preview__author">${UI.esc(page?.name || 'Page Name')}</div><div class="post-preview__time">Just now</div></div>
        </div>
        <div class="post-preview__content">${UI.esc(msg).replace(/\n/g, '<br>')}</div>
        ${link ? `<div class="post-preview__link"><div class="post-preview__link-info"><div class="post-preview__link-title">Link Preview</div><div class="post-preview__link-desc">${UI.esc(link)}</div></div></div>` : ''}
      </div>
    `;
  }

  function buildResultHTML(results) {
    return `<ul style="font-size:0.85rem;line-height:1.8;">` + results.map(r =>
      `<li>${r.success ? '✅' : '❌'} Page ${r.pageId} ${r.success ? '' : '— ' + UI.esc(r.error)}</li>`
    ).join('') + `</ul>`;
  }

  return { render };
})();
