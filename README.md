# FB Bulk Video Manager

A streamlined Facebook page manager for affiliate marketers to bulk post videos with auto-scheduling capabilities.

## Features

### 🎬 Bulk Video Posting
- Upload multiple video URLs at once
- Add custom captions and affiliate links to each video
- Edit each video before posting

### 📅 Smart Scheduling
- **Instant Posting**: Post all videos immediately to selected pages
- **Manual Scheduling**: Set custom time for each individual video
- **Auto Scheduling**: Automatically schedule videos at regular intervals (e.g., 1 video per hour)

### 🎯 Multiple Page Management
- Dropdown selector for easy page selection
- Post to multiple pages simultaneously
- Real-time page follower count display

### ⏰ Scheduled Queue
- View all pending scheduled videos
- Edit or remove scheduled posts
- Manual trigger to run pending posts immediately

### 📱 Responsive Design
- Optimized for desktop and mobile
- Touch-friendly dropdown menus
- Clean, modern UI

## Setup

### Requirements
- FB Manager Chrome Extension installed
- Facebook admin access to one or more pages
- Facebook account logged in

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Third07/testpage.git
cd testpage/website
```

2. Deploy to Netlify:
   - Connect your GitHub repo to Netlify
   - Set build command: (none needed, static files)
   - Set publish directory: `website`

3. Install the FB Manager Extension:
   - Extension source code should be in `/extension` directory
   - Load as unpacked extension in Chrome

## Usage

### Adding Videos

1. Go to **Bulk Videos** tab
2. Select target Facebook pages using the dropdown
3. Paste video URLs (one per line) in the text area
4. Click **Add Videos**

### Editing Videos

1. Click **✏️ Edit** on any video card
2. Modify:
   - Video URL
   - Caption
   - Affiliate link
   - Schedule time (for manual scheduling)
3. Click **Save**

### Posting Options

#### Instant Posting
- Videos post immediately to all selected pages
- No scheduling required

#### Manual Scheduling
1. Select "Schedule Manually (Each Video)"
2. Edit each video and set its schedule time
3. Click **Post Videos**

#### Auto Scheduling
1. Select "Auto Schedule (Time Intervals)"
2. Set start time
3. Set interval (e.g., 1 hour between videos)
4. Click **Post Videos**
5. Videos will be queued and post automatically

### Managing Scheduled Videos

- Go to **Scheduled Queue** tab
- View all pending videos with scheduled times
- Click **Run** to post immediately
- Click **Remove** to delete

## File Structure

```
website/
├── index.html           # Main HTML entry
├── css/
│   └── style.css       # All styling (responsive, mobile-first)
├── js/
│   ├── app.js          # Router and initialization
│   ├── bridge.js       # Extension communication
│   ├── api.js          # Facebook Graph API wrappers
│   ├── ui.js           # Shared UI utilities
│   └── features/
│       ├── dashboard.js   # Bulk video manager
│       └── scheduled.js   # Queue management
└── site.webmanifest    # PWA manifest
```

## Removed Features

The following features have been removed to focus on bulk video posting:
- ❌ Clone posts
- ❌ TikTok to Facebook pipeline
- ❌ Bulk image posting
- ❌ Text/link posting
- ❌ Local file uploads (URLs only)

## API Reference

### Video Posting

```javascript
// Post video by URL to multiple pages
await API.publishToMultiplePages(
  [pageId1, pageId2],
  (pid) => API.publishVideoByUrl(
    pid,
    'https://example.com/video.mp4',
    'Video caption with affiliate link',
    'Optional title'
  )
);
```

### Scheduled Queue

```javascript
// Add video to queue
Scheduled.addQueue({
  type: 'video',
  targetIds: [pageId1, pageId2],
  videoUrl: 'https://example.com/video.mp4',
  caption: 'Caption text',
  link: 'https://affiliate.link',
  scheduledAt: Date.now() + 3600000 // 1 hour from now
});

// Get queue count
const pending = Scheduled.getQueueCount();
```

## Browser Compatibility

- Chrome/Edge (88+)
- Firefox (90+)
- Safari (15+)

## Mobile Support

Fully responsive:
- ✅ Tablet
- ✅ Mobile phone
- ✅ Desktop

## Troubleshooting

### Extension Not Connected
- Ensure FB Manager extension is installed
- Make sure you're logged into Facebook
- Refresh the page

### Videos Not Posting
- Check internet connection
- Verify you have admin access to the page
- Check browser console for errors

### Schedule Not Working
- Verify scheduled time is in the future
- Check that the browser/system time is correct
- Ensure browser tab stays open (polling happens every 30 seconds)

## License

Proprietary - All rights reserved

## Support

For issues or feature requests, create an issue in the GitHub repository.
