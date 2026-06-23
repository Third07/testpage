/**
 * scheduled.js — Scheduled Video Queue
 * 
 * Queue stored in localStorage as `fbmanager_queue`.
 * A polling loop checks every 30 seconds for due items and publishes them.
 */
const Scheduled = (function () {
  const STORAGE_KEY = 'fbmanager_queue';
  let items = [];

  function load() {
    try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { items = []; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

  function addQueue(entry) {
    entry.id = entry.id || Math.random().toString(36).slice(2);
    entry.status = entry.status || 'pending';
    items.push(entry);
    save();
    if (typeof App !== 'undefined') App.updateQueueBadge();
  }
  function removeQueue(id) { items = items.filter(i => i.id !== id); save(); if (typeof App !== 'undefined') App.updateQueueBadge(); }
  function getQueueCount() { return items.filter(i => i.status === 'pending').length; }
  function getQueue() { return [...items]; }

  function render(container, pages) {
    container.innerHTML = '';
    load();

    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-weight:600">Scheduled Videos</h3>
        <div>
          <button class="btn btn--danger btn--small" id="queue-clear-all">🗑️ Clear All</button>
          <button class="btn btn--secondary btn--small" id="queue-run-now" style="margin-left:8px">▶️ Run Now</button>
        </div>
      </div>
    `;
    container.appendChild(header);

    header.querySelector('#queue-clear-all').addEventListener('click', () => {
      if (!confirm('Clear all queued videos?')) return;
      items = []; save(); renderList(); if (typeof App !== 'undefined') App.updateQueueBadge();
    });
    header.querySelector('#queue-run-now').addEventListener('click', () => {
      processQueue(true);
    });

    const listWrap = document.createElement('div');
    listWrap.id = 'queue-list';
    container.appendChild(listWrap);
    renderList();

    function renderList() {
      load();
      if (!items.length) {
        listWrap.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">⏰</div>
            <div class="empty-state__title">No scheduled videos</div>
            <div class="empty-state__desc">Videos will appear here when you schedule them using the auto-schedule or manual scheduling options.</div>
          </div>
        `;
        return;
      }
      listWrap.innerHTML = '';
      const sorted = [...items].sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
      sorted.forEach(item => {
        const due = (item.scheduledAt || 0) <= Date.now();
        const timeStr = item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Unknown';
        const targetNames = (item.targetIds || []).map(id => {
          const p = pages.find(x => x.id === id || String(x.id) === id);
          return p ? p.name : id;
        }).join(', ');
        const el = document.createElement('div');
        el.className = 'queue-item';
        el.style.borderLeft = `4px solid ${due ? '#e41e3f' : '#1877f2'}`;
        el.innerHTML = `
          <div class="queue-item__time">${timeStr}</div>
          <div class="queue-item__body">
            <div class="queue-item__type">Video · ${item.status}</div>
            <div class="queue-item__text">${UI.esc(item.caption || '(no caption)').substring(0, 120)}${(item.caption || '').length > 120 ? '…' : ''}</div>
            <div style="font-size:0.75rem;color:#8a8d91;margin-top:4px">To: ${UI.esc(targetNames)}</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn--small btn--outline queue-remove" data-id="${item.id}">Remove</button>
            <button class="btn btn--small btn--primary queue-run" data-id="${item.id}">Run</button>
          </div>
        `;
        listWrap.appendChild(el);
      });

      listWrap.querySelectorAll('.queue-remove').forEach(btn => {
        btn.addEventListener('click', () => { removeQueue(btn.dataset.id); renderList(); });
      });
      listWrap.querySelectorAll('.queue-run').forEach(btn => {
        btn.addEventListener('click', () => processSingle(btn.dataset.id, renderList));
      });
    }
  }

  async function processQueue(forceAll = false) {
    load();
    const pending = items.filter(i => i.status === 'pending' && (forceAll || (i.scheduledAt || 0) <= Date.now()));
    if (!pending.length) { if (forceAll) UI.toast('No pending items to run.', 'info'); return; }

    for (const item of pending) {
      await processSingle(item.id);
    }
    App.updateQueueBadge();
  }

  async function processSingle(id, callback) {
    load();
    const item = items.find(i => i.id === id);
    if (!item) return;
    item.status = 'running'; save(); if (typeof App !== 'undefined') App.updateQueueBadge();

    try {
      if (item.type === 'video') {
        if (item.videoUrl) {
          await API.publishToMultiplePages(item.targetIds, pid =>
            API.publishVideoByUrl(pid, item.videoUrl, item.caption + (item.link ? '\n\n' + item.link : ''), '')
          );
        } else {
          throw new Error('Scheduled video requires a URL.');
        }
      } else {
        throw new Error('Unknown queue type: ' + item.type);
      }
      item.status = 'done';
      UI.toast('Video posted successfully', 'success');
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      item.status = 'failed';
      item.error = msg;
      UI.toast('Video posting failed: ' + msg, 'error');
    }
    save();
    if (typeof App !== 'undefined') App.updateQueueBadge();
    if (callback) callback();
  }

  // Global polling loop
  setInterval(() => {
    if (!Bridge.isConnected()) return;
    processQueue(false);
  }, 30000);

  load();
  window.Scheduled = { render, addQueue, removeQueue, getQueueCount, getQueue };
  return { render, addQueue, removeQueue, getQueueCount, getQueue };
})();
