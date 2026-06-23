/**
 * tiktokPipe.js — Feature 5: TikTok → Facebook Pipeline
 *
 * 1. Paste TikTok URL
 * 2. Fetch info via existing Netlify /api/video-info function
 * 3. Download via existing Netlify /api/video-download function OR direct play URL
 * 4. Upload to selected Facebook pages
 */
const TiktokPipe = (function () {
  let videoInfo = null;
  let videoBlob = null;

  function render(container, pages) {
    container.innerHTML = '';
    videoInfo = null; videoBlob = null;

    const selector = UI.createPageSelector(pages, { multi: true, id: 'tiktok-pages' });
    container.appendChild(selector.el);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__title">TikTok → Facebook Pipeline</div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label>TikTok URL</label>
          <input type="url" id="tt-url" placeholder="https://www.tiktok.com/@user/video/1234567890">
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end">
          <button class="btn btn--secondary" id="tt-fetch-btn">🔍 Fetch Info</button>
        </div>
      </div>
      <div id="tt-info-area" style="margin-top:12px;display:none"></div>
      <div class="form-group" style="margin-top:16px">
        <label>Facebook Caption</label>
        <textarea id="tt-caption" placeholder="Write a caption for Facebook…"></textarea>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn--primary" id="tt-upload-btn">📤 Upload to Facebook</button>
        <button class="btn btn--outline" id="tt-schedule-btn">⏰ Schedule</button>
      </div>
      <div id="tt-result" style="margin-top:16px"></div>
    `;
    container.appendChild(card);

    card.querySelector('#tt-fetch-btn').addEventListener('click', fetchInfo);
    card.querySelector('#tt-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchInfo(); });

    card.querySelector('#tt-upload-btn').addEventListener('click', () => doUpload(false));
    card.querySelector('#tt-schedule-btn').addEventListener('click', () => doUpload(true));

    async function fetchInfo() {
      const url = card.querySelector('#tt-url').value.trim();
      if (!url) { UI.toast('Enter a TikTok URL.', 'warning'); return; }
      const btn = card.querySelector('#tt-fetch-btn');
      btn.disabled = true; btn.textContent = 'Fetching…';
      const area = card.querySelector('#tt-info-area');
      area.style.display = '';
      area.innerHTML = '<div class="spinner spinner--sm"></div> Loading…';

      try {
        const proxyUrl = `/api/video-info?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const json = await res.json();
        if (!json.data) throw new Error(json.error || 'Invalid response');
        videoInfo = json.data;
        renderInfo(area);
        UI.toast('TikTok info loaded', 'success');
      } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        area.innerHTML = `<p style="color:#e41e3f;font-size:0.9rem">Error: ${UI.esc(msg)}</p>`;
        UI.toast('Failed to fetch TikTok info: ' + msg, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '🔍 Fetch Info';
      }
    }

    function renderInfo(area) {
      const d = videoInfo;
      const cover = d.cover || d.origin_cover || d.dynamic_cover || '';
      const playUrl = d.play || d.hdplay || d.wmplay || '';
      area.innerHTML = `
        <div style="display:flex;gap:16px;align-items:flex-start">
          <img src="${cover}" style="width:120px;height:160px;object-fit:cover;border-radius:8px;background:#f0f2f5" onerror="this.style.display='none'">
          <div>
            <div style="font-weight:600">${UI.esc(d.title || 'Untitled')}</div>
            <div style="font-size:0.85rem;color:#65676b;margin-top:4px">@${UI.esc(d.author?.unique_id || 'user')}</div>
            <div style="font-size:0.8rem;color:#8a8d91;margin-top:4px">${d.duration ? Math.round(d.duration) + 's' : ''} · ${(d.size ? (d.size/1024/1024).toFixed(1)+' MB' : '')}</div>
            <div style="margin-top:8px"><video src="${playUrl}" controls style="max-height:200px;border-radius:8px"></video></div>
          </div>
        </div>
      `;
      // Pre-fill caption
      const captionInput = card.querySelector('#tt-caption');
      if (!captionInput.value.trim()) {
        captionInput.value = d.title || '';
      }
    }

    async function doUpload(schedule) {
      if (!videoInfo) { UI.toast('Fetch a TikTok video first.', 'warning'); return; }
      const targets = selector.getSelected();
      if (!targets.length) { UI.toast('Select at least one target page.', 'warning'); return; }
      const caption = card.querySelector('#tt-caption').value.trim();
      const playUrl = videoInfo.play || videoInfo.hdplay || videoInfo.wmplay;
      if (!playUrl) { UI.toast('No playable video URL found.', 'warning'); return; }

      if (schedule) {
        const timeStr = prompt('Schedule for (YYYY-MM-DD HH:MM)?', new Date(Date.now()+3600000).toISOString().slice(0,16).replace('T',' '));
        if (!timeStr) return;
        const ts = new Date(timeStr.replace(' ','T')).getTime();
        if (isNaN(ts) || ts < Date.now()) { UI.toast('Invalid time.', 'warning'); return; }
        Scheduled.addQueue({ type: 'tiktok', targetIds: targets.map(t=>t.id), caption, videoUrl: playUrl, scheduledAt: ts });
        UI.toast('TikTok video queued!', 'success');
        App.updateQueueBadge();
        return;
      }

      const btn = card.querySelector('#tt-upload-btn');
      btn.disabled = true; btn.textContent = 'Uploading…';
      const resultDiv = card.querySelector('#tt-result');
      resultDiv.innerHTML = '<div class="spinner spinner--sm"></div> Uploading to Facebook…';

      try {
        // Try direct URL upload to Facebook (uses file_url param)
        const results = await API.publishToMultiplePages(targets.map(t => t.id), pid =>
          API.publishVideoByUrl(pid, playUrl, caption, videoInfo.title || '')
        );
        const ok = results.filter(r => r.success).length;
        const bad = results.filter(r => !r.success).length;
        if (ok) UI.toast(`Uploaded to ${ok} page(s)`, 'success');
        if (bad) UI.toast(`Failed on ${bad} page(s)`, 'error');
        resultDiv.innerHTML = results.map(r =>
          `<div style="padding:8px 0;font-size:0.85rem">${r.success ? '✅' : '❌'} <strong>${UI.esc(targets.find(t=>t.id===r.pageId)?.name||r.pageId)}</strong> ${r.success?'':'— '+UI.esc(r.error)}</div>`
        ).join('');
      } catch (e) {
        resultDiv.innerHTML = `<p style="color:#e41e3f">❌ ${UI.esc(e.message)}</p>`;
        UI.toast('Upload failed: ' + e.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '📤 Upload to Facebook';
      }
    }
  }

  return { render };
})();
