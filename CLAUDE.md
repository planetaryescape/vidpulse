# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun run dev      # Build with watch mode (development)
bun run build    # Production build
bun run clean    # Remove dist/
```

No test framework configured.

## Project Overview

VidPulse is a Chrome extension (Manifest V3) that uses AI models via OpenRouter to analyze YouTube videos before watching. It displays a sidebar panel with AI-generated summaries, scores (productivity/educational/entertainment/inspiring/creative), and a "worth it" verdict. Additionally features timeline markers on the progress bar, a video overlay for cinema mode, and timestamped note-taking.

## Architecture

**Entry Points:**
- `src/background/service-worker.ts` - Background worker handling OpenRouter API calls, caching, message routing
- `src/content/index.ts` - Content script injected on YouTube pages
- `src/options/index.ts` - Extension options page

**Content Script Flow:**
1. `navigation.ts` detects YouTube SPA navigation via `yt-navigate-finish` event
2. `index.ts` orchestrates: check API key → check cache → request analysis → inject panel/overlay/markers
3. `panel/assembly.ts` renders analysis UI in YouTube's `#secondary` sidebar
4. `overlay/` renders compact verdict badge on the video player
5. `markers.ts` renders chapter/note markers on the progress bar
6. `guardian.ts` shows optional blocking overlay for low-quality videos

**Content Modules:**
- `src/content/markers.ts` - Timeline markers for chapters and notes
- `src/content/selectors.ts` - YouTube DOM selectors (PLAYER_CONTAINER, etc.)
- `src/content/overlay/` - Video overlay badge (badge.ts, expanded.ts, state.ts)
- `src/content/panel/` - Sidebar panel (assembly.ts, header.ts, tabs/)

**Shared Modules:**
- `shared/types.ts` - TypeScript interfaces (`VideoAnalysis`, `Settings`, `PanelState`)
- `shared/messages.ts` - Chrome message passing types and helpers
- `shared/storage.ts` - Chrome storage API wrappers (sync for settings, local for cache)
- `shared/export.ts` - Notes export utilities

**Styles:**
- `src/styles/panel.css` - Panel and markers styling
- `src/styles/overlay.css` - Video overlay styling

**OpenRouter Analysis Pipeline** (in `service-worker.ts`):

Phase 1 (fast - shown immediately):
1. `readVideoContent()` - multimodal video reading via video_url (Gemini models)
2. Parallel: `generateSummary()`, `analyzeContent()`
3. `generateReason()` - personalized recommendation based on scores/verdict

Phase 2 (background - fills in after):
- Parallel: `extractKeyPoints()`, `generateTags()`, `analyzePoliticalContent()`

Content script receives `ANALYSIS_PARTIAL` after Phase 1, `ANALYSIS_COMPLETE` after Phase 2.

**Memory System:**
- Users like/dislike videos → `extractPreferencesFromFeedback()` extracts preferences
- Preferences stored in `chrome.storage.sync` as `MemoryEntry[]`
- Future analyses use learned preferences for personalized scoring/recommendations
- Cache invalidated when preferences change (via `preferencesVersion`)
- Preferences link back to source video with timestamps

**Timeline Markers:**
- Inject into `#movie_player` container (not progress bar, to avoid z-index conflicts)
- Position: `absolute`, `bottom: 48px` (above YouTube controls)
- Edge-aware tooltips: classes `vp-marker-edge-left`/`vp-marker-edge-right` for alignment
- Visibility syncs with YouTube's `ytp-autohide` class
- Semi-transparent (0.35 opacity) when not hovered

**Video Overlay:**
- Injects into `#movie_player` container
- Compact badge: verdict icon + like/dislike buttons
- Click to expand: full scores panel
- Syncs feedback state with sidebar panel via custom events
- Visibility syncs with YouTube's `ytp-autohide` class

**Key Patterns:**
- Content ↔ Background communication via `chrome.runtime.sendMessage`
- Analysis results cached in `chrome.storage.local` with configurable expiry
- Settings synced across devices via `chrome.storage.sync`
- Panel auto-retries finding YouTube sidebar container (5 attempts)
- Each pipeline step can use different model (configured via `ModelConfig`)
- YouTube control visibility synced via `.ytp-autohide` CSS class detection

## Tech Stack

- Bun (package manager and runtime)
- TypeScript, Vite, @crxjs/vite-plugin (Chrome extension build)
- @openrouter/sdk + @openrouter/ai-sdk-provider (AI via OpenRouter)
- Brave Search API (related content)
- Chrome Extension APIs (Manifest V3): storage, tabs, activeTab
