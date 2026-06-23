/**
 * api.js — Facebook Graph API wrappers
 *
 * ALL requests are routed through the extension background script via
 * CustomEvents (metus_page_to_content / metus_content_to_page). The
 * background script has no CORS restrictions, so Graph API calls work
 * from any origin (localhost, netlify.app, etc.).
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
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent(
      'metus_page_to_content',
      {
        detail: {
          event: 'graph',
          data: {
            path,
            params
          }
        }
      }
    ));

    function listener(e) {
      const d = e.detail;

      if (d.event !== 'graph') return;

      window.removeEventListener(
        'metus_content_to_page',
        listener
      );

      if (d.data?.error) {
        reject(new Error(d.data.error));
      } else {
        resolve(d.data);
      }
    }

    window.addEventListener(
      'metus_content_to_page',
      listener
    );
  });
}

  async function post(path, params = {}) {
    return new Promise((resolve, reject) => {
      window.dispatchEvent(new CustomEvent(
        'metus_page_to_content',
        {
          detail: {
            event: 'graphPost',
            data: { path, params }
          }
        }
      ));

      function listener(e) {
        const d = e.detail;
        if (d.event !== 'graphPost') return;
        window.removeEventListener('metus_content_to_page', listener);
        if (d.data?.error) {
          reject(new Error(d.data.error));
        } else {
          resolve(d.data);
        }
      }
      window.addEventListener('metus_content_to_page', listener);
    });
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

  // Simple multipart video upload (for local files) — routed through extension bridge
  async function uploadVideo(pageId, file, description = '', title = '') {
    return new Promise((resolve, reject) => {
      window.dispatchEvent(new CustomEvent(
        'metus_page_to_content',
        {
          detail: {
            event: 'uploadVideo',
            data: { pageId, file, description, title }
          }
        }
      ));

      function listener(e) {
        const d = e.detail;
        if (d.event !== 'uploadVideo') return;
        window.removeEventListener('metus_content_to_page', listener);
        if (d.data?.error) {
          reject(new Error(d.data.error));
        } else {
          resolve(d.data);
        }
      }
      window.addEventListener('metus_content_to_page', listener);
    });
  }

  // Simple multipart photo upload (for local files) — routed through extension bridge
  async function uploadPhoto(pageId, file, message = '') {
    return new Promise((resolve, reject) => {
      window.dispatchEvent(new CustomEvent(
        'metus_page_to_content',
        {
          detail: {
            event: 'uploadPhoto',
            data: { pageId, file, message }
          }
        }
      ));

      function listener(e) {
        const d = e.detail;
        if (d.event !== 'uploadPhoto') return;
        window.removeEventListener('metus_content_to_page', listener);
        if (d.data?.error) {
          reject(new Error(d.data.error));
        } else {
          resolve(d.data);
        }
      }
      window.addEventListener('metus_content_to_page', listener);
    });
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
    get,
    post,
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
