/**
 * scheduled.js — Feature 6: Scheduled Queued Posting
 *
 * Queue stored in localStorage as `metusv2_queue`.
 * A polling loop checks every 30 seconds for due items and publishes them.
 */
const Scheduled = (function () {
  const STORAGE_KEY = 'metusv2_queue';
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
        <h3 style="font-weight:600">Scheduled Queue</h3>
        <div>
          <button class="btn btn--danger btn--small" id="queue-clear-all">Clear All</button>
          <button class="btn btn--secondary btn--small" id="queue-run-now" style="margin-left:8px">▶ Run Now</button>
        </div>
      </div>
    `;
    container.appendChild(header);

    header.querySelector('#queue-clear-all').addEventListener('click', () => {
      if (!confirm('Clear all queued items?')) return;
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
            <div class="empty-state__title">No scheduled posts</div>
            <div class="empty-state__desc">Use any posting feature and check "Schedule for later" to add items here.</div>
          </div>
        `;
        return;
      }
      listWrap.innerHTML = '';
      // Sort by time ascending
      const sorted = [...items].sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
      sorted.forEach(item => {
        const due = (item.scheduledAt || 0) <= Date.now();
        const timeStr = item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Unknown';
        const typeLabel = { text: 'Text Post', clone: 'Clone Post', image: 'Image Post', video: 'Video Post', tiktok: 'TikTok → FB' }[item.type] || item.type;
        const targetNames = (item.targetIds || []).map(id => {
          const p = pages.find(x => x.id === id);
          return p ? p.name : id;
        }).join(', ');
        const el = document.createElement('div');
        el.className = 'queue-item';
        el.style.borderLeft = `4px solid ${due ? '#e41e3f' : '#1877f2'}`;
        el.innerHTML = `
          <div class="queue-item__time">${timeStr}</div>
          <div class="queue-item__body">
            <div class="queue-item__type">${typeLabel} · ${item.status}</div>
            <div class="queue-item__text">${UI.esc(item.message || item.caption || '(no text)').substring(0,120)}${(item.message||item.caption||'').length>120?'…':''}</div>
            <div style="font-size:0.75rem;color:#8a8d91;margin-top:4px">To: ${UI.esc(targetNames)}</div>
          </div>
          <div class="actions">
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
        btn.addEventListener('click', () => processSingle(btn.dataset.id));
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

  async function processSingle(id) {
    load();
    const item = items.find(i => i.id === id);
    if (!item) return;
    item.status = 'running'; save(); if (typeof App !== 'undefined') App.updateQueueBadge();

    try {
      switch (item.type) {
        case 'text': {
          await API.publishToMultiplePages(item.targetIds, pid => API.publishText(pid, item.message, item.link || ''));
          break;
        }
        case 'clone': {
          const post = item.post;
          const att = post?.attachments?.data?.[0];
          const mediaType = att?.media_type || (post?.source ? 'video' : (post?.full_picture ? 'photo' : 'text'));
          if (mediaType === 'video' && post?.source) {
            await API.publishToMultiplePages(item.targetIds, pid => API.publishVideoByUrl(pid, post.source, item.message, ''));
          } else if (mediaType === 'photo' || post?.full_picture) {
            await API.publishToMultiplePages(item.targetIds, pid => API.publishPhoto(pid, post.full_picture || att?.url || '', item.message));
          } else {
            await API.publishToMultiplePages(item.targetIds, pid => API.publishText(pid, item.message, att?.url || ''));
          }
          break;
        }
        case 'image': {
          // Can't reliably reschedule local file uploads from localStorage without the File objects.
          // Mark as skipped and notify.
          throw new Error('Scheduled image uploads from local files are not supported (file data lost). Re-upload manually or use image URLs.');
        }
        case 'video': {
          if (item.videoUrl) {
            await API.publishToMultiplePages(item.targetIds, pid => API.publishVideoByUrl(pid, item.videoUrl, item.caption, ''));
          } else {
            throw new Error('Scheduled video requires a URL.');
          }
          break;
        }
        case 'tiktok': {
          if (item.videoUrl) {
            await API.publishToMultiplePages(item.targetIds, pid => API.publishVideoByUrl(pid, item.videoUrl, item.caption, ''));
          } else {
            throw new Error('Scheduled TikTok requires a video URL.');
          }
          break;
        }
        default:
          throw new Error('Unknown queue type: ' + item.type);
      }
      item.status = 'done';
      UI.toast('Scheduled item published successfully', 'success');
    } catch (err) {
      item.status = 'failed';
      item.error = err.message;
      UI.toast('Scheduled item failed: ' + err.message, 'error');
    }
    save();
    if (typeof App !== 'undefined') App.updateQueueBadge();
    // Re-render if currently on the Scheduled tab
    if (typeof App !== 'undefined' && document.querySelector('.nav__link[data-feature="scheduled"]')?.classList.contains('active')) {
      const c = document.getElementById('content');
      const pages = (typeof App !== 'undefined') ? App.getPages() : [];
      if (c && typeof Scheduled !== 'undefined') Scheduled.render(c, pages);
    }
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
