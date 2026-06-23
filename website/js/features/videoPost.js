const VideoPost = (function () {
function render(container, pages) {
container.innerHTML = '';

```
const selector = UI.createPageSelector(pages, {
  multi: true,
  id: 'video-post-pages'
});

container.appendChild(selector.el);

const card = document.createElement('div');
card.className = 'card';

card.innerHTML = 
  <div class="card__title">Video URL Publisher</div>

  <div class="form-group">
    <label>Video URL(s)</label>
    <textarea
      id="video-urls"
      placeholder="https://example.com/video1.mp4&#10;https://example.com/video2.mp4"
      style="min-height:120px"
    ></textarea>
    <div class="form-hint">
      One MP4 URL per line.
    </div>
  </div>

  <div class="form-group">
    <label>Caption</label>
    <textarea
      id="video-caption"
      placeholder="Write your caption..."
    ></textarea>
  </div>

  <div style="display:flex;gap:10px;">
    <button class="btn btn--primary" id="video-upload-btn">
      📤 Publish Videos
    </button>

    <button class="btn btn--outline" id="video-clear-btn">
      Clear
    </button>
  </div>

  <div id="video-results" style="margin-top:20px"></div>
`;

container.appendChild(card);

const results = card.querySelector('#video-results');

card.querySelector('#video-clear-btn').addEventListener('click', () => {
  card.querySelector('#video-urls').value = '';
  card.querySelector('#video-caption').value = '';
  results.innerHTML = '';
});

card.querySelector('#video-upload-btn').addEventListener('click', async () => {

  const pagesSelected = selector.getSelected();

  if (!pagesSelected.length) {
    UI.toast('Select at least one page.', 'warning');
    return;
  }

  const caption =
    card.querySelector('#video-caption').value.trim();

  const urls =
    card.querySelector('#video-urls')
      .value
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);

  if (!urls.length) {
    UI.toast('Enter at least one video URL.', 'warning');
    return;
  }

  const btn = card.querySelector('#video-upload-btn');

  btn.disabled = true;
  btn.textContent = 'Publishing...';

  results.innerHTML = '';

  let successCount = 0;
  let failCount = 0;

  for (const page of pagesSelected) {

    for (const url of urls) {

      const row = document.createElement('div');

      row.className = 'card';
      row.style.marginTop = '10px';

      row.innerHTML = `
        <strong>${UI.esc(page.name)}</strong><br>
        ${UI.esc(url)}<br>
        <span>Uploading...</span>
      `;

      results.appendChild(row);

      try {

        const response =
          await API.publishVideoByUrl(
            page.id,
            url,
            caption,
            '',
            page.access_token
          );

        successCount++;

        row.innerHTML = `
          <strong>${UI.esc(page.name)}</strong><br>
          ✅ Success<br>
          Video ID: ${response.id}
        `;

      } catch (err) {

        failCount++;

        row.innerHTML = `
          <strong>${UI.esc(page.name)}</strong><br>
          ❌ Failed<br>
          ${UI.esc(err.message)}
        `;
      }
    }
  }

  btn.disabled = false;
  btn.textContent = '📤 Publish Videos';

  if (successCount) {
    UI.toast(
      `${successCount} video(s) published successfully`,
      'success'
    );
  }

  if (failCount) {
    UI.toast(
      `${failCount} video(s) failed`,
      'error'
    );
  }
});
```

}

return { render };
})();
        
