/**
 * bridge.js — MetusV2 Extension Communication Bridge
 *
 * The content script (content.js) injected by the extension communicates with
 * the page via CustomEvents:
 *   Page  → Ext:  dispatchEvent(new CustomEvent('metus_page_to_content', {detail:{event,data}}))
 *   Ext   → Page: dispatchEvent(new CustomEvent('metus_content_to_page',  {detail:{event,data}}))
 *
 * The extension's background script handles the 'login' event by extracting the
 * Facebook access token (EAAB...) from adsmanager.facebook.com and returning it
 * alongside the full cookie string.
 */

const Bridge = (function () {
  const EVT_OUT = 'metus_page_to_content';
  const EVT_IN  = 'metus_content_to_page';

  let accessToken = null;
  let cookieString = null;
  let connected = false;
  let pendingResolves = new Map();
  let msgCounter = 0;

  function init() {
    window.addEventListener(EVT_IN, onExtensionMessage);
    console.log('[Bridge] Listening for extension messages');
  }

  function onExtensionMessage(e) {
    const payload = e?.detail;
    if (!payload) return;
    console.log('[Bridge] Received from extension:', payload);

    if (payload.token) {
      accessToken = payload.token;
      cookieString = payload.cookieString || null;
      connected = true;
      _trigger('connected', { token: accessToken, cookieString });
    }
    if (payload.error) {
      connected = false;
      _trigger('error', { error: payload.error });
    }

    // resolve pending promises keyed by message id
    if (payload._id && pendingResolves.has(payload._id)) {
      const { resolve, reject } = pendingResolves.get(payload._id);
      pendingResolves.delete(payload._id);
      if (payload.error) reject(new Error(payload.error));
      else resolve(payload);
    }

    _trigger(payload.event || 'message', payload);
  }

  const listeners = {};
  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return () => off(event, fn);
  }
  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }
  function _trigger(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(fn => {
      try { fn(data); } catch (e) { console.error(e); }
    });
  }

  function send(event, data = {}, waitResponse = false) {
    return new Promise((resolve, reject) => {
      const id = ++msgCounter;
      if (waitResponse) {
        pendingResolves.set(id, { resolve, reject });
        setTimeout(() => {
          if (pendingResolves.has(id)) {
            pendingResolves.delete(id);
            reject(new Error('Extension response timeout'));
          }
        }, 15000);
      }
      const detail = { event, data, _id: id };
      window.dispatchEvent(new CustomEvent(EVT_OUT, { detail }));
      console.log('[Bridge] Sent to extension:', detail);
      if (!waitResponse) resolve();
    });
  }

  async function login() {
    // content.js forwards page messages to bg script; bg script handles 'login'
    await send('login', {}, false);
    // bg script sends back via the same custom event path
    // The response is emitted as EVT_IN with {token, cookieString}
    // Wait a moment for the extension to respond
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Extension login timeout')), 20000);
      const unsub = on('connected', (d) => {
        clearTimeout(t);
        unsub();
        resolve(d);
      });
      // Also handle error
      const unsubErr = on('error', (d) => {
        clearTimeout(t);
        unsubErr();
        unsub();
        reject(new Error(d.error));
      });
    });
  }

  function getToken() { return accessToken; }
  function getCookies() { return cookieString; }
  function isConnected() { return connected; }

  init();
  return { on, off, send, login, getToken, getCookies, isConnected };
})();
