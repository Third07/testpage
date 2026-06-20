/**
 * api.js — Facebook Graph API wrappers
 *
 * The FB Manager extension injects the required cookies and CORS headers automatically
 * via declarativeNetRequest for requests originating from localhost:3000, so direct
 * fetch() calls to graph.facebook.com work transparently.
 */
const API = (function () {
  const API_V = 'v18.0';
  const BASE = 'https://graph.facebook.com';

  function getToken() {
    const t = Bridge.getToken();
    if (!t) throw new Error('Not authenticated. Please ensure the FB Manager extension is installed and you are logged into Facebook.');
    return t;
  }

  function buildUrl(path, params = {}) {
    const url = new URL(`${BASE}/${API_V}${path.startsWith('/') ? '' : '/'}${path}`);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]);
    });
    return url.toString();
  }

  async function get(path, params = {}) {
    const url = buildUrl(path, { ...params, access_token: getToken() });
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  }

  async function post(path, params = {}) {
    const url = buildUrl(path, { access_token: getToken() });
    const body = new URLSearchParams();
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) body.set(k, params[k]);
    });
    const res = await fetch(url, { method: 'POST', body, credentials: 'include' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  }

  /* ---------- Account / Pages ---------- */
  async function getMyPages() {
    return get('/me/accounts', { fields: 'id,name,category,fan_count,picture,access_token' });
  }

  /* ---------- Posts ---------- */
  async function getPagePosts(pageId, limit = 25) {
    return get(`/${pageId}/posts`, {
      fields: 'id,message,created_time,permalink_url,attachments{subattachments,media_type,url},full_picture',
      limit,
    });
  }

  async function getPost(postId) {
    return get(`/${postId}`, {
      fields: 'id,message,created_time,permalink_url,full_picture,attachments{subattachments,media_type,url,media},source',
    });
  }

  /* ---------- Publishing ---------- */
  async function publishText(pageId, message, link = '') {
    const params = { message };
    if (link) params.link = link;
    return post(`/${pageId}/feed`, params);
  }

  async function publishPhoto(pageId, photoUrl, message = '') {
    return post(`/${pageId}/photos`, { url: photoUrl, message });
  }

  async function publishVideoByUrl(pageId, fileUrl, description = '', title = '') {
    return post(`/${pageId}/videos`, {
      file_url: fileUrl,
      description,
      title,
    });
  }

  // Simple multipart video upload (for local files)
  async function uploadVideo(pageId, file, description = '', title = '') {
    const url = buildUrl(`/${pageId}/videos`, { access_token: getToken() });
    const form = new FormData();
    if (description) form.append('description', description);
    if (title) form.append('title', title);
    form.append('source', file);
    const res = await fetch(url, { method: 'POST', body: form, credentials: 'include' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  }

  // Simple multipart photo upload (for local files)
  async function uploadPhoto(pageId, file, message = '') {
    const url = buildUrl(`/${pageId}/photos`, { access_token: getToken() });
    const form = new FormData();
    if (message) form.append('message', message);
    form.append('source', file);
    form.append('published', 'true');
    const res = await fetch(url, { method: 'POST', body: form, credentials: 'include' });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  }

  /* ---------- Cross-posting helper ---------- */
  async function publishToMultiplePages(pageIds, publishFn) {
    const results = [];
    for (const pid of pageIds) {
      try {
        const r = await publishFn(pid);
        results.push({ pageId: pid, success: true, result: r });
      } catch (err) {
        results.push({ pageId: pid, success: false, error: err.message });
      }
    }
    return results;
  }

  return {
    getMyPages,
    getPagePosts,
    getPost,
    publishText,
    publishPhoto,
    publishVideoByUrl,
    uploadVideo,
    uploadPhoto,
    publishToMultiplePages,
  };
})();
