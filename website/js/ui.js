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

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { toast, setStatus, spinner, esc };
})();
