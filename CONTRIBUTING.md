# Contributing to VidPulse

## Development Setup

```bash
git clone https://github.com/planetaryescape/vidpulse.git
cd vidpulse
bun install
bun run dev
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
│   └── service-worker.ts    # OpenRouter API, caching, message handling
├── content/
│   ├── index.ts             # Entry point, orchestration
│   ├── navigation.ts        # YouTube SPA detection
│   ├── selectors.ts         # YouTube DOM selectors
│   ├── markers.ts           # Timeline markers on progress bar
│   ├── guardian.ts          # Blocking overlay for low-value content
│   ├── checkin.ts           # Time check prompts
│   ├── intent.ts            # Session intent prompts
│   ├── storage-proxy.ts     # Content script storage access
│   ├── overlay/             # Video overlay badge
│   │   ├── index.ts         # Public API: inject, remove, update
│   │   ├── badge.ts         # Collapsed verdict badge + feedback
│   │   ├── expanded.ts      # Expanded scores panel
│   │   ├── state.ts         # Overlay state management
│   │   └── container.ts     # Player container detection
│   └── panel/
│       ├── assembly.ts      # Panel construction
│       ├── header.ts        # Header with controls
│       ├── video.ts         # Video player interaction
│       ├── font-size.ts     # Font scaling
│       ├── session.ts       # Session stats
│       ├── utils.ts         # Helpers
│       ├── constants.ts     # IDs, limits
│       └── tabs/
│           ├── summary.ts   # Summary tab
│           ├── foryou.ts    # For You tab
│           ├── chapters.ts  # Chapters tab
│           ├── notes.ts     # Notes tab
│           └── related.ts   # Related tab
├── shared/
│   ├── types.ts             # TypeScript interfaces
│   ├── messages.ts          # Chrome message types
│   ├── storage.ts           # Chrome storage wrappers
│   └── export.ts            # Notes export utilities
├── options/
│   ├── index.ts             # Settings page logic
│   └── index.html           # Settings page markup
└── styles/
    ├── panel.css            # Panel + markers styling
    └── overlay.css          # Video overlay styling
```

## Architecture

```
Content Script  →  Background Service Worker  →  OpenRouter API
     ↓                      ↓
Panel/Overlay           Cache (local storage)
  + Markers
```

### Analysis Flow

1. Content script detects YouTube video via `yt-navigate-finish` event
2. Sends `ANALYZE_VIDEO` message to background worker
3. Background checks cache, calls OpenRouter if needed
4. Returns `VideoAnalysis` to content script (partial → complete phases)
5. Panel renders in YouTube's `#secondary` sidebar
6. Overlay renders on `#movie_player` container
7. Markers render on progress bar (inside player container)

### Phase Loading

Analysis happens in two phases for faster perceived performance:

**Phase 1 (fast):**
- `readVideoContent()` — Multimodal video analysis
- `generateSummary()` + `analyzeContent()` in parallel
- `generateReason()` — Personalized recommendation

**Phase 2 (background):**
- `extractKeyPoints()` — Chapter timestamps
- `generateTags()` — Topic tags
- `analyzePoliticalContent()` — Political analysis

Content script receives `ANALYSIS_PARTIAL` after Phase 1, `ANALYSIS_COMPLETE` after Phase 2.

## Key Modules

### markers.ts

Timeline markers for chapters and notes on YouTube's progress bar:
- Injects into `#movie_player` container (not progress bar itself, to avoid z-index conflicts)
- Edge-aware tooltip positioning (left/center/right alignment)
- Syncs visibility with YouTube's `ytp-autohide` class
- Semi-transparent when not hovered

### overlay/

Video overlay badge for cinema/theater mode:
- Compact badge with verdict icon + feedback buttons
- Click to expand full scores panel
- Syncs with sidebar panel state via custom events
- Fades with YouTube controls

### panel/tabs/notes.ts

Timestamped note-taking:
- Auto-save on input (500ms debounce) + blur event
- Markers integration via `updateMarkersForNotes()`
- Export to markdown

## Key Patterns

### Message Passing
Content scripts can't call APIs directly. All API calls go through the background worker via `chrome.runtime.sendMessage()`.

See `src/shared/messages.ts` for message types.

### Storage Split
- `chrome.storage.sync` — Settings, preferences (syncs across devices)
- `chrome.storage.local` — Cache, feedback history (device-only)

Content scripts use `storage-proxy.ts` to access storage via the background worker.

### Panel Injection
Panel prepends to YouTube's `#secondary` sidebar. Falls back to a floating container if sidebar not found.

Retries up to 5 times with increasing delays (YouTube's SPA can be slow to render).

### Markers Injection
Markers inject into `#movie_player` container, positioned above progress bar. Uses `position: absolute` with `bottom: 48px` to sit above YouTube controls.

### YouTube Control Sync
Both markers and overlay sync visibility with YouTube's native controls using the `ytp-autohide` CSS class:
```css
.html5-video-player:not(.ytp-autohide) .vp-markers-container {
  opacity: 0.35;
}
```

## Code Style

- TypeScript strict mode
- No external UI frameworks (vanilla DOM)
- Follow existing patterns in the codebase
- CSS variables for theming (defined in panel.css)

## Pull Requests

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test manually (see below)
5. Commit with descriptive message
6. Push and open a PR

## Manual Testing Checklist

No automated tests yet. Before submitting:

### Core Features
- [ ] Navigate to a YouTube video
- [ ] Panel appears with analysis (Phase 1 fast, Phase 2 fills in)
- [ ] Keyboard shortcuts work (Shift+V/L/K/R/O)
- [ ] Like/dislike updates preferences
- [ ] Settings page loads and saves
- [ ] Guardian blocks videos when threshold set low
- [ ] Regenerate (Shift+R) fetches fresh analysis

### Timeline Markers
- [ ] Chapter markers appear on progress bar (blue)
- [ ] Note markers appear when notes exist (yellow)
- [ ] Click marker jumps to timestamp
- [ ] Hover shows tooltip with title/description
- [ ] Edge markers don't overflow screen
- [ ] Markers hide when mouse idle (with YouTube controls)
- [ ] Toggle button in header hides/shows markers

### Video Overlay
- [ ] Badge appears on video in cinema mode
- [ ] Verdict icon shows correct color
- [ ] Like/dislike buttons work
- [ ] Click icon expands details panel
- [ ] Overlay hides when mouse idle
- [ ] Feedback syncs with sidebar panel

### Notes
- [ ] Add note captures current timestamp
- [ ] Notes auto-save while typing
- [ ] Notes save on blur (clicking away)
- [ ] Click timestamp seeks video
- [ ] Export downloads markdown
- [ ] Note markers appear on timeline

## Adding New Features

1. Define types in `src/shared/types.ts`
2. Add message type in `src/shared/messages.ts` if needed
3. Implement handler in `service-worker.ts`
4. Update UI in appropriate module:
   - Panel: `src/content/panel/`
   - Overlay: `src/content/overlay/`
   - Markers: `src/content/markers.ts`
5. Add styles to `panel.css` or `overlay.css`
6. Update settings in `options/` if configurable

## Questions?

Open an issue on GitHub.
