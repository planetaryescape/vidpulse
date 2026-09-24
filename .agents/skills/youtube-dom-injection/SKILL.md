---
name: youtube-dom-injection
description: YouTube SPA DOM injection patterns for this project. Navigation detection via yt-navigate-finish, sidebar retry logic, floating fallback, cleanup patterns. Triggers on "yt-navigate-finish", "findOrCreateContainer", "injectPanel", "injectOverlay", "injectMarkers".
---

# YouTube DOM Injection Patterns

Chrome extension injects UI into YouTube's SPA. Handles navigation events, retries DOM element finding, falls back to floating when sidebar unavailable, cleans up on navigation.

## Navigation Detection

YouTube SPA uses custom events. Triple fallback system:

```typescript
// From src/content/navigation.ts
export function setupNavigationListener(callback: NavigationCallback): void {
  let lastUrl = window.location.href;
  let lastVideoId = extractVideoId(lastUrl);

  // Primary: YouTube's custom navigation event
  document.addEventListener("yt-navigate-finish", () => {
    handleUrlChange(window.location.href);
  });

  // Fallback: browser back/forward
  window.addEventListener("popstate", () => {
    handleUrlChange(window.location.href);
  });

  // Fallback: polling every 5s for edge cases
  setInterval(() => {
    const url = window.location.href;
    if (url !== lastUrl) {
      handleUrlChange(url);
    }
  }, 5000);

  // Initial page load
  if (document.readyState === "complete") {
    tryInitial();
  } else {
    window.addEventListener("load", () => setTimeout(tryInitial, 300), {
      once: true,
    });
  }
}
```

**Pattern:** Listen to `yt-navigate-finish` first, always add fallbacks. YouTube SPA unreliable.

## Video ID Extraction

Only `/watch` URLs with `v` param:

```typescript
// From src/content/navigation.ts
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname === "/watch") {
      return urlObj.searchParams.get("v");
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export function isVideoPage(url: string): boolean {
  return extractVideoId(url) !== null;
}
```

## Navigation Cleanup Pattern

Always remove ALL UI before handling new page:

```typescript
// From src/content/index.ts
async function handleNavigation(
  _url: string,
  videoId: string | null,
): Promise<void> {
  // End previous video in session
  if (currentVideoId && currentVideoId !== videoId) {
    await endCurrentVideo(currentVideoId);
  }

  // Always clean up on navigation to prevent stale UI
  removePanel();
  removeOverlay();
  removeGuardian();
  removeMarkers();

  if (videoId) {
    handleVideoPage(videoId);
  } else {
    currentVideoId = null;
    currentAnalysis = null;
  }
}
```

**Pattern:** Remove before inject. Prevents duplicates and stale state.

## Sidebar Container Finding with Retry

YouTube sidebar loads asynchronously. Retry 5 times with exponential backoff:

```typescript
// From src/content/panel/container.ts
export async function findOrCreateContainer(): Promise<{
  container: Element;
  isFloating: boolean;
}> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const el = queryFirst(YT_SELECTORS.SIDEBAR);
    if (el) {
      return { container: el, isFloating: false };
    }

    const delay = 500 * (attempt + 1);
    await new Promise((r) => setTimeout(r, delay));
  }

  // Sidebar never appeared - create floating fallback
  return { container: createFloatingContainer(), isFloating: true };
}
```

**Pattern:** 5 attempts, 500ms * (attempt + 1) delays = 500ms, 1000ms, 1500ms, 2000ms, 2500ms.

## Floating Fallback Container

When sidebar unavailable (theater mode, fullscreen), create floating panel:

```typescript
// From src/content/panel/container.ts
function createFloatingContainer(): Element {
  document.getElementById(FLOATING_CONTAINER_ID)?.remove();

  const container = document.createElement("div");
  container.id = FLOATING_CONTAINER_ID;
  container.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    width: 360px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    z-index: 9999;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(container);
  return container;
}
```

**Pattern:** Remove existing first. Append to `document.body`. High z-index (9999). Fixed positioning.

## Panel Injection with Guard

Prevent concurrent injections causing duplicates:

```typescript
// From src/content/panel/assembly.ts
let injectionInProgress = false;

export async function injectPanel(state: PanelState): Promise<void> {
  // Prevent concurrent injections that cause duplicates
  if (injectionInProgress) return;
  injectionInProgress = true;

  // Remove existing panel FIRST, before any async work
  removePanel();

  try {
    const [{ container, isFloating }, fontSize, feedbackResponse] =
      await Promise.all([
        findOrCreateContainer(),
        getFontSize(),
        // ... other async operations
      ]);

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = `vidpulse-panel${isFloating ? " vidpulse-floating" : ""}`;
    // ... build panel content

    container.insertBefore(panel, container.firstChild);
  } catch (error) {
    console.error("VidPulse: Failed to inject panel", error);
  } finally {
    injectionInProgress = false;
  }
}
```

**Pattern:** Use boolean guard. Remove existing BEFORE async work. Always reset guard in finally.

## Overlay Injection into Player

Inject into `#movie_player` container:

```typescript
// From src/content/overlay/index.ts
let injectionInProgress = false;

export async function injectOverlay(state: PanelState): Promise<void> {
  if (injectionInProgress) return;
  if (state.status !== "ready" && state.status !== "partial") return;
  if (!state.analysis) return;

  injectionInProgress = true;

  try {
    removeOverlay();

    // Don't show during ads or mini-player
    if (isAdPlaying() || isMiniPlayerActive()) {
      return;
    }

    const player = findPlayerContainer();
    if (!player) {
      console.warn("[VidPulse] Could not find player container for overlay");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "vp-overlay";

    // ... build overlay content

    player.appendChild(overlay);
  } finally {
    injectionInProgress = false;
  }
}
```

**Pattern:** Same guard pattern. Check for ads/mini-player. Warn if container missing.

## Timeline Markers - Position Absolute

Markers positioned above progress bar using absolute positioning:

```typescript
// From src/content/markers.ts
export function injectMarkers(
  videoId: string,
  chapters: KeyPoint[],
  notes: VideoNote[],
): void {
  removeMarkers();

  currentVideoId = videoId;
  currentChapters = chapters;
  currentNotes = notes;

  const playerContainer = queryFirst(YT_SELECTORS.PLAYER_CONTAINER);
  if (!playerContainer) {
    // Retry after short delay - YouTube may still be loading
    setTimeout(() => {
      if (currentVideoId === videoId) {
        const retryPlayer = queryFirst(YT_SELECTORS.PLAYER_CONTAINER);
        if (retryPlayer) {
          createMarkersContainer(retryPlayer as HTMLElement);
          renderMarkers();
          setupResizeObserver(retryPlayer as HTMLElement);
          setupDurationListener();
        }
      }
    }, 1000);
    return;
  }

  createMarkersContainer(playerContainer as HTMLElement);
  renderMarkers();
  setupResizeObserver(playerContainer as HTMLElement);
  setupDurationListener();
}

function createMarkerElement(data: MarkerData, duration: number): HTMLElement {
  const marker = document.createElement("div");
  marker.className = `vp-marker vp-marker-${data.type}`;
  marker.dataset.seconds = String(data.seconds);

  // Position marker as percentage of video duration
  const pct = duration > 0 ? (data.seconds / duration) * 100 : 0;
  marker.style.left = `${pct}%`;

  // Edge detection for tooltip positioning
  if (pct < 15) {
    marker.classList.add("vp-marker-edge-left");
  } else if (pct > 85) {
    marker.classList.add("vp-marker-edge-right");
  }

  // ... create marker content

  return marker;
}
```

**Pattern:** Single 1s retry if container missing. Position markers with `left: ${pct}%`. Edge classes for tooltip positioning.

## Resize Observer for Markers

Re-render markers when progress bar resizes:

```typescript
// From src/content/markers.ts
function setupResizeObserver(progressBar: HTMLElement): void {
  resizeObserver = new ResizeObserver(() => {
    // Re-render markers when progress bar size changes
    renderMarkers();
  });
  resizeObserver.observe(progressBar);
}

export function removeMarkers(): void {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (markersContainer) {
    markersContainer.remove();
    markersContainer = null;
  }

  currentVideoId = null;
  currentChapters = [];
  currentNotes = [];
}
```

**Pattern:** Always disconnect ResizeObserver in cleanup. Set to null after cleanup.

## Duration Listener Pattern

Wait for video duration to be available:

```typescript
// From src/content/markers.ts
function setupDurationListener(): void {
  const video = document.querySelector("video");
  if (!video) return;

  // If duration already available, re-render
  if (video.duration && !Number.isNaN(video.duration)) {
    renderMarkers();
    return;
  }

  // Wait for metadata
  const onLoadedMetadata = () => {
    renderMarkers();
    video.removeEventListener("loadedmetadata", onLoadedMetadata);
  };
  video.addEventListener("loadedmetadata", onLoadedMetadata);
}
```

**Pattern:** Check if duration already available. If not, listen for `loadedmetadata` once. Always remove listener.

## Cleanup Functions

All injection modules export cleanup:

```typescript
// From src/content/panel/assembly.ts
export function removePanel(): void {
  stopSessionTimer();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(FLOATING_CONTAINER_ID)?.remove();
}

// From src/content/overlay/index.ts
export function removeOverlay(): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
  clearState();
}

// From src/content/markers.ts
export function removeMarkers(): void {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (markersContainer) {
    markersContainer.remove();
    markersContainer = null;
  }
  currentVideoId = null;
  currentChapters = [];
  currentNotes = [];
}
```

**Pattern:** Optional chaining for removal. Clear module state. Disconnect observers.

## Key Files

- `src/content/navigation.ts` - Triple fallback navigation detection
- `src/content/index.ts` - Orchestration, cleanup on navigation
- `src/content/panel/container.ts` - Sidebar retry + floating fallback
- `src/content/panel/assembly.ts` - Panel injection with guard
- `src/content/overlay/index.ts` - Overlay injection into player
- `src/content/markers.ts` - Timeline markers with ResizeObserver
- `src/content/selectors.ts` - YouTube selector constants

## YouTube Selectors

Use constants from `src/content/selectors.ts`:

```typescript
export const YT_SELECTORS = {
  SIDEBAR: "#secondary",
  PLAYER_CONTAINER: "#movie_player",
  // ... other selectors
};
```

## Avoid

- Don't trust single navigation event - always use triple fallback
- Don't inject without checking for duplicates - use guard flags
- Don't skip cleanup on navigation - always remove all UI first
- Don't hardcode delays - use exponential backoff for retries
- Don't forget to disconnect observers in cleanup
- Don't assume elements exist - always check and retry
- Don't skip floating fallback - sidebar not always available
