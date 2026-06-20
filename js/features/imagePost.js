/**
 * imagePost.js — Feature 3: Bulk Image / Carousel Posting
 */
const ImagePost = (function () {
  const filesState = [];

  function render(container, pages) {
    container.innerHTML = '';
    filesState.length = 0;

    const selector = UI.createPageSelector(pages, { multi: true, id: 'image-post-pages' });
    container.appendChild(selector.el);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__title">Upload Images</div>
      <div class="drop-zone" id="image-dropzone">
        <div class="drop-zone__icon">🖼️</div>
        <div>Drag &amp; drop image files here</div>
        <div style="font-size:0.85rem;color:#8a8d91;margin-top:4px">or click to browse (multiple allowed)</div>
        <input type="file" id="image-input" accept="image/*" multiple style="display:none">
      </div>
      <div class="form-group" style="margin-top:16px">
        <label>Caption</label>
        <textarea id="image-caption" placeholder="Write a caption for the images…"></textarea>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn--primary" id="image-upload-btn">📤 Publish</button>
        <button class="btn btn--outline" id="image-clear-btn">Clear</button>
        <button class="btn btn--outline" id="image-schedule-btn">⏰ Schedule All</button>
      </div>
      <div class="file-list" id="image-file-list"></div>
    `;
    container.appendChild(card);

    const dropzone = card.querySelector('#image-dropzone');
    const input = card.querySelector('#image-input');

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); dropzone.classList.remove('dragover');
      addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
    });
    input.addEventListener('change', () => addFiles(Array.from(input.files)));

    card.querySelector('#image-clear-btn').addEventListener('click', () => { filesState.length = 0; renderList(); });

    card.querySelector('#image-upload-btn').addEventListener('click', () => doPublish(false));
    card.querySelector('#image-schedule-btn').addEventListener('click', () => doPublish(true));

    function doPublish(schedule) {
      const targets = selector.getSelected();
      if (!targets.length) { UI.toast('Select at least one target page.', 'warning'); return; }
      if (!filesState.length) { UI.toast('Add images first.', 'warning'); return; }
      const caption = card.querySelector('#image-caption').value.trim();

      if (schedule) {
        const timeStr = prompt('Schedule for (YYYY-MM-DD HH:MM)?', new Date(Date.now()+3600000).toISOString().slice(0,16).replace('T',' '));
        if (!timeStr) return;
        const ts = new Date(timeStr.replace(' ','T')).getTime();
        if (isNaN(ts) || ts < Date.now()) { UI.toast('Invalid or past time.', 'warning'); return; }
        Scheduled.addQueue({ type: 'image', targetIds: targets.map(t=>t.id), caption, files: filesState.map(f => f.file), scheduledAt: ts });
        UI.toast('Images queued for scheduled posting!', 'success');
        App.updateQueueBadge();
        return;
      }

      const btn = card.querySelector('#image-upload-btn');
      btn.disabled = true; btn.textContent = 'Publishing…';
      publishImages(targets, caption).finally(() => { btn.disabled = false; btn.textContent = '📤 Publish'; });
    }
  }

  function addFiles(files) {
    for (const f of files) {
      const url = URL.createObjectURL(f);
      filesState.push({ id: Math.random().toString(36).slice(2), file: f, preview: url, status: 'Ready', error: null });
    }
    renderList();
  }

  function renderList() {
    const list = document.getElementById('image-file-list');
    if (!list) return;
    if (!filesState.length) { list.innerHTML = ''; return; }
    list.innerHTML = filesState.map(item => `
      <div class="file-item ${item.status==='Done'?'success':item.error?'error':''}">
        <img class="file-item__thumb" src="${item.preview}" alt="">
        <div class="file-item__info">
          <div class="file-item__name">${UI.esc(item.file.name)}</div>
          <div class="file-item__size">${(item.file.size/1024).toFixed(1)} KB</div>
          <div class="file-item__status">${UI.esc(item.status)}</div>
        </div>
        <button class="file-item__remove" data-id="${item.id}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.file-item__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = filesState.findIndex(f => f.id === btn.dataset.id);
        if (idx > -1) { URL.revokeObjectURL(filesState[idx].preview); filesState.splice(idx, 1); renderList(); }
      });
    });
  }

  async function publishImages(targets, caption) {
    // Upload each image as a photo post to each selected page.
    for (const item of filesState) {
      item.status = 'Uploading…';
      item.results = [];
      renderList();

      for (const page of targets) {
        try {
          const r = await API.uploadPhoto(page.id, item.file, caption);
          item.results.push({ pageId: page.id, postId: r.id });
        } catch (err) {
          item.results.push({ pageId: page.id, error: err.message });
          if (!item.error) item.error = err.message;
        }
        renderList();
      }

      const ok = item.results.filter(r => r.postId).length;
      const fail = item.results.filter(r => r.error).length;
      if (ok && !fail) {
        item.status = 'Done';
      } else if (fail) {
        item.status = `Failed on ${fail} page(s)`;
      }
      renderList();
    }

    const totalOk = filesState.filter(f => f.status === 'Done').length;
    if (totalOk) UI.toast(`${totalOk} image upload(s) completed`, 'success');
  }

  return { render };
})();
