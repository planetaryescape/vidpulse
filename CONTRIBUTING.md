# Contributing to VidPulse

## Development Setup

```bash
git clone https://github.com/planetaryescape/vidpulse.git
cd vidpulse
npm install
npm run dev
```

Load in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

The `dev` script watches for changes and rebuilds automatically. Reload the extension in Chrome after changes.

## Project Structure

```
src/
├── background/
│   └── service-worker.ts    # Gemini API, caching, message handling
├── content/
│   ├── index.ts             # Entry point, orchestration
│   ├── panel.ts             # Analysis UI panel
│   ├── guardian.ts          # Blocking overlay
│   ├── checkin.ts           # Time check prompts
│   ├── intent.ts            # Session intent prompts
│   ├── navigation.ts        # YouTube SPA detection
│   └── storage-proxy.ts     # Content script storage access
├── shared/
│   ├── types.ts             # TypeScript interfaces
│   ├── messages.ts          # Chrome message types
│   └── storage.ts           # Chrome storage wrappers
├── options/
│   └── index.ts             # Settings page
└── styles/
    └── panel.css            # Panel styling
```

## Architecture

```
Content Script  →  Background Service Worker  →  Gemini API
     ↓                      ↓
  Panel UI              Cache (local storage)
```

1. Content script detects YouTube video via `yt-navigate-finish` event
2. Sends `ANALYZE_VIDEO` message to background worker
3. Background checks cache, calls Gemini if needed
4. Returns `VideoAnalysis` to content script
5. Panel renders in YouTube's `#secondary` sidebar

## Key Patterns

### Message Passing
Content scripts can't call Gemini directly. All API calls go through the background worker via `chrome.runtime.sendMessage()`.

See `src/shared/messages.ts` for message types.

### Storage Split
- `chrome.storage.sync` - Settings, preferences (syncs across devices)
- `chrome.storage.local` - Cache, feedback history (device-only)

Content scripts use `storage-proxy.ts` to access storage via the background worker.

### Panel Injection
Panel prepends to YouTube's `#secondary` sidebar. Falls back to a floating container if sidebar not found.

Retries up to 5 times with increasing delays (YouTube's SPA can be slow to render).

## Code Style

- TypeScript strict mode
- No external UI frameworks (vanilla DOM)
- Follow existing patterns in the codebase

## Pull Requests

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test manually (see below)
5. Commit with descriptive message
6. Push and open a PR

## Manual Testing Checklist

No automated tests yet. Before submitting:

- [ ] Navigate to a YouTube video
- [ ] Panel appears with analysis
- [ ] Keyboard shortcuts work (Shift+V/L/K/R)
- [ ] Like/dislike updates preferences
- [ ] Settings page loads and saves
- [ ] Guardian blocks videos when threshold set low
- [ ] Regenerate (Shift+R) fetches fresh analysis

## Adding New Features

1. Define types in `src/shared/types.ts`
2. Add message type in `src/shared/messages.ts` if needed
3. Implement handler in `service-worker.ts`
4. Update UI in `panel.ts` or create new content script

## Questions?

Open an issue on GitHub.
