/**
 * ui.js — Shared UI helpers
 */
const UI = (function () {
  const container = document.getElementById('toast-container');
  const extStatus = document.getElementById('ext-status');

  function toast(message, type = 'info', duration = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  function setStatus(connected, text) {
    extStatus.classList.toggle('connected', connected);
    extStatus.querySelector('.ext-status__text').textContent = text;
  }

  function spinner(size = '') {
    const el = document.createElement('div');
    el.className = `spinner ${size}`;
    return el;
  }

  /** Create a reusable page selector that persists selection across views */
  function createPageSelector(pages, { multi = true, id = 'page-selector' } = {}) {
    const selectedIds = new Set();
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML = `<label>${multi ? 'Select target pages' : 'Select target page'}</label>`;
    const grid = document.createElement('div');
    grid.className = 'page-grid';
    grid.id = id;

    function render() {
      grid.innerHTML = '';
      if (!pages || !pages.length) {
        grid.innerHTML = '<p style="color:#8a8d91;font-size:0.9rem">No pages loaded yet. Connect the extension first.</p>';
        return wrap;
      }
      pages.forEach(p => {
        const card = document.createElement('div');
        card.className = 'page-card' + (selectedIds.has(p.id) ? ' selected' : '');
        card.dataset.id = p.id;
        card.innerHTML = `
          <img class="page-card__pic" src="${p.picture?.data?.url || ''}" alt="" onerror="this.style.visibility='hidden'">
          <div class="page-card__info">
            <div class="page-card__name">${esc(p.name)}</div>
            <div class="page-card__cat">${esc(p.category || '')}</div>
            <div class="page-card__fans">${(p.fan_count || 0).toLocaleString()} likes</div>
          </div>
          <div class="page-card__check">${selectedIds.has(p.id) ? '✓' : ''}</div>
        `;
        card.addEventListener('click', () => {
          if (multi) {
            selectedIds.has(p.id) ? selectedIds.delete(p.id) : selectedIds.add(p.id);
          } else {
            selectedIds.clear();
            selectedIds.add(p.id);
          }
          render();
        });
        grid.appendChild(card);
      });
    }
    render();
    wrap.appendChild(grid);

    return {
      el: wrap,
      getSelected: () => pages.filter(p => selectedIds.has(p.id)),
      getSelectedIds: () => Array.from(selectedIds),
      setPages: (newPages) => { pages = newPages; render(); },
      clear: () => { selectedIds.clear(); render(); },
    };
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { toast, setStatus, spinner, createPageSelector, esc };
})();
