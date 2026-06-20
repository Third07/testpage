# Deploying MetusV2 Website to GitHub + Netlify

## 1. Push to GitHub

```bash
# In the project root
git init
git add website/ netlify/ netlify.toml package.json server.js DEPLOY.md README.md
git commit -m "Initial commit: MetusV2 Facebook Page Manager"
```

Then create a new repository on GitHub and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/metusv2-web.git
git branch -M main
git push -u origin main
```

## 2. Connect Netlify to GitHub

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. Select **GitHub** and authorize Netlify
3. Pick your repository (`metusv2-web`)
4. **Build settings** (Netlify will auto-detect `netlify.toml`):
   - **Build command:** leave empty or `echo 'Static site ready'`
   - **Publish directory:** `website`
   - Netlify automatically detects functions in `netlify/functions/`
5. Click **Deploy site**

## 3. Extension Manifest Update (IMPORTANT)

The browser extension (`MetusV2/`) only injects its content script on whitelisted domains.

**I already added `https://*.netlify.app/*` to the manifest.** If you use a **custom domain** on Netlify, add it too:

Open `MetusV2/manifest.json` and modify the `content_scripts` → `matches` array:

```json
"content_scripts": [{
  "matches": [
    "http://localhost:3000/*",
    "https://*.metus.vn/*",
    "https://*.netlify.app/*",
    "https://YOUR_CUSTOM_DOMAIN/*"
  ],
  "js": ["content.js"],
  "all_frames": true
}]
```

After editing the manifest, reload the extension in `chrome://extensions/` → developer mode → click the reload icon on Metus Extension.

## 4. Verify Everything Works

1. Open your Netlify site URL (e.g., `https://metusv2-web.netlify.app`)
2. Ensure the extension icon area shows **"Extension connected"**
3. Check the **Pages Dashboard** loads your managed Facebook pages
4. Test posting features

## 5. Custom Domain (Optional)

In Netlify → **Domain settings** → **Add custom domain**:
- If you own `metus.vn`, add a subdomain like `manager.metus.vn`
- Update DNS with the CNAME record Netlify provides
- Add `https://manager.metus.vn/*` to the extension manifest matches

## Notes

- The site works **without any build step** — it's pure HTML/CSS/JS static files
- Netlify serverless functions (`video-info`, `video-download`) run automatically at `/.netlify/functions/*`
- A redirect rule in `netlify.toml` maps `/api/*` → `/.netlify/functions/*` so the frontend code doesn't need changes
- Local development still works with `node server.js` on `localhost:3000`
