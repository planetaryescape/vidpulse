---
name: progressive-ui-updates
description: Progressive UI rendering with partial/complete states for this project. Two-phase analysis display, conditional feature rendering, disabled state handling. Triggers on "ANALYSIS_PARTIAL", "ANALYSIS_COMPLETE", "status: 'partial'", "status: 'ready'", "progressive", "phase".
---

# Progressive UI Updates

Two-phase rendering: Phase 1 shows critical content immediately (For You + Summary tabs), Phase 2 progressively enhances with Chapters/Tags/Political Analysis. Prevents blocking the UI on slow background operations.

## Two-Phase Analysis Pipeline

Background worker sends two messages per video:

```typescript
// Phase 1: Critical path (service-worker.ts lines 906-942)
const [summary, analysisResult] = await Promise.all([
  generateSummary(apiKey, settings, content),
  analyzeContent(apiKey, settings, content, memories),
]);
const reason = await generateReason(/*...*/);

// Build partial - undefined = not loaded yet
const partialAnalysis: VideoAnalysis = {
  summary,
  reason,
  tags: [],                    // Phase 2
  scores: analysisResult.scores,
  verdict: analysisResult.verdict,
  keyPoints: undefined,        // Phase 2
  perspective: undefined,      // Phase 2
};

// Push to content script
chrome.tabs.sendMessage(tabId, {
  type: MessageType.ANALYSIS_PARTIAL,
  videoId,
  analysis: partialAnalysis,
});

// Phase 2: Background enrichment (lines 944-1002)
const [tags, keyPoints, politicalResult] = await Promise.all([
  generateTags(apiKey, settings, content),
  settings.showChapters !== false
    ? extractKeyPoints(apiKey, settings, content)
    : Promise.resolve([]),
  settings.showPoliticalAnalysis !== false
    ? analyzePoliticalContent(apiKey, settings, content)
    : Promise.resolve({ hasPoliticalContent: false }),
]);

chrome.tabs.sendMessage(tabId, {
  type: MessageType.ANALYSIS_COMPLETE,
  videoId,
  analysis: fullAnalysis,
});
```

## Partial vs Complete States

Distinguish between:
- `undefined` = not loaded yet (Phase 2 pending)
- `[]` = loaded but empty
- `[...]` = loaded with data

```typescript
// From assembly.ts lines 103-104
const chaptersDisabled =
  analysis.keyPoints !== undefined && analysis.keyPoints.length === 0;
```

Tab remains enabled during loading (`undefined`), only disables when explicitly empty.

## Conditional Tab Rendering

Only create tabs for enabled features:

```typescript
// From assembly.ts lines 106-144
const tabDefs: Array<{ id: string; label: string; disabled?: boolean }> = [
  { id: "foryou", label: "For You" },
  { id: "summary", label: "Summary" },
];

// Conditionally add chapters
if (settings.showChapters !== false) {
  tabDefs.push({
    id: "chapters",
    label: "Chapters",
    disabled: chaptersDisabled,
  });
  tabPanels.chapters = buildChaptersPanel(analysis);
}

// Always present
tabDefs.push({ id: "notes", label: "Notes" });
tabPanels.notes = buildNotesPanel(state);

// Conditionally add related content
if (settings.showRelatedContent !== false) {
  tabDefs.push({ id: "related", label: "Related" });
  tabPanels.related = buildRelatedPanel(state);
}
```

Feature flag pattern: `settings.showX !== false` (enabled by default unless explicitly disabled).

## Loading States in Tabs

Show loading placeholder when Phase 2 pending:

```typescript
// From chapters.ts lines 9-14
if (analysis.keyPoints === undefined) {
  const loading = document.createElement("div");
  loading.className = "vp-chapters-loading";
  loading.textContent = "Loading chapters...";
  panel.appendChild(loading);
} else if (analysis.keyPoints.length > 0) {
  // Render actual chapters
} else {
  // Show "No chapters available"
}
```

Always check `undefined` vs empty array.

## Message Listener for Progressive Updates

Content script listens for pushed updates:

```typescript
// From index.ts lines 373-409
chrome.runtime.onMessage.addListener((message: PushedMessage) => {
  if (
    message.type === MessageType.ANALYSIS_PARTIAL &&
    message.videoId === currentVideoId
  ) {
    currentAnalysis = message.analysis;
    injectPanel({
      status: "partial",
      videoId: currentVideoId,
      analysis: message.analysis,
    });
    updateOverlay({
      status: "partial",
      videoId: currentVideoId,
      analysis: message.analysis,
    });
  }

  if (
    message.type === MessageType.ANALYSIS_COMPLETE &&
    message.videoId === currentVideoId
  ) {
    currentAnalysis = message.analysis;
    updateSessionVideoWithAnalysis(currentVideoId, message.analysis);
    injectPanel({
      status: "ready",
      videoId: currentVideoId,
      analysis: message.analysis,
    });
    // ... update overlay, inject markers, check guardian
  }
});
```

Update UI components separately - don't re-render entire panel.

## Preventing Re-renders

Panel injection uses status to determine full vs incremental update:

```typescript
// From assembly.ts lines 189-217
async function buildPanelContent(state: PanelState) {
  // ...
  if (state.status === "loading") {
    content.appendChild(buildLoadingContent());
  } else if (state.status === "no_key") {
    content.appendChild(buildNoKeyContent(state.videoId));
  } else if (state.status === "error") {
    content.appendChild(buildErrorContent(state.error, state.videoId));
  } else if (
    (state.status === "ready" || state.status === "partial") &&
    state.analysis
  ) {
    const analysisContent = await buildAnalysisContent(state.analysis, state);
    // Render full analysis panel
  }
}
```

Both `"partial"` and `"ready"` render full panel - only data completeness differs.

## Disabled Tab Pattern

Tab disabled attribute prevents clicks, styled differently:

```typescript
// From assembly.ts lines 146-170
tabDefs.forEach((tab, index) => {
  const tabBtn = document.createElement("button");
  tabBtn.className =
    "vp-tab" +
    (index === 0 ? " vp-tab-active" : "") +
    (tab.disabled ? " vp-tab-disabled" : "");
  tabBtn.disabled = tab.disabled || false;
  tabBtn.dataset.tab = tab.id;

  tabBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (tab.disabled) return; // Guard against clicks
    // Switch active tab
  });
});
```

CSS handles visual disabled state via `.vp-tab-disabled`.

## Phase 2 Feature Skipping

Skip expensive API calls for disabled features:

```typescript
// From service-worker.ts lines 950-962
const keyPointsPromise =
  settings.showChapters !== false
    ? extractKeyPoints(apiKey, settings, content)
    : Promise.resolve([]);

const politicalPromise =
  settings.showPoliticalAnalysis !== false
    ? analyzePoliticalContent(apiKey, settings, content)
    : Promise.resolve({ hasPoliticalContent: false });
```

Return empty/default values instead of making API call.

## Key Files

- `src/background/service-worker.ts` - Two-phase pipeline (lines 890-1006)
- `src/content/index.ts` - Message listeners for progressive updates (lines 373-409)
- `src/content/panel/assembly.ts` - Conditional tab rendering, disabled state (lines 32-187)
- `src/content/panel/tabs/chapters.ts` - Loading state pattern (lines 9-14)
- `src/shared/types.ts` - PanelState, VideoAnalysis types (lines 36-58, 132-139)

## Avoid

- Don't confuse `undefined` (loading) with `[]` (empty) - breaks disabled state logic
- Don't skip feature flag checks before API calls - wastes quota
- Don't re-render entire panel on ANALYSIS_COMPLETE - use incremental updates via updateOverlay/maybeInjectMarkers
- Don't add tabs for disabled features - check settings first
- Don't hardcode Phase 2 fields as required - they're always optional until complete
