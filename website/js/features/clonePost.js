/**
 * clonePost.js — Feature 1: Page Clone Posting
 *
 * Clone any Facebook post (text, photo, video, link) from one page to another.
 */
const ClonePost = (function () {
  let loadedPost = null;

  function render(container, pages) {
    container.innerHTML = '';
    loadedPost = null;

    const form = document.createElement('div');
    form.innerHTML = `
      <div class="card">
        <div class="card__title">1. Fetch Source Post</div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Source Page</label>
            <select id="clone-source-page">
              <option value="">-- Select a page --</option>
              ${pages.map(p => `<option value="${p.id}">${UI.esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="flex:1.5">
            <label>Post URL or Post ID</label>
            <input type="text" id="clone-post-url" placeholder="https://facebook.com/... or 1234567890">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn--secondary" id="clone-load-btn">📥 Load Post</button>
          </div>
        </div>
        <div id="clone-source-posts" style="margin-top:12px;display:none">
          <label>Or pick a recent post:</label>
          <div id="clone-post-list" style="margin-top:8px"></div>
        </div>
      </div>

      <div class="card" id="clone-preview-card" style="display:none">
        <div class="card__title">2. Preview & Edit</div>
        <div id="clone-preview-area"></div>
        <div class="form-group" style="margin-top:16px">
          <label>Edit message (optional)</label>
          <textarea id="clone-edit-msg"></textarea>
        </div>
      </div>

      <div class="card" id="clone-target-card" style="display:none">
        <div class="card__title">3. Select Target Pages</div>
        <div id="clone-target-selector"></div>
        <div style="margin-top:16px;display:flex;gap:10px">
          <button class="btn btn--primary" id="clone-publish-btn">📋 Clone Now</button>
          <button class="btn btn--outline" id="clone-schedule-btn">⏰ Add to Queue</button>
        </div>
        <div id="clone-result" style="margin-top:16px"></div>
      </div>
    `;
    container.appendChild(form);

    // Load recent posts when source page changes
    const sourceSelect = form.querySelector('#clone-source-page');
    const postListWrap = form.querySelector('#clone-source-posts');
    const postList = form.querySelector('#clone-post-list');

    sourceSelect.addEventListener('change', async () => {
      postList.innerHTML = '';
      if (!sourceSelect.value) { postListWrap.style.display = 'none'; return; }
      postList.innerHTML = 'Loading…';
      postListWrap.style.display = '';
      try {
        const res = await API.getPagePosts(sourceSelect.value, 10);
        const posts = res.data || [];
        if (!posts.length) {
          postList.innerHTML = '<p style="color:#8a8d91;font-size:0.85rem">No recent posts found on this page.</p>';
          return;
        }
        postList.innerHTML = '';
        posts.forEach((post, idx) => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:10px 12px;border:1px solid #e4e6eb;border-radius:8px;margin-bottom:8px;cursor:pointer;transition:background 0.15s';
          item.innerHTML = `
            <div style="font-size:0.85rem;font-weight:600">${UI.esc(post.message?.substring(0,80) || '(No text)')}</div>
            <div style="font-size:0.75rem;color:#65676b;margin-top:2px">${post.created_time ? new Date(post.created_time).toLocaleString() : ''}</div>
          `;
          item.addEventListener('mouseenter', () => item.style.background = '#f7f8fa');
          item.addEventListener('mouseleave', () => item.style.background = '');
          item.addEventListener('click', () => loadPost(post.id));
          postList.appendChild(item);
        });
      } catch (e) {
        postList.innerHTML = `<p style="color:#e41e3f;font-size:0.85rem">Error loading posts: ${UI.esc(e.message)}</p>`;
      }
    });

    // Load by URL / ID
    form.querySelector('#clone-load-btn').addEventListener('click', async () => {
      const raw = form.querySelector('#clone-post-url').value.trim();
      if (!raw) { UI.toast('Enter a post URL or ID.', 'warning'); return; }
      const postId = extractPostId(raw);
      if (!postId) { UI.toast('Could not parse post ID from URL.', 'warning'); return; }
      await loadPost(postId);
    });

    async function loadPost(postId) {
      const btn = form.querySelector('#clone-load-btn');
      btn.disabled = true; btn.textContent = 'Loading…';
      try {
        const post = await API.getPost(postId);
        loadedPost = post;
        renderPreview(form, post, pages);
        UI.toast('Post loaded', 'success');
      } catch (e) {
        UI.toast('Failed to load post: ' + e.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '📥 Load Post';
      }
    }

    // Target selector
    const targetWrap = form.querySelector('#clone-target-selector');
    const targetSelector = UI.createPageSelector(pages, { multi: true, id: 'clone-target-pages' });
    targetWrap.appendChild(targetSelector.el);

    // Publish
    form.querySelector('#clone-publish-btn').addEventListener('click', () => doClone(form, targetSelector, false));
    form.querySelector('#clone-schedule-btn').addEventListener('click', () => doClone(form, targetSelector, true));
  }

  function extractPostId(raw) {
    if (/^\d+$/.test(raw)) return raw;
    if (/^\d+_\d+$/.test(raw)) return raw;
    // URLs like https://www.facebook.com/page/posts/123456 or /posts/pfbid...
    const m = raw.match(/(?:posts|videos|photos)\/(?:pfbid[A-Za-z0-9_-]+|\d+)/);
    if (m) return m[0].split('/')[1];
    const m2 = raw.match(/(\d+_\d+)/);
    if (m2) return m2[1];
    return null;
  }

  function renderPreview(form, post, pages) {
    form.querySelector('#clone-preview-card').style.display = '';
    form.querySelector('#clone-target-card').style.display = '';
    const area = form.querySelector('#clone-preview-area');
    const edit = form.querySelector('#clone-edit-msg');
    edit.value = post.message || '';

    let mediaHtml = '';
    const att = post.attachments?.data?.[0];
    if (att) {
      if (att.media_type === 'video' || post.source) {
        mediaHtml = `<div class="post-preview__media"><video src="${post.source || att.url || ''}" controls style="max-height:300px"></video></div>`;
      } else if (att.media_type === 'photo' || post.full_picture) {
        mediaHtml = `<div class="post-preview__media"><img src="${post.full_picture || att.url || ''}" alt=""></div>`;
      } else if (att.url) {
        mediaHtml = `<div class="post-preview__media" style="padding:16px;background:#f0f2f5"><a href="${att.url}" target="_blank">${UI.esc(att.title || att.url)}</a></div>`;
      }
    } else if (post.full_picture) {
      mediaHtml = `<div class="post-preview__media"><img src="${post.full_picture}" alt=""></div>`;
    }

    area.innerHTML = `
      <div class="post-preview" style="border:none;background:#f7f8fa">
        <div class="post-preview__header">
          <img class="post-preview__avatar" src="${pages[0]?.picture?.data?.url || ''}" onerror="this.style.display='none'">
          <div><div class="post-preview__author">${UI.esc(pages[0]?.name || 'Page')}</div><div class="post-preview__time">Original post</div></div>
        </div>
        <div class="post-preview__content">${UI.esc(post.message || '(no text)').replace(/\n/g, '<br>')}</div>
        ${mediaHtml}
      </div>
    `;
  }

  async function doClone(form, targetSelector, schedule) {
    if (!loadedPost) { UI.toast('Load a post first.', 'warning'); return; }
    const targets = targetSelector.getSelected();
    if (!targets.length) { UI.toast('Select at least one target page.', 'warning'); return; }

    const editedMsg = form.querySelector('#clone-edit-msg').value.trim();
    const msg = editedMsg || loadedPost.message || '';
    const att = loadedPost.attachments?.data?.[0];
    const mediaType = att?.media_type || (loadedPost.source ? 'video' : (loadedPost.full_picture ? 'photo' : 'text'));

    if (schedule) {
      const data = { type: 'clone', targetIds: targets.map(t => t.id), message: msg, mediaType, post: loadedPost, scheduledAt: Date.now() + 60000 };
      // Show a quick prompt for schedule time
      const timeStr = prompt('Schedule for (YYYY-MM-DD HH:MM)?', new Date(Date.now() + 3600000).toISOString().slice(0,16).replace('T',' '));
      if (!timeStr) return;
      const ts = new Date(timeStr.replace(' ', 'T')).getTime();
      if (isNaN(ts) || ts < Date.now()) { UI.toast('Invalid or past time.', 'warning'); return; }
      data.scheduledAt = ts;
      Scheduled.addQueue(data);
      UI.toast('Cloning job added to queue!', 'success');
      App.updateQueueBadge();
      return;
    }

    const resultDiv = form.querySelector('#clone-result');
    resultDiv.innerHTML = '<div class="spinner spinner--sm"></div> Cloning…';
    const btn = form.querySelector('#clone-publish-btn');
    btn.disabled = true;

    try {
      let results = [];
      if (mediaType === 'video' && loadedPost.source) {
        results = await API.publishToMultiplePages(targets.map(t => t.id), pid =>
          API.publishVideoByUrl(pid, loadedPost.source, msg, '')
        );
      } else if (mediaType === 'photo' || loadedPost.full_picture) {
        const photoUrl = loadedPost.full_picture || att?.url || '';
        results = await API.publishToMultiplePages(targets.map(t => t.id), pid =>
          API.publishPhoto(pid, photoUrl, msg)
        );
      } else {
        // Link or text
        const link = att?.url || '';
        results = await API.publishToMultiplePages(targets.map(t => t.id), pid =>
          API.publishText(pid, msg, link)
        );
      }
      const ok = results.filter(r => r.success).length;
      const bad = results.filter(r => !r.success).length;
      if (ok) UI.toast(`Cloned to ${ok} page(s)`, 'success');
      if (bad) UI.toast(`Failed on ${bad} page(s)`, 'error');
      resultDiv.innerHTML = results.map(r =>
        `<div style="padding:8px 0;font-size:0.85rem;border-bottom:1px solid #f0f2f5">${r.success ? '✅' : '❌'} <strong>${UI.esc(targets.find(t => t.id === r.pageId)?.name || r.pageId)}</strong> ${r.success ? '' : '— ' + UI.esc(r.error)}</div>`
      ).join('');
    } catch (e) {
      resultDiv.innerHTML = `<p style="color:#e41e3f;font-size:0.9rem">❌ Error: ${UI.esc(e.message)}</p>`;
    } finally {
      btn.disabled = false;
    }
  }

  return { render };
})();
