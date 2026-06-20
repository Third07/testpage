/**
 * app.js — Main application router and initializer
 *
 * Handles:
 * - Extension connection + token retrieval on startup
 * - Sidebar navigation and feature routing
 * - Global page list cache shared across all features
 * - Queue badge updater
 */

const App = (function () {
  const contentEl = document.getElementById('content');
  const titleEl = document.getElementById('page-title');
  const navLinks = document.querySelectorAll('.nav__link');
  const userInfoEl = document.getElementById('user-info');
  const userNameEl = document.getElementById('user-name');
  const userAvatarEl = document.getElementById('user-avatar');

  let pagesCache = [];
  let userProfile = null;
  let currentFeature = null;

  const features = {
    dashboard: () => Dashboard.render(contentEl, pagesCache),
    clonePost: () => ClonePost.render(contentEl, pagesCache),
    videoPost: () => VideoPost.render(contentEl, pagesCache),
    imagePost: () => ImagePost.render(contentEl, pagesCache),
    textPost: () => TextPost.render(contentEl, pagesCache),
    tiktokPipe: () => TiktokPipe.render(contentEl, pagesCache),
    scheduled: () => Scheduled.render(contentEl, pagesCache),
  };

  const featureTitles = {
    dashboard: 'Pages Dashboard',
    clonePost: 'Clone Post',
    videoPost: 'Multi Video Post',
    imagePost: 'Bulk Image Post',
    textPost: 'Text & Link Post',
    tiktokPipe: 'TikTok → Facebook',
    scheduled: 'Scheduled Queue',
  };

  function init() {
    // Subscribe to extension events
    Bridge.on('connected', onConnected);
    Bridge.on('error', onError);

    // Nav clicks
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const feat = link.dataset.feature;
        navigate(feat);
        history.replaceState(null, '', '#' + link.getAttribute('href').slice(1));
      });
    });

    // Hash routing
    window.addEventListener('hashchange', () => routeFromHash());

    // Persist queue badge
    setInterval(updateQueueBadge, 30000);
    updateQueueBadge();

    // Kick off extension login
    UI.setStatus(false, 'Connecting to extension…');
    attemptLogin();
  }

  async function attemptLogin() {
    try {
      await Bridge.login();
    } catch (err) {
      UI.setStatus(false, 'Extension not connected — retrying…');
      UI.toast('Extension not detected. Please make sure FB Manager is installed and you are logged into Facebook.', 'error', 6000);
      console.warn('[App] Extension login failed:', err.message);
      setTimeout(attemptLogin, 5000);
    }
  }

  async function onConnected() {
    UI.setStatus(true, 'Extension connected');
    UI.toast('Connected to extension!', 'success');

    // Load user profile and pages
    try {
      userProfile = await API.get('/me', { fields: 'id,name,picture' });
      if (userProfile) {
        userNameEl.textContent = userProfile.name || 'User';
        userAvatarEl.src = userProfile.picture?.data?.url || '';
        userInfoEl.style.display = 'flex';
      }
    } catch (e) {
      console.warn('[App] Could not load user profile:', e);
    }

    try {
      const res = await API.getMyPages();
      pagesCache = res.data || [];
      if (!pagesCache.length) {
        UI.toast('No Facebook pages found. Make sure you are a Page Admin.', 'warning', 5000);
      }
    } catch (e) {
      UI.toast('Failed to load pages: ' + e.message, 'error', 5000);
      pagesCache = [];
    }

    routeFromHash();
  }

  function onError(err) {
    UI.setStatus(false, 'Extension error');
    UI.toast('Extension error: ' + (err.error || 'Unknown'), 'error');
  }

  function routeFromHash() {
    let hash = window.location.hash.slice(1);
    if (!features[hash]) hash = 'dashboard';
    navigate(hash);
  }

  function navigate(featureKey) {
    if (!features[featureKey]) return;
    currentFeature = featureKey;

    // Update nav active state
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.feature === featureKey);
    });

    titleEl.textContent = featureTitles[featureKey];
    contentEl.innerHTML = '';
    try {
      features[featureKey]();
    } catch (e) {
      console.error(e);
      contentEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">Something went wrong</div><div class="empty-state__desc">${UI.esc(e.message)}</div></div>`;
    }
  }

  function getPages() { return pagesCache; }
  function refreshPages() {
    return API.getMyPages().then(r => { pagesCache = r.data || []; return pagesCache; });
  }

  function updateQueueBadge() {
    const count = Scheduled ? Scheduled.getQueueCount() : 0;
    const badge = document.getElementById('queue-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? '' : 'none';
    }
  }

  // Expose limited globals for modules
  window.App = { navigate, getPages, refreshPages, updateQueueBadge };
  document.addEventListener('DOMContentLoaded', init);
  return { navigate, getPages, refreshPages, updateQueueBadge };
})();
