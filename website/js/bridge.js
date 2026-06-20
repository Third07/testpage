const Bridge = (function () {
     const EVT_OUT = 'metus_page_to_content';
     const EVT_IN  = 'metus_content_to_page';

     let accessToken = null;
     let cookieString = null;
     let connected = false;
     let pendingResolves = new Map();
     let msgCounter = 0;

     function init() {
       window.addEventListener(EVT_IN,
 onExtensionMessage);
       console.log('[Bridge] Listening for extension
 messages');
     }

     function onExtensionMessage(e) {
       const payload = e?.detail;
       if (!payload) return;
       console.log('[Bridge] Received from extension:',
 payload);

       // The extension's content script wraps the bg
 response in detail.data
       const data = payload.data || payload;

       if (data.token) {
         accessToken = data.token;
         cookieString = data.cookieString || null;
         connected = true;
         _trigger('connected', { token: accessToken,
 cookieString });
       }
       if (data.error) {
         connected = false;
         _trigger('error', { error: data.error });
       }

       const msgId = data._id || payload._id;
       if (msgId && pendingResolves.has(msgId)) {
         const { resolve, reject } =
 pendingResolves.get(msgId);
         pendingResolves.delete(msgId);
         if (data.error) reject(new Error(data.error));
         else resolve(data);
       }

       _trigger(data.event || payload.event ||
 'message', data);
     }

     const listeners = {};
     function on(event, fn) {
       if (!listeners[event]) listeners[event] = [];
       listeners[event].push(fn);
       return () => off(event, fn);
     }
     function off(event, fn) {
       if (!listeners[event]) return;
       listeners[event] = listeners[event].filter(f =>
 f !== fn);
     }
     function _trigger(event, data) {
       if (!listeners[event]) return;
       listeners[event].forEach(fn => {
         try { fn(data); } catch (e) {
 console.error(e); }
       });
     }

     function send(event, data = {}, waitResponse =
 false) {
       return new Promise((resolve, reject) => {
         const id = ++msgCounter;
         if (waitResponse) {
           pendingResolves.set(id, { resolve, reject
 });
           setTimeout(() => {
             if (pendingResolves.has(id)) {
               pendingResolves.delete(id);
               reject(new Error('Extension response
 timeout'));
             }
           }, 15000);
         }
         const detail = { event, data, _id: id };
         window.dispatchEvent(new CustomEvent(EVT_OUT,
 { detail }));
         console.log('[Bridge] Sent to extension:',
 detail);
         if (!waitResponse) resolve();
       });
     }

     async function login() {
       await send('login', {}, false);
       return new Promise((resolve, reject) => {
         const t = setTimeout(() => reject(new
 Error('Extension login timeout')), 20000);
         const unsub = on('connected', (d) => {
           clearTimeout(t);
           unsub();
           resolve(d);
         });
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
     return { on, off, send, login, getToken,
 getCookies, isConnected };
   })();
