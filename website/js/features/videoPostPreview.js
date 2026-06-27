/**
 * videoPostPreview.js — Preview-first composer signature
 *
 * Augments the existing VideoPost feature with a live, side-by-side
 * Facebook post preview. Non-invasive: wraps VideoPost's rendered DOM
 * in a two-column grid (composer + preview) and observes composer
 * inputs to re-render the preview as the user types.
 *
 * Design rules (see spec):
 *  - Composer column = .vp-col--composer with all original VideoPost cards
 *  - Preview column = .vp-col--preview with a single .post-preview card
 *  - Preview mirrors composer: page avatar/name, caption (same-caption or first
 *    per-video caption), first video URL, optional schedule time
 *  - Mobile (<1024px): preview becomes a floating "Live preview" button that
 *    opens a full-screen sheet
 */

(function () {
  'use strict';

  const PREVIEW_MARKER = 'vp-enhanced';
  const CONTENT_SEL = '#content';
  const VIDEO_POST_SIGNATURE = '#video-page-select';

  const previewState = {
    page: null,           // { id, name, picture }
    caption: '',
    videoUrl: '',
    videoCount: 0,
    scheduleTime: null,   // unix seconds
    scheduleMode: 'post-now',
    debounceTimer: null,
    pages: [],
  };

  /* ============================================================
     Page lookup helpers (re-derive pages from the page <select>)
     ============================================================ */

  function readPagesFromSelect() {
    const sel = document.querySelector('#video-page-select');
    if (!sel) return [];
    return Array.from(sel.options)
      .filter(o => o.value)
      .map(o => ({
        id: o.value,
        name: o.textContent.split(' (')[0],
      }));
  }

  function getSelectedPageMeta() {
    const sel = document.querySelector('#video-page-select');
    if (!sel || !sel.value) return null;
    // Try to find page picture from the page selector grid (UI.createPageSelector)
    const grid = document.querySelector('.page-grid .page-card');
    const pic = grid ? grid.querySelector('.page-card__pic') : null;
    return {
      id: sel.value,
      name: sel.options[sel.selectedIndex].textContent.split(' (')[0],
      picture: pic ? pic.getAttribute('src') : '',
    };
  }

  /* ============================================================
     Preview rendering
     ============================================================ */

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function formatScheduleTime(unixSec) {
    if (!unixSec) return 'Just now';
    const d = new Date(unixSec * 1000);
    return d.toLocaleString();
  }

  function renderPreviewHTML() {
    const page = previewState.page;
    const caption = previewState.caption || '';
    const videoUrl = previewState.videoUrl;
    const count = previewState.videoCount;
    const scheduleLabel = formatScheduleTime(previewState.scheduleTime);

    const avatar = page && page.picture
      ? `<img class="post-preview__avatar" src="${escapeHtml(page.picture)}" alt="" onerror="this.style.visibility='hidden'">`
      : `<div class="post-preview__avatar" style="background:linear-gradient(135deg,#a5b4fc,#f0abfc)"></div>`;
    const name = page ? page.name : 'Your page';

    let mediaHTML = '';
    if (videoUrl) {
      mediaHTML = `<div class="post-preview__media"><video src="${escapeHtml(videoUrl)}" muted playsinline preload="metadata" onloadeddata="this.currentTime=0"></video></div>`;
    } else if (count > 1) {
      // Tiny multi-video indicator when many queued but none picked yet
      mediaHTML = `<div class="post-preview__media" style="display:flex;align-items:center;justify-content:center;min-height:120px;background:linear-gradient(135deg,rgba(165,180,252,0.18),rgba(240,171,252,0.18));color:#65676b;font-size:13px">${count} videos queued</div>`;
    }

    const hasContent = caption || videoUrl || count > 0;
    const bodyHTML = hasContent
      ? `<div class="post-preview__content">${escapeHtml(caption) || '<span style="color:#8a8d91">Your caption will appear here…</span>'}</div>`
      : `<div class="post-preview__content" style="color:#8a8d91;font-style:italic">Start writing — your post preview lives here.</div>`;

    return `
      <article class="post-preview" aria-label="Live preview">
        <header class="post-preview__header">
          ${avatar}
          <div>
            <div class="post-preview__author">${escapeHtml(name)}</div>
            <div class="post-preview__time">${escapeHtml(scheduleLabel)}${previewState.scheduleMode === 'manual' && previewState.scheduleTime ? ' · Scheduled' : ''}</div>
          </div>
        </header>
        ${bodyHTML}
        ${mediaHTML}
        <footer class="post-preview__actions">
          <span>👍 Like</span>
          <span>💬 Comment</span>
          <span>↗ Share</span>
        </footer>
      </article>
    `;
  }

  function mountPreviewInto(target) {
    if (!target) return;
    target.innerHTML = renderPreviewHTML();
  }

  function refreshPreview() {
    const desktop = document.getElementById('vp-preview-desktop');
    const sheetBody = document.getElementById('vp-preview-sheet-body');
    if (desktop) mountPreviewInto(desktop);
    if (sheetBody) mountPreviewInto(sheetBody);
  }

  function debouncedRefresh() {
    clearTimeout(previewState.debounceTimer);
    previewState.debounceTimer = setTimeout(refreshPreview, 80);
  }

  /* ============================================================
     Composer state extraction
     ============================================================ */

  function readComposerState() {
    const page = getSelectedPageMeta();
    const sameCaptionToggle = document.querySelector('#same-caption-toggle');
    const sameCaption = sameCaptionToggle ? sameCaptionToggle.checked : false;
    const globalCaption = (document.querySelector('#video-global-caption') || {}).value || '';

    let caption = '';
    if (sameCaption) {
      caption = globalCaption;
    } else {
      const firstItemCaption = document.querySelector('.video-caption-input');
      if (firstItemCaption) caption = firstItemCaption.value || '';
    }

    // First video URL from queue list
    const firstVideo = document.querySelector('#video-queue-list video');
    const videoUrl = firstVideo ? firstVideo.getAttribute('src') || '' : '';
    const videoCount = document.querySelectorAll('#video-queue-list .file-item').length;

    // Schedule
    const modeSel = document.querySelector('#schedule-mode-select');
    const scheduleMode = modeSel ? modeSel.value : 'post-now';
    let scheduleTime = null;
    if (scheduleMode === 'manual') {
      const firstSchedule = document.querySelector('.video-schedule-input');
      if (firstSchedule && firstSchedule.value) {
        const d = new Date(firstSchedule.value);
        if (!isNaN(d.getTime())) scheduleTime = Math.floor(d.getTime() / 1000);
      }
    }

    previewState.page = page;
    previewState.caption = caption;
    previewState.videoUrl = videoUrl;
    previewState.videoCount = videoCount;
    previewState.scheduleTime = scheduleTime;
    previewState.scheduleMode = scheduleMode;
  }

  /* ============================================================
     Wiring: observe composer changes after VideoPost renders
     ============================================================ */

  function attachComposerListeners() {
    // Page select
    const pageSel = document.querySelector('#video-page-select');
    if (pageSel && !pageSel.__vpWired) {
      pageSel.__vpWired = true;
      pageSel.addEventListener('change', () => { readComposerState(); refreshPreview(); });
    }
    // Caption controls
    const sameToggle = document.querySelector('#same-caption-toggle');
    if (sameToggle && !sameToggle.__vpWired) {
      sameToggle.__vpWired = true;
      sameToggle.addEventListener('change', () => { readComposerState(); refreshPreview(); });
    }
    const globalCap = document.querySelector('#video-global-caption');
    if (globalCap && !globalCap.__vpWired) {
      globalCap.__vpWired = true;
      globalCap.addEventListener('input', () => { readComposerState(); debouncedRefresh(); });
    }
    // Schedule controls
    const modeSel = document.querySelector('#schedule-mode-select');
    if (modeSel && !modeSel.__vpWired) {
      modeSel.__vpWired = true;
      modeSel.addEventListener('change', () => { readComposerState(); refreshPreview(); });
    }
    // Queue list — delegate via input event on its container
    const queueList = document.querySelector('#video-queue-list');
    if (queueList && !queueList.__vpWired) {
      queueList.__vpWired = true;
      queueList.addEventListener('input', () => { readComposerState(); debouncedRefresh(); });
      queueList.addEventListener('change', () => { readComposerState(); debouncedRefresh(); });
      // Mutation observer for queue add/remove (no input event fires)
      const qObserver = new MutationObserver(() => { readComposerState(); debouncedRefresh(); });
      qObserver.observe(queueList, { childList: true, subtree: true });
    }
  }

  /* ============================================================
     Two-column wrapper
     ============================================================ */

  function buildColumns() {
    const content = document.querySelector(CONTENT_SEL);
    if (!content) return;

    // Pull existing children into the composer column
    const composer = document.createElement('div');
    composer.className = 'vp-col vp-col--composer';
    composer.appendChild(document.createElement('div'));
    composer.firstChild.className = 'vp-col__label';
    composer.firstChild.textContent = 'Composer';

    // Move all existing children into the composer column
    const existing = Array.from(content.children);
    existing.forEach(node => composer.appendChild(node));

    // Build preview column
    const preview = document.createElement('div');
    preview.className = 'vp-col vp-col--preview';
    const previewLabel = document.createElement('div');
    previewLabel.className = 'vp-col__label';
    previewLabel.textContent = 'Live Preview';
    const previewWrap = document.createElement('div');
    previewWrap.className = 'vp-preview-wrap';
    const previewInner = document.createElement('div');
    previewInner.className = 'vp-preview-inner';
    previewInner.id = 'vp-preview-desktop';
    previewWrap.appendChild(previewInner);
    preview.appendChild(previewLabel);
    preview.appendChild(previewWrap);

    // Wrap in grid
    const grid = document.createElement('div');
    grid.className = 'vp-grid';
    grid.appendChild(composer);
    grid.appendChild(preview);
    content.appendChild(grid);

    // Initial state + render
    readComposerState();
    refreshPreview();
    attachComposerListeners();
  }

  /* ============================================================
     Mobile preview FAB + sheet
     ============================================================ */

  function wireMobilePreviewControls() {
    const fab = document.getElementById('vp-preview-fab');
    const sheet = document.getElementById('vp-preview-sheet');
    const closeBtn = document.getElementById('vp-preview-close');
    if (!fab || !sheet || !closeBtn) return;
    if (fab.__vpWired) return;

    const open = () => {
      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
      readComposerState();
      refreshPreview();
    };
    const close = () => {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    };

    fab.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sheet.classList.contains('open')) close();
    });
    fab.__vpWired = true;
  }

  /* ============================================================
     Boot — observe content for VideoPost render
     ============================================================ */

  function boot() {
    const content = document.querySelector(CONTENT_SEL);
    if (!content) return;

    const observer = new MutationObserver(() => {
      const hasVideoPost = content.querySelector(VIDEO_POST_SIGNATURE);
      if (hasVideoPost && !content.classList.contains(PREVIEW_MARKER)) {
        // Give VideoPost's own renderQueue() a tick to settle
        setTimeout(() => {
          buildColumns();
          wireMobilePreviewControls();
          content.classList.add(PREVIEW_MARKER);
        }, 0);
      } else if (!hasVideoPost && content.classList.contains(PREVIEW_MARKER)) {
        content.classList.remove(PREVIEW_MARKER);
      }
    });
    observer.observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
