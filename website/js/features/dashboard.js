/**
 * BulkVideoManager.js — Feature 1: Bulk Video Posting with Affiliate Links
 * 
 * Upload multiple videos via URLs with:
 * - Per-video captions and affiliate links
 * - Per-video preview
 * - Multiple page selection (dropdown)
 * - Instant or scheduled posting
 * - Auto-schedule with time intervals
 */

const BulkVideoManager = (function () {
  let videosState = [];
  let selectedPages = [];

  function render(container, pages) {
    container.innerHTML = '';
    videosState = [];
    selectedPages = [];

    // Page selector dropdown
    const pageSelector = createPageDropdown(pages);
    container.appendChild(pageSelector.el);

    // Video input card
    const inputCard = document.createElement('div');
    inputCard.className = 'card';
    inputCard.innerHTML = `
      <div class="card__title">Add Videos</div>
      <div class="form-group">
        <label>Video URLs (one per line)</label>
        <textarea id="bulk-video-urls" placeholder="https://example.com/video1.mp4
https://example.com/video2.mp4
https://example.com/video3.mp4" style="min-height:120px;"></textarea>
        <div class="form-hint">Enter direct video URLs. Facebook will fetch them directly.</div>
      </div>
      <button class="btn btn--secondary" id="bulk-video-add-btn">➕ Add Videos</button>
    `;
    container.appendChild(inputCard);

    // Video list
    const listCard = document.createElement('div');
    listCard.className = 'card';
    listCard.id = 'bulk-video-list-card';
    listCard.style.display = 'none';
    listCard.innerHTML = '<div class="card__title">Videos to Post</div><div id="bulk-video-list" class="video-list"></div>';
    container.appendChild(listCard);

    // Action card
    const actionCard = document.createElement('div');
    actionCard.className = 'card';
    actionCard.id = 'bulk-video-action-card';
    actionCard.style.display = 'none';
    actionCard.innerHTML = `
      <div class="card__title">Posting Options</div>
      <div class="form-group">
        <label>
          <input type="radio" name="schedule-type" value="instant" checked> Post Immediately
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="radio" name="schedule-type" value="manual"> Schedule Manually (Each Video)
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="radio" name="schedule-type" value="auto"> Auto Schedule (Time Intervals)
        </label>
        <div id="auto-schedule-options" style="display:none;margin-top:12px;padding:12px;background:#f7f8fa;border-radius:8px;">
          <div class="form-group">
            <label>Start Time</label>
            <input type="datetime-local" id="auto-schedule-start">
          </div>
          <div class="form-group">
            <label>Interval (hours)</label>
            <input type="number" id="auto-schedule-interval" value="1" min="0.5" step="0.5">
          </div>
          <div class="form-hint">Videos will be scheduled starting from start time with selected interval between each.</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button class="btn btn--primary btn--large" id="bulk-video-publish-btn">📤 Post Videos</button>
        <button class="btn btn--outline" id="bulk-video-clear-btn">Clear All</button>
      </div>
      <div id="bulk-video-result" style="margin-top:16px;"></div>
    `;
    container.appendChild(actionCard);

    // Event handlers
    inputCard.querySelector('#bulk-video-add-btn').addEventListener('click', () => {
      const urls = inputCard.querySelector('#bulk-video-urls').value.trim().split('\n').map(u => u.trim()).filter(Boolean);
      if (!urls.length) { UI.toast('Enter at least one video URL.', 'warning'); return; }
      addVideos(urls);
      inputCard.querySelector('#bulk-video-urls').value = '';
      showActionCard();
      renderVideoList();
    });

    actionCard.querySelector('#bulk-video-clear-btn').addEventListener('click', () => {
      if (!confirm('Clear all videos?')) return;
      videosState = [];
      renderVideoList();
      actionCard.style.display = 'none';
      listCard.style.display = 'none';
    });

    actionCard.querySelector('#bulk-video-publish-btn').addEventListener('click', () => {
      if (!selectedPages.length) { UI.toast('Select at least one page.', 'warning'); return; }
      if (!videosState.length) { UI.toast('Add videos first.', 'warning'); return; }
      
      const scheduleType = document.querySelector('input[name="schedule-type"]:checked').value;
      publishVideos(scheduleType, selectedPages, actionCard);
    });

    // Schedule type radio change
    document.querySelectorAll('input[name="schedule-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const autoOptions = actionCard.querySelector('#auto-schedule-options');
        if (radio.value === 'auto') {
          autoOptions.style.display = '';
          const startInput = actionCard.querySelector('#auto-schedule-start');
          if (!startInput.value) {
            const now = new Date();
            now.setHours(now.getHours() + 1);
            startInput.value = now.toISOString().slice(0, 16);
          }
        } else {
          autoOptions.style.display = 'none';
        }
      });
    });

    function showActionCard() {
      actionCard.style.display = '';
      listCard.style.display = '';
    }

    function renderVideoList() {
      const list = document.getElementById('bulk-video-list');
      if (!videosState.length) {
        list.innerHTML = '<p style="color:#8a8d91;text-align:center;padding:20px;">No videos added yet.</p>';
        return;
      }
      list.innerHTML = videosState.map((item, idx) => `
        <div class="video-item">
          <img class="video-item__thumbnail" src="https://via.placeholder.com/300x169?text=Video+${idx + 1}" alt="Video ${idx + 1}">
          <div class="video-item__content">
            <div class="video-item__url" title="${item.url}">${item.url.substring(0, 40)}...</div>
            <div class="video-item__caption" title="${item.caption}">${item.caption ? UI.esc(item.caption).substring(0, 60) + (item.caption.length > 60 ? '...' : '') : '(No caption)'}</div>
            ${item.scheduleTime ? `<div class="video-item__schedule">📅 ${new Date(item.scheduleTime).toLocaleString()}</div>` : ''}
            <div class="video-item__actions">
              <button class="btn btn--secondary btn--small" data-idx="${idx}" id="edit-video-${idx}">✏️ Edit</button>
              <button class="btn btn--danger btn--small" data-idx="${idx}" id="remove-video-${idx}">✕ Remove</button>
            </div>
          </div>
        </div>
      `).join('');

      // Event handlers for edit/remove
      videosState.forEach((item, idx) => {
        const editBtn = list.querySelector(`#edit-video-${idx}`);
        const removeBtn = list.querySelector(`#remove-video-${idx}`);
        
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            showEditModal(idx);
          });
        }
        
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            videosState.splice(idx, 1);
            renderVideoList();
            if (!videosState.length) actionCard.style.display = 'none';
          });
        }
      });
    }

    function showEditModal(idx) {
      const item = videosState[idx];
      const modal = document.getElementById('video-edit-modal');
      
      modal.querySelector('#modal-video-url').value = item.url;
      modal.querySelector('#modal-video-caption').value = item.caption;
      modal.querySelector('#modal-video-link').value = item.link;
      modal.querySelector('#modal-video-schedule').value = item.scheduleTime || '';

      const closeBtn = modal.querySelector('.modal__close');
      const saveBtn = modal.querySelector('#modal-save-btn');
      const cancelBtn = modal.querySelectorAll('.modal__close')[1];

      const handleClose = () => {
        modal.classList.remove('active');
        closeBtn.removeEventListener('click', handleClose);
        saveBtn.removeEventListener('click', handleSave);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleClose);
      };

      const handleSave = () => {
        videosState[idx].url = modal.querySelector('#modal-video-url').value.trim();
        videosState[idx].caption = modal.querySelector('#modal-video-caption').value.trim();
        videosState[idx].link = modal.querySelector('#modal-video-link').value.trim();
        videosState[idx].scheduleTime = modal.querySelector('#modal-video-schedule').value;
        handleClose();
        renderVideoList();
      };

      closeBtn.addEventListener('click', handleClose);
      saveBtn.addEventListener('click', handleSave);
      if (cancelBtn) cancelBtn.addEventListener('click', handleClose);

      modal.classList.add('active');
    }
  }

  function createPageDropdown(pages) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = 'Select Pages to Post';
    wrapper.appendChild(label);

    const dropdownWrapper = document.createElement('div');
    dropdownWrapper.className = 'dropdown-wrapper';
    wrapper.appendChild(dropdownWrapper);

    const button = document.createElement('button');
    button.className = 'dropdown-btn';
    button.type = 'button';
    button.innerHTML = `<span>Click to select pages</span>`;
    dropdownWrapper.appendChild(button);

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    dropdownWrapper.appendChild(menu);

    menu.innerHTML = pages.map(p => `
      <div class="dropdown-item" data-id="${p.id}">
        <img src="${p.picture?.data?.url || ''}" alt="${p.name}" onerror="this.style.display='none'">
        <div class="dropdown-item-info">
          <div class="dropdown-item-name">${UI.esc(p.name)}</div>
          <div class="dropdown-item-fans">${(p.fan_count || 0).toLocaleString()} likes</div>
        </div>
        <input type="checkbox" style="margin-left:auto;">
      </div>
    `).join('');

    const selectedList = document.createElement('div');
    selectedList.className = 'dropdown-selected-list';
    wrapper.appendChild(selectedList);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      menu.classList.toggle('active');
      button.classList.toggle('active');
    });

    menu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        item.classList.toggle('selected');

        const id = item.dataset.id;
        if (checkbox.checked) {
          selectedPages.push(pages.find(p => p.id === id || String(p.id) === id));
        } else {
          selectedPages = selectedPages.filter(p => String(p.id) !== id);
        }
        updateSelectedList();
      });
    });

    function updateSelectedList() {
      selectedList.innerHTML = selectedPages.map(p => `
        <div class="selected-tag">
          <span>${UI.esc(p.name)}</span>
          <button type="button">✕</button>
        </div>
      `).join('');

      selectedList.querySelectorAll('button').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          const pageId = selectedPages[idx].id;
          selectedPages = selectedPages.filter(p => p.id !== pageId);
          menu.querySelector(`[data-id="${pageId}"] input`).checked = false;
          menu.querySelector(`[data-id="${pageId}"]`).classList.remove('selected');
          updateSelectedList();
        });
      });

      button.innerHTML = `<span>${selectedPages.length > 0 ? `${selectedPages.length} page(s) selected` : 'Click to select pages'}</span>`;
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdownWrapper.contains(e.target)) {
        menu.classList.remove('active');
        button.classList.remove('active');
      }
    });

    return { el: wrapper };
  }

  function addVideos(urls) {
    urls.forEach(url => {
      videosState.push({
        id: Math.random().toString(36).slice(2),
        url,
        caption: '',
        link: '',
        scheduleTime: null,
        status: 'ready'
      });
    });
  }

  async function publishVideos(scheduleType, pagesList, actionCard) {
    if (scheduleType === 'manual') {
      const withoutTime = videosState.filter(v => !v.scheduleTime && v.status === 'ready');
      if (withoutTime.length > 0) {
        UI.toast('Please set schedule time for all videos using Edit.', 'warning');
        return;
      }
      videosState.forEach(v => {
        if (v.scheduleTime) {
          Scheduled.addQueue({
            type: 'video',
            targetIds: pagesList.map(p => p.id),
            videoUrl: v.url,
            caption: v.caption,
            link: v.link,
            scheduledAt: new Date(v.scheduleTime).getTime()
          });
        }
      });
      UI.toast('All videos queued!', 'success');
      App.updateQueueBadge();
      videosState = [];
      actionCard.style.display = 'none';
      return;
    }

    if (scheduleType === 'auto') {
      const startTime = document.querySelector('#auto-schedule-start').value;
      const interval = parseFloat(document.querySelector('#auto-schedule-interval').value) || 1;
      if (!startTime) { UI.toast('Set start time for auto-scheduling.', 'warning'); return; }

      const baseTime = new Date(startTime).getTime();
      videosState.forEach((v, idx) => {
        const scheduleTime = baseTime + (idx * interval * 3600000);
        if (scheduleTime < Date.now()) {
          UI.toast('Some videos scheduled in the past. Adjust start time.', 'warning');
          return;
        }
        Scheduled.addQueue({
          type: 'video',
          targetIds: pagesList.map(p => p.id),
          videoUrl: v.url,
          caption: v.caption,
          link: v.link,
          scheduledAt: scheduleTime
        });
      });
      UI.toast('All videos scheduled!', 'success');
      App.updateQueueBadge();
      videosState = [];
      actionCard.style.display = 'none';
      return;
    }

    // Instant posting
    const btn = actionCard.querySelector('#bulk-video-publish-btn');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    const resultDiv = actionCard.querySelector('#bulk-video-result');
    resultDiv.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div class="spinner spinner--sm"></div> Publishing videos…</div>';

    try {
      let allResults = [];
      for (const video of videosState) {
        const results = await API.publishToMultiplePages(pagesList.map(p => p.id), pid =>
          API.publishVideoByUrl(pid, video.url, video.caption + (video.link ? '\n\n' + video.link : ''), '')
        );
        allResults = allResults.concat(results);
      }

      const ok = allResults.filter(r => r.success).length;
      const bad = allResults.filter(r => !r.success).length;
      if (ok) UI.toast(`Posted ${videosState.length} video(s) to ${pagesList.length} page(s)`, 'success');
      if (bad) UI.toast(`Failed on ${bad} posts`, 'error');

      resultDiv.innerHTML = `<div style="padding:12px;background:#e7f3ff;border-radius:8px;color:#1877f2;"><strong>✅ ${ok} successful posts</strong> | ❌ ${bad} failed</div>`;
      videosState = [];
    } catch (e) {
      resultDiv.innerHTML = `<div style="color:#e41e3f;">❌ Error: ${UI.esc(e.message)}</div>`;
      UI.toast('Publish failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📤 Post Videos';
    }
  }

  return { render };
})();

// Create edit modal in DOM
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('video-edit-modal')) {
    const modal = document.createElement('div');
    modal.id = 'video-edit-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__content">
        <div class="modal__header">
          <h3 class="modal__title">Edit Video</h3>
          <button class="modal__close" type="button">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Video URL</label>
            <input type="url" id="modal-video-url" placeholder="https://example.com/video.mp4">
          </div>
          <div class="form-group">
            <label>Caption</label>
            <textarea id="modal-video-caption" placeholder="Add a caption for the video…" style="min-height:80px;"></textarea>
          </div>
          <div class="form-group">
            <label>Affiliate Link (optional)</label>
            <input type="url" id="modal-video-link" placeholder="https://affiliatelink.com">
            <div class="form-hint">This will be appended to the caption.</div>
          </div>
          <div class="form-group">
            <label>Schedule (optional)</label>
            <input type="datetime-local" id="modal-video-schedule">
            <div class="form-hint">Leave empty to post immediately with batch.</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn--primary" id="modal-save-btn" type="button">💾 Save</button>
          <button class="btn btn--outline modal__close" type="button">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
});
