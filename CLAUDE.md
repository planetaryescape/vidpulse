# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Build with watch mode (development)
npm run build    # Production build
npm run clean    # Remove dist/
```

No test framework configured.

## Project Overview

VidPulse is a Chrome extension (Manifest V3) that uses Google's Gemini AI to analyze YouTube videos before watching. It displays a sidebar panel with AI-generated summaries, scores (productivity/educational/entertainment), and a "worth it" verdict.

## Architecture

**Entry Points:**
- `src/background/service-worker.ts` - Background worker handling Gemini API calls, caching, message routing
- `src/content/index.ts` - Content script injected on YouTube pages
- `src/options/index.ts` - Extension options page

**Content Script Flow:**
1. `navigation.ts` detects YouTube SPA navigation via `yt-navigate-finish` event
2. `index.ts` orchestrates: check API key → check cache → request analysis → inject panel
3. `panel.ts` renders analysis UI in YouTube's `#secondary` sidebar
4. `guardian.ts` shows optional blocking overlay for low-quality videos

**Shared Modules:**
- `shared/types.ts` - TypeScript interfaces (`VideoAnalysis`, `Settings`, `PanelState`)
- `shared/messages.ts` - Chrome message passing types and helpers
- `shared/storage.ts` - Chrome storage API wrappers (sync for settings, local for cache)

**Gemini Analysis Pipeline** (in `service-worker.ts`):
1. `readVideoContent()` - multimodal video reading via fileData
2. Parallel: `generateSummary()`, `extractKeyPoints()`, `generateTags()`, `analyzeContent()`
3. `generateReason()` - personalized recommendation based on scores/verdict

**Memory System:**
- Users like/dislike videos → `extractPreferencesFromFeedback()` extracts preferences
- Preferences stored in `chrome.storage.sync` as `MemoryEntry[]`
- Future analyses use learned preferences for personalized scoring/recommendations
- Cache invalidated when preferences change (via `preferencesVersion`)

**Key Patterns:**
- Content ↔ Background communication via `chrome.runtime.sendMessage`
- Analysis results cached in `chrome.storage.local` with configurable expiry
- Settings synced across devices via `chrome.storage.sync`
- Panel auto-retries finding YouTube sidebar container (5 attempts)
- Each pipeline step can use different Gemini model (configured via `ModelConfig`)

## Tech Stack

- TypeScript, Vite, @crxjs/vite-plugin (Chrome extension build)
- @google/genai for Gemini API (video analysis via fileData)
- Chrome Extension APIs (Manifest V3): storage, tabs, activeTab
