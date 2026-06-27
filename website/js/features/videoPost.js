/**
 * videoPost.js — Feature 2: Bulk Video Posting (URL-only)
 */
const VideoPost = (function () {
  let state = {
    queue: [],
    scheduleMode: 'post-now',
    scheduleInterval: 1,
    scheduleUnit: 'hours'
  };

  function id() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function formatUnixTime(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleString();
  }

  function unixToDateTimeLocal(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseDateTimeToUnix(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const sec = Math.floor(d.getTime() / 1000);
    return sec > 0 ? sec : null;
  }

  function computeAutoScheduleTimes() {
    if (state.scheduleMode !== 'auto-delay') return;
    const multipliers = { minutes: 60, hours: 3600, days: 86400 };
    const unitSec = multipliers[state.scheduleUnit] || 3600;
    const base = Math.floor(Date.now() / 1000);
    state.queue.forEach((item, idx) => {
      item.scheduleTime = base + ((idx + 1) * state.scheduleInterval * unitSec);
    });
  }

  function clearAutoScheduleTimes() {
    state.queue.forEach(item => { item.scheduleTime = null; });
  }

  function render(container, pages) {
    container.innerHTML = '';
    state.queue = [];
    state.scheduleMode = 'post-now';
    state.scheduleInterval = 1;
    state.scheduleUnit = 'hours';

    // --- Page selector card (native single-select dropdown) ---
    const pageCard = document.createElement('div');
    pageCard.className = 'card';
    pageCard.innerHTML = `
      <div class="card__title">Select Target Page</div>
      <div class="form-group">
        <select id="video-page-select">
          <option value="">-- Choose a Facebook page --</option>
          ${pages.map(p => `<option value="${p.id}">${UI.esc(p.name)} (${(p.fan_count || 0).toLocaleString()} likes)</option>`).join('')}
        </select>
      </div>
    `;
    container.appendChild(pageCard);

    // --- URL input & add section ---
    const addCard = document.createElement('div');
    addCard.className = 'card';
    addCard.innerHTML = `
      <div class="card__title">Add Videos by URL</div>
      <div class="form-group">
        <label>Video URLs</label>
        <textarea id="video-url-input" placeholder="https://example.com/video1.mp4&#10;https://example.com/video2.mp4" style="min-height:80px"></textarea>
        <div class="form-hint">One URL per line. Facebook will fetch the video directly.</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn--primary" id="video-add-btn">Add Videos</button>
        <button class="btn btn--outline" id="video-clear-btn">Clear</button>
      </div>
    `;
    container.appendChild(addCard);

    // --- Same caption toggle & global caption ---
    const captionCard = document.createElement('div');
    captionCard.className = 'card';
    captionCard.innerHTML = `
      <div class="card__title">Captions</div>
      <div class="form-group">
        <label class="toggle-row" style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:500;color:var(--color-text)">
          <input type="checkbox" id="same-caption-toggle" style="width:18px;height:18px;flex-shrink:0">
          Same caption for all videos
        </label>
      </div>
      <div class="form-group" id="global-caption-wrap" style="display:none">
        <textarea id="video-global-caption" placeholder="Write a caption to apply to all videos..." style="min-height:80px"></textarea>
      </div>
    `;
    container.appendChild(captionCard);

    // --- Schedule card ---
    const scheduleCard = document.createElement('div');
    scheduleCard.className = 'card';
    scheduleCard.innerHTML = `
      <div class="card__title">Schedule</div>
      <div class="form-group">
        <label>Scheduling mode</label>
        <select id="schedule-mode-select">
          <option value="post-now">Post now</option>
          <option value="auto-delay">Auto-delay between posts</option>
          <option value="manual">Manual schedule per video</option>
        </select>
      </div>
      <div class="form-group" id="schedule-auto-wrap" style="display:none">
        <label>Delay between posts</label>
        <div class="schedule-interval-row">
          <input type="number" id="schedule-interval" value="1" min="1" style="width:80px">
          <select id="schedule-unit">
            <option value="minutes">Minutes</option>
            <option value="hours" selected>Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        <div class="form-hint">Videos will be scheduled starting from the current time.</div>
      </div>
      <div class="form-group" id="schedule-manual-hint" style="display:none">
        <div class="form-hint">Set a date and time for each video in the queue below. Times are in your browser's local timezone.</div>
      </div>
    `;
    container.appendChild(scheduleCard);

    // --- Video queue list ---
    const queueCard = document.createElement('div');
    queueCard.className = 'card';
    queueCard.innerHTML = `
      <div class="card__title">Video Queue (<span id="video-queue-count">0</span>)</div>
      <div id="video-batch-progress" class="progress-bar" style="display:none">
        <div id="video-batch-progress-fill" class="progress-bar__fill" style="width:0%"></div>
      </div>
      <div id="video-batch-summary" class="batch-summary" style="display:none;font-size:0.8rem;color:var(--color-text-muted);margin-bottom:8px"></div>
      <div id="video-queue-list"></div>
    `;
    container.appendChild(queueCard);

    // --- Upload actions ---
    const actionCard = document.createElement('div');
    actionCard.className = 'card';
    actionCard.innerHTML = `
      <div style="display:flex;gap:10px">
        <button class="btn btn--primary" id="video-upload-btn">Upload All</button>
        <button class="btn btn--danger btn--outline" id="video-remove-all-btn">Remove All</button>
      </div>
    `;
    container.appendChild(actionCard);

    // --- DOM refs ---
    const pageSelect = pageCard.querySelector('#video-page-select');
    const sameCaptionToggle = captionCard.querySelector('#same-caption-toggle');
    const globalCaptionWrap = captionCard.querySelector('#global-caption-wrap');
    const globalCaptionInput = captionCard.querySelector('#video-global-caption');

    const scheduleModeSelect = scheduleCard.querySelector('#schedule-mode-select');
    const scheduleAutoWrap = scheduleCard.querySelector('#schedule-auto-wrap');
    const scheduleManualHint = scheduleCard.querySelector('#schedule-manual-hint');
    const scheduleIntervalInput = scheduleCard.querySelector('#schedule-interval');
    const scheduleUnitSelect = scheduleCard.querySelector('#schedule-unit');

    // --- Toggle same caption logic ---
    sameCaptionToggle.addEventListener('change', () => {
      const sameCaption = sameCaptionToggle.checked;
      globalCaptionWrap.style.display = sameCaption ? 'block' : 'none';
      renderQueue();
    });

    // --- Schedule mode logic ---
    function updateScheduleUI() {
      const mode = scheduleModeSelect.value;
      state.scheduleMode = mode;
      scheduleAutoWrap.style.display = mode === 'auto-delay' ? 'block' : 'none';
      scheduleManualHint.style.display = mode === 'manual' ? 'block' : 'none';

      if (mode === 'auto-delay') {
        computeAutoScheduleTimes();
      } else if (mode === 'post-now') {
        clearAutoScheduleTimes();
      }
      renderQueue();
    }

    scheduleModeSelect.addEventListener('change', updateScheduleUI);

    scheduleIntervalInput.addEventListener('input', () => {
      const val = parseInt(scheduleIntervalInput.value, 10);
      state.scheduleInterval = isNaN(val) || val < 1 ? 1 : val;
      if (state.scheduleMode === 'auto-delay') {
        computeAutoScheduleTimes();
        renderQueue();
      }
    });

    scheduleUnitSelect.addEventListener('change', () => {
      state.scheduleUnit = scheduleUnitSelect.value;
      if (state.scheduleMode === 'auto-delay') {
        computeAutoScheduleTimes();
        renderQueue();
      }
    });

    // --- Event wiring ---
    addCard.querySelector('#video-add-btn').addEventListener('click', () => {
      const raw = addCard.querySelector('#video-url-input').value;
      const urls = raw.split('\n').map(u => u.trim()).filter(Boolean);
      if (!urls.length) { UI.toast('Enter at least one URL.', 'warning'); return; }
      for (const url of urls) {
        state.queue.push({ id: id(), url, caption: '', status: 'pending', progress: 0, scheduleTime: null });
      }
      addCard.querySelector('#video-url-input').value = '';
      if (state.scheduleMode === 'auto-delay') {
        computeAutoScheduleTimes();
      }
      renderQueue();
      UI.toast(`${urls.length} video(s) added to queue.`, 'success');
    });

    addCard.querySelector('#video-clear-btn').addEventListener('click', () => {
      addCard.querySelector('#video-url-input').value = '';
    });

    actionCard.querySelector('#video-remove-all-btn').addEventListener('click', () => {
      if (!state.queue.length) return;
      state.queue = [];
      renderQueue();
    });

    actionCard.querySelector('#video-upload-btn').addEventListener('click', async () => {
      const pageId = pageSelect.value;
      if (!pageId) { UI.toast('Select a target page.', 'warning'); return; }
      const page = pages.find(p => p.id === pageId);
      if (!page) { UI.toast('Selected page not found.', 'warning'); return; }
      if (!state.queue.length) { UI.toast('Add videos to the queue first.', 'warning'); return; }

      const sameCaption = sameCaptionToggle.checked;
      const globalCaption = globalCaptionInput.value;

      // Validate manual schedule times are in the future
      if (state.scheduleMode === 'manual') {
        const nowSec = Math.floor(Date.now() / 1000);
        const past = state.queue.filter(item => item.scheduleTime && item.scheduleTime <= nowSec);
        if (past.length) {
          UI.toast('Some scheduled times are in the past. Please adjust them.', 'warning');
          return;
        }
      }

      const btn = actionCard.querySelector('#video-upload-btn');
      btn.disabled = true;
      btn.textContent = 'Uploading...';

      for (const item of state.queue) {
        if (item.status === 'done') continue;
        item.status = 'uploading';
        item.progress = 0;
        renderQueue();

        try {
          item.status = `Uploading to ${page.name}...`;
          item.progress = 50;
          renderQueue();
          const caption = sameCaption ? globalCaption : item.caption;
          const scheduledTime = item.scheduleTime || null;
          const r = await API.publishVideoByUrl(page.id, item.url, caption, '', scheduledTime, page.access_token);
          item.result = { pageId: page.id, postId: r.id };
          item.status = 'done';
          item.progress = 100;
        } catch (err) {
          const msg = (err && err.message) ? err.message : String(err);
          item.error = msg;
          item.status = 'failed: ' + msg;
          item.progress = 100;
        }
        renderQueue();
      }

      const ok = state.queue.filter(q => q.status === 'done').length;
      const bad = state.queue.filter(q => q.error).length;
      if (ok) UI.toast(`${ok} upload(s) completed`, 'success');
      if (bad) UI.toast(`${bad} upload(s) failed`, 'error');

      btn.disabled = false;
      btn.textContent = 'Upload All';
    });

    function renderQueue() {
      const list = queueCard.querySelector('#video-queue-list');
      const count = queueCard.querySelector('#video-queue-count');
      const batchProgress = queueCard.querySelector('#video-batch-progress');
      const batchFill = queueCard.querySelector('#video-batch-progress-fill');
      const batchSummary = queueCard.querySelector('#video-batch-summary');
      const sameCaption = sameCaptionToggle.checked;
      count.textContent = state.queue.length;

      // Batch progress & summary
      const total = state.queue.length;
      const done = state.queue.filter(q => q.status === 'done');
      const failed = state.queue.filter(q => q.error);
      const active = state.queue.filter(q => q.status !== 'pending');
      if (total > 0 && active.length > 0) {
        batchProgress.style.display = '';
        batchSummary.style.display = '';
        const pct = ((done.length + failed.length) / total) * 100;
        batchFill.style.width = pct + '%';
        batchSummary.textContent = `${done.length} of ${total} uploaded${failed.length ? `, ${failed.length} failed` : ''}`;
      } else {
        batchProgress.style.display = 'none';
        batchSummary.style.display = 'none';
      }

      if (!total) {
        list.innerHTML = '<p style="color:#8a8d91;font-size:0.9rem">No videos in queue. Add URLs above.</p>';
        return;
      }

      list.innerHTML = state.queue.map(item => {
        const statusClass = item.status === 'done' ? 'success' : item.error ? 'error' : '';
        const showProgress = item.status !== 'pending';
        const progressBar = showProgress
          ? `<div class="file-item__progress"><div class="file-item__progress-bar" style="width:${item.progress}%"></div></div>`
          : '';

        const captionInput = sameCaption
          ? ''
          : `<div style="flex:1 1 100%;margin-top:8px">
              <textarea class="video-caption-input" data-id="${item.id}" placeholder="Write a caption for this video..." style="min-height:48px;font-size:0.88rem">${UI.esc(item.caption)}</textarea>
            </div>`;

        let scheduleEl = '';
        if (state.scheduleMode === 'manual') {
          scheduleEl = `
            <div class="schedule-row" style="flex:1 1 100%;margin-top:8px">
              <label>Schedule time</label>
              <input type="datetime-local" class="video-schedule-input" data-id="${item.id}" value="${unixToDateTimeLocal(item.scheduleTime)}" style="font-size:0.9rem">
            </div>`;
        } else if (state.scheduleMode === 'auto-delay' && item.scheduleTime) {
          scheduleEl = `
            <div class="schedule-display" style="flex:1 1 100%;margin-top:6px;font-size:0.8rem;color:var(--color-text-secondary)">
              Scheduled: ${UI.esc(formatUnixTime(item.scheduleTime))}
            </div>`;
        }

        return `
          <div class="file-item ${statusClass}" style="flex-wrap:wrap">
            <div style="flex:0 0 auto;margin-right:12px">
              <div style="width:120px;height:68px;background:#e4e6eb;border-radius:6px;overflow:hidden;position:relative">
                <video src="${UI.esc(item.url)}" preload="metadata" style="width:100%;height:100%;object-fit:cover"
                       onloadeddata="this.currentTime=0" muted playsinline></video>
              </div>
            </div>
            <div class="file-item__info" style="flex:1 1 200px;min-width:200px">
              <div class="file-item__name" style="font-size:0.85rem;word-break:break-all">${UI.esc(item.url)}</div>
              ${progressBar}
              <div class="file-item__status" style="font-size:0.8rem;margin-top:2px">${UI.esc(item.status)}</div>
            </div>
            ${captionInput}
            ${scheduleEl}
            <button class="file-item__remove" data-id="${item.id}" style="position:absolute;top:8px;right:8px">&#x2715;</button>
          </div>
        `;
      }).join('');

      // Caption change handlers
      list.querySelectorAll('.video-caption-input').forEach(ta => {
        ta.addEventListener('input', () => {
          const item = state.queue.find(q => q.id === ta.dataset.id);
          if (item) item.caption = ta.value;
        });
      });

      // Schedule change handlers (manual mode)
      list.querySelectorAll('.video-schedule-input').forEach(inp => {
        inp.addEventListener('change', () => {
          const item = state.queue.find(q => q.id === inp.dataset.id);
          if (item) item.scheduleTime = parseDateTimeToUnix(inp.value);
        });
      });

      // Remove handlers
      list.querySelectorAll('.file-item__remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = state.queue.findIndex(q => q.id === btn.dataset.id);
          if (idx > -1) {
            state.queue.splice(idx, 1);
            if (state.scheduleMode === 'auto-delay') {
              computeAutoScheduleTimes();
            }
            renderQueue();
          }
        });
      });
    }

    renderQueue();
  }

  return { render };
})();
