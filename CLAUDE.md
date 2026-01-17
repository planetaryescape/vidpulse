# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun run dev      # Build with watch mode (development)
bun run build    # Production build
bun run clean    # Remove dist/
bun run typecheck # TypeScript type checking
bun run lint     # Run Biome linter
bun run lint:fix # Auto-fix lint issues
bun run test     # Run tests once
bun run test:watch # Run tests in watch mode
```

Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

## Project Overview

Chrome extension (Manifest V3) using OpenRouter AI to analyze YouTube videos before watching. Shows sidebar panel with AI summaries, scores (productivity/educational/entertainment/inspiring/creative), "worth it" verdict. Features timeline markers, video overlay for cinema mode, timestamped notes.

## Architecture

**Entry Points:**
- `src/background/service-worker.ts` - Background worker: OpenRouter API, caching, message routing
- `src/content/index.ts` - Content script injected on YouTube
- `src/options/index.ts` - Extension options page

**Content Script Flow:**
1. `navigation.ts` detects YouTube SPA navigation via `yt-navigate-finish`
2. `index.ts` orchestrates: check API key → check cache → request analysis → inject UI
3. `panel/assembly.ts` renders in YouTube's `#secondary` sidebar
4. `overlay/` renders verdict badge on video player
5. `markers.ts` renders chapter/note markers on progress bar
6. `guardian.ts` shows blocking overlay for low-quality videos

**OpenRouter Analysis Pipeline** (in `service-worker.ts`):

Phase 1 (fast - shown immediately):
1. `readVideoContent()` - multimodal video reading (Gemini models)
2. Parallel: `generateSummary()`, `analyzeContent()`
3. `generateReason()` - personalized recommendation

Phase 2 (background):
- Parallel: `extractKeyPoints()`, `generateTags()`, `analyzePoliticalContent()`

Content script receives `ANALYSIS_PARTIAL` after Phase 1, `ANALYSIS_COMPLETE` after Phase 2.

**Memory System:**
- Like/dislike → `extractPreferencesFromFeedback()` extracts preferences
- Stored in `chrome.storage.sync` as `MemoryEntry[]`
- Future analyses use learned preferences for scoring
- Cache invalidated when preferences change (`preferencesVersion`)

**Key Patterns:**
- Content ↔ Background via `chrome.runtime.sendMessage`
- Cache in `chrome.storage.local`, settings in `chrome.storage.sync`
- Panel retries finding sidebar (5 attempts)
- Each pipeline step can use different model (`ModelConfig`)
- YouTube control visibility synced via `.ytp-autohide` class

**DOM Injection:**
- Timeline markers: inject into `#movie_player`, `position: absolute`, `bottom: 48px`
- Video overlay: inject into `#movie_player`, syncs with `ytp-autohide`
- Panel: prepend to `#secondary` sidebar

## Tech Stack

- Bun, TypeScript, Vite, @crxjs/vite-plugin
- @openrouter/sdk + @openrouter/ai-sdk-provider (AI)
- Brave Search API (related content)
- Vitest (testing), Biome (linting)
- Chrome Extension APIs (Manifest V3)
