/**
 * videoPost.js — Feature 2: Multiple Video Posting
 */
const VideoPost = (function () {
  const filesState = []; // { file, status, progress, id, result, error }

  function render(container, pages) {
    container.innerHTML = '';
    filesState.length = 0;

    const selector = UI.createPageSelector(pages, { multi: true, id: 'video-post-pages' });
    container.appendChild(selector.el);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__title">Upload Videos</div>
      <div class="drop-zone" id="video-dropzone">
        <div class="drop-zone__icon">🎬</div>
        <div>Drag &amp; drop video files here</div>
        <div style="font-size:0.85rem;color:#8a8d91;margin-top:4px">or click to browse</div>
        <input type="file" id="video-input" accept="video/*" multiple style="display:none">
      </div>
      <div style="margin-top:12px">
        <label style="display:inline-block;font-size:0.85rem">Or use video URL(s):</label>
        <textarea id="video-urls" placeholder="https://example.com/video1.mp4
https://example.com/video2.mp4" style="min-height:60px;margin-top:4px"></textarea>
        <div class="form-hint">One URL per line. Facebook will fetch the video directly.</div>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label>Caption for all uploads</label>
        <textarea id="video-caption" placeholder="Write a caption..."></textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn--primary" id="video-upload-btn">📤 Upload All</button>
        <button class="btn btn--outline" id="video-clear-btn">Clear</button>
      </div>
      <div class="file-list" id="video-file-list"></div>
    `;
    container.appendChild(card);

    const dropzone = card.querySelector('#video-dropzone');
    const input = card.querySelector('#video-input');

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/')));
    });
    input.addEventListener('change', () => addFiles(Array.from(input.files)));

    card.querySelector('#video-clear-btn').addEventListener('click', () => {
      filesState.length = 0;
      renderFileList();
    });

    card.querySelector('#video-upload-btn').addEventListener('click', async () => {
      const targets = selector.getSelected();
      if (!targets.length) { UI.toast('Select at least one target page.', 'warning'); return; }
      const caption = card.querySelector('#video-caption').value.trim();
      const urlsRaw = card.querySelector('#video-urls').value.trim();
      const urlList = urlsRaw.split('\n').map(u => u.trim()).filter(Boolean);

      if (!filesState.length && !urlList.length) { UI.toast('Add videos first.', 'warning'); return; }

      const btn = card.querySelector('#video-upload-btn');
      btn.disabled = true; btn.textContent = 'Uploading…';

      // Handle URL uploads first (fast)
      for (const url of urlList) {
        const item = { id: 'url-' + Math.random().toString(36).slice(2), file: { name: url, type: 'video/url' }, status: 'uploading', progress: 0, error: null, result: null };
        filesState.push(item);
        renderFileList();
        for (const page of targets) {
          try {
            item.status = `Uploading to ${page.name}…`;
            renderFileList();
            const r = await API.publishVideoByUrl(page.id, url, caption, '');
            item.result = { pageId: page.id, postId: r.id };
            item.status = 'Done';
            item.progress = 100;
          } catch (err) {
            item.error = err.message;
            item.status = 'Failed: ' + err.message;
          }
          renderFileList();
        }
      }

      // Handle file uploads (resumable)
      for (const item of filesState.filter(f => f.file.type.startsWith('video/'))) {
        if (item.status === 'done') continue;
        item.status = 'Uploading…';
        item.progress = 0;
        renderFileList();

        for (const page of targets) {
          try {
            item.status = `Uploading to ${page.name}…`;
            renderFileList();
            const r = await API.uploadVideo(page.id, item.file, caption);
            item.result = { pageId: page.id, postId: r.id };
            item.status = 'Done';
            item.progress = 100;
          } catch (err) {
            item.error = err.message;
            item.status = 'Failed: ' + err.message;
          }
          renderFileList();
        }
      }

      const ok = filesState.filter(f => f.status === 'Done').length;
      const bad = filesState.filter(f => f.error).length;
      if (ok) UI.toast(`${ok} upload(s) completed`, 'success');
      if (bad) UI.toast(`${bad} upload(s) failed`, 'error');

      btn.disabled = false; btn.textContent = '📤 Upload All';
    });
  }

  function addFiles(files) {
    for (const f of files) {
      filesState.push({
        id: Math.random().toString(36).slice(2),
        file: f,
        status: 'Ready',
        progress: 0,
        error: null,
        result: null,
      });
    }
    renderFileList();
  }

  function renderFileList() {
    const list = document.getElementById('video-file-list');
    if (!list) return;
    if (!filesState.length) { list.innerHTML = ''; return; }
    list.innerHTML = filesState.map(item => `
      <div class="file-item ${item.status === 'Done' ? 'success' : item.error ? 'error' : ''}">
        <div class="file-item__info">
          <div class="file-item__name">${UI.esc(item.file.name)}</div>
          <div class="file-item__size">${item.file.size ? (item.file.size / 1024 / 1024).toFixed(2) + ' MB' : 'Remote URL'}</div>
          <div class="file-item__progress"><div class="file-item__progress-bar" style="width:${item.progress}%"></div></div>
          <div class="file-item__status">${UI.esc(item.status)}</div>
        </div>
        <button class="file-item__remove" data-id="${item.id}">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.file-item__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = filesState.findIndex(f => f.id === btn.dataset.id);
        if (idx > -1) { filesState.splice(idx, 1); renderFileList(); }
      });
    });
  }

  return { render };
})();
