/**
 * dashboard.js — Feature 7: Multi-Page Dashboard
 *
 * Lists all managed pages with avatars, category, fan count.
 * Shows connection status and allows quick navigation to posting features.
 */
const Dashboard = (function () {
  function render(container, pages) {
    container.innerHTML = '';

    // Header + quick actions
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-weight:600">Your Managed Pages</h3>
        <button class="btn btn--secondary" id="dash-refresh">🔄 Refresh</button>
      </div>
    `;
    container.appendChild(header);

    header.querySelector('#dash-refresh').addEventListener('click', async () => {
      const btn = header.querySelector('#dash-refresh');
      btn.disabled = true; btn.textContent = 'Loading…';
      try {
        await App.refreshPages();
        render(container, App.getPages());
        UI.toast('Pages refreshed', 'success');
      } catch (e) {
        UI.toast('Refresh failed: ' + e.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '🔄 Refresh';
      }
    });

    if (!pages || !pages.length) {
      container.innerHTML += `
        <div class="empty-state">
          <div class="empty-state__icon">📄</div>
          <div class="empty-state__title">No pages found</div>
          <div class="empty-state__desc">Make sure you are logged into Facebook and have admin access to at least one Page.</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'page-grid';
    pages.forEach(p => {
      const card = document.createElement('a');
      card.className = 'page-card';
      card.href = '#text-post';
      card.style.textDecoration = 'none';
      card.innerHTML = `
        <img class="page-card__pic" src="${p.picture?.data?.url || ''}" alt="" onerror="this.style.visibility='hidden'">
        <div class="page-card__info">
          <div class="page-card__name">${UI.esc(p.name)}</div>
          <div class="page-card__cat">${UI.esc(p.category || 'Page')}</div>
          <div class="page-card__fans">${(p.fan_count || 0).toLocaleString()} likes</div>
        </div>
      `;
      card.addEventListener('click', (e) => {
        // Pre-select this page in textPost feature later if we had shared state
        // For now just navigate
        App.navigate('textPost');
      });
      grid.appendChild(card);
    });
    container.appendChild(grid);

    // Summary stats
    const totalFans = pages.reduce((s, p) => s + (p.fan_count || 0), 0);
    const stats = document.createElement('div');
    stats.className = 'card';
    stats.style.marginTop = '24px';
    stats.innerHTML = `
      <div class="card__title">Quick Stats</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <div><strong style="font-size:1.5rem;color:#1877f2">${pages.length}</strong><div style="font-size:0.85rem;color:#65676b">Managed Pages</div></div>
        <div><strong style="font-size:1.5rem;color:#1877f2">${totalFans.toLocaleString()}</strong><div style="font-size:0.85rem;color:#65676b">Total Fans</div></div>
      </div>
    `;
    container.appendChild(stats);
  }

  return { render };
})();
