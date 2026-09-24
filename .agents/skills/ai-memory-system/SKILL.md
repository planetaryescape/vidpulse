---
name: ai-memory-system
description: AI-powered preference learning with similarity detection. Extracts preferences from feedback, merges similar memories, auto-synthesizes user profile. Triggers on "extractPreferencesFromFeedback", "checkPreferenceSimilarity", "mergeMemorySource", "synthesizeAboutMe", "condenseMemories".
---

# AI Memory System

System learns user preferences from like/dislike feedback. AI extracts preferences, checks similarity to existing memories (>70% threshold), merges sources, and auto-synthesizes aboutMe profile.

## Core Flow

When user likes/dislikes video:
1. Extract preferences via AI (`extractPreferencesFromFeedback`)
2. Check similarity to existing memories (`checkPreferenceSimilarity`)
3. If similar (≥70%), merge sources (`mergeMemorySource`)
4. If not similar, create new memory (`addMemory`)
5. Increment preferences version (invalidates cache)
6. Debounce trigger `synthesizeAboutMe` (2s delay)

## Preference Extraction from Feedback

```typescript
// From service-worker.ts lines 643-703
async function extractPreferencesFromFeedback(
  apiKey: string,
  settings: Settings,
  feedback: "like" | "dislike",
  videoTitle: string,
  videoId: string,
  analysis: VideoAnalysis,
): Promise<MemoryEntry[]>
```

AI analyzes video metadata to extract 1-3 specific preferences:

```typescript
// Real prompt excerpt (lines 655-678)
const prompt = `The user ${feedback === "like" ? "LIKED" : "DISLIKED"} a video.

VIDEO TITLE: ${videoTitle}
SUMMARY: ${analysis.summary}
TAGS: ${analysis.tags.join(", ")}
SCORES: productivity=${analysis.scores.productivity}, educational=${analysis.scores.educational}...
KEY SECTIONS: ${keyPointsStr}

Based on this feedback, extract 1-3 specific preferences about what the user ${feedback === "like" ? "enjoys" : "dislikes"}.
Be specific - not just "likes tech" but "likes deep technical tutorials on system design".
If a preference relates to a specific section, include that section's timestamp.

Respond with ONLY a JSON array:
[
  {
    "preference": "specific preference description",
    "confidence": 0.8,
    "extractedFrom": "summary",
    "timestampSeconds": 120
  }
]
```

Returns `MemoryEntry[]` with multi-source structure:

```typescript
// Lines 687-702
return extracted.map((e, i) => ({
  id: `${videoId}-${feedback}-${Date.now()}-${i}`,
  type: feedback,
  preference: e.preference,
  confidence: e.confidence,
  sources: [
    {
      videoId,
      videoTitle,
      timestamp: e.timestampSeconds,
      addedAt: Date.now(),
    },
  ],
  extractedFrom: e.extractedFrom,
  createdAt: Date.now(),
}));
```

## Similarity Detection

```typescript
// From service-worker.ts lines 752-787
async function checkPreferenceSimilarity(
  apiKey: string,
  settings: Settings,
  newPreference: string,
  existingPreferences: { id: string; preference: string }[],
): Promise<SimilarityResult>
```

AI compares new preference to existing ones:

```typescript
// Real prompt (lines 762-779)
const prompt = `Compare this new preference to existing ones. Find if any existing preference means essentially the same thing.

NEW: "${newPreference}"

EXISTING:
${existingPreferences.map((p) => `- [${p.id}] ${p.preference}`).join("\n")}

If you find a similar preference (>70% similar in meaning), respond with:
- similarId: the ID of the similar preference
- confidence: 0.7-1.0 based on how similar
- mergedPreference: a refined text that captures both preferences better

If no similar preference exists, respond with:
- similarId: null
- confidence: 0
```

Returns `SimilarityResult`:
- `similarId`: string | null
- `confidence`: number
- `mergedPreference?`: string (AI-refined text combining both)

## Memory Merging

```typescript
// From storage.ts lines 470-498
export async function mergeMemorySource(
  memoryId: string,
  newSource: VideoSource,
  newConfidence: number,
  newPreferenceText?: string,
): Promise<void>
```

Multi-source tracking pattern:

```typescript
// Lines 476-497
const memory = memories.find((m) => m.id === memoryId);
if (!memory) return;

// Add source if video not already in sources
const hasVideo = memory.sources.some((s) => s.videoId === newSource.videoId);
if (!hasVideo) {
  memory.sources.push(newSource);
}

// Take higher confidence
memory.confidence = Math.max(memory.confidence, newConfidence);

// Update preference text if provided (AI-rewritten)
if (newPreferenceText) {
  memory.preference = newPreferenceText;
}

memory.updatedAt = Date.now();
await chrome.storage.local.set({ [MEMORIES_KEY]: memories });
await incrementPreferencesVersion();
await triggerRegenerateAboutMe();
```

## Real Usage in Feedback Flow

```typescript
// From service-worker.ts lines 1279-1331
// Extract preferences from feedback
const extractedMemories = await extractPreferencesFromFeedback(
  apiKey,
  settings,
  feedback,
  videoTitle,
  videoId,
  analysis,
);

// Get existing memories to check for similarity
const existingMemories = await getMemories();
const resultMemories: MemoryEntry[] = [];

for (const newMem of extractedMemories) {
  // Only check same type (likes vs dislikes)
  const sameType = existingMemories.filter(
    (m) => m.type === newMem.type,
  );

  // Check for similar existing preference
  const similarity = await checkPreferenceSimilarity(
    apiKey,
    settings,
    newMem.preference,
    sameType.map((m) => ({ id: m.id, preference: m.preference })),
  );

  if (similarity.similarId && similarity.confidence >= 0.7) {
    // Merge into existing memory
    await mergeMemorySource(
      similarity.similarId,
      newMem.sources[0],
      newMem.confidence,
      similarity.mergedPreference,
    );
    // Return the merged memory info
    const mergedMem = existingMemories.find(
      (m) => m.id === similarity.similarId,
    );
    if (mergedMem) {
      resultMemories.push({
        ...mergedMem,
        preference: similarity.mergedPreference || mergedMem.preference,
      });
    }
  } else {
    // Create new memory
    await addMemory(newMem);
    resultMemories.push(newMem);
  }
}
```

## Auto-Synthesis of aboutMe

```typescript
// From service-worker.ts lines 706-743
async function synthesizeAboutMe(
  apiKey: string,
  settings: Settings,
  memories: MemoryEntry[],
): Promise<string>
```

Merges manual preferences with learned memories:

```typescript
// Lines 711-718
const hasManual = settings.manualPreferences?.trim().length > 0;
const hasMemories = memories.length > 0;

// No content to synthesize
if (!hasManual && !hasMemories) return "";

// Only manual preferences, no memories
if (!hasMemories) return settings.manualPreferences || "";
```

AI prompt (lines 723-740):

```typescript
const prompt = `Synthesize a concise user profile from manual preferences and learned behaviors.

MANUAL PREFERENCES:
${settings.manualPreferences || "(none)"}

LEARNED LIKES:
${likes.map((m) => `- ${m.preference}`).join("\n") || "(none)"}

LEARNED DISLIKES:
${dislikes.map((m) => `- ${m.preference}`).join("\n") || "(none)"}

Write a cohesive 2-4 sentence profile that:
1. Keeps manual preferences as foundation
2. Adds learned patterns naturally
3. Removes redundancy
4. Stays specific, not generic

Respond with ONLY the profile text.
```

## Debounced Regeneration

```typescript
// From storage.ts lines 407-422
let regenerateTimeout: ReturnType<typeof setTimeout> | null = null;
const REGENERATE_DEBOUNCE_MS = 2000;

async function triggerRegenerateAboutMe(): Promise<void> {
  if (regenerateTimeout) {
    clearTimeout(regenerateTimeout);
  }
  regenerateTimeout = setTimeout(async () => {
    try {
      await chrome.runtime.sendMessage({ type: "REGENERATE_ABOUT_ME" });
    } catch {
      // Ignore errors (e.g., if service worker not ready)
    }
  }, REGENERATE_DEBOUNCE_MS);
}
```

Called after every memory change:
- `addMemory()` - line 429
- `addMemories()` - line 437
- `removeMemory()` - line 445
- `clearMemories()` - line 451
- `updateMemory()` - line 466
- `mergeMemorySource()` - line 497
- `replaceMemories()` - line 506

## Preference Versioning

Cache invalidation when preferences change:

```typescript
// From storage.ts lines 196-215
function preferencesChanged(
  current: Settings,
  updates: Partial<Settings>,
): boolean {
  // Check aboutMe
  if ("aboutMe" in updates && updates.aboutMe !== current.aboutMe) {
    return true;
  }
  // Check models (any model change affects cache)
  if ("models" in updates && updates.models) {
    const currentModels = current.models;
    const newModels = updates.models;
    for (const key of Object.keys(newModels) as (keyof ModelConfig)[]) {
      if (newModels[key] !== currentModels[key]) {
        return true;
      }
    }
  }
  return false;
}
```

Version increment (lines 217-231):

```typescript
export async function saveSettings(
  settings: Partial<Settings>,
  options?: { skipVersionIncrement?: boolean },
): Promise<void> {
  const current = await getSettings();

  // Increment version if preferences changed (invalidates cache)
  // Skip if called from auto-regeneration (already incremented by addMemory)
  let newVersion = current.preferencesVersion;
  if (!options?.skipVersionIncrement && preferencesChanged(current, settings)) {
    newVersion = (current.preferencesVersion || 1) + 1;
  }
  // ...
}
```

Cache check (lines 276-281):

```typescript
// Check if preferences changed (version mismatch)
if (entry.preferencesVersion !== settings.preferencesVersion) {
  await chrome.storage.local.remove(key);
  return null;
}
```

## Memory Condensation

Group similar preferences to reduce redundancy:

```typescript
// From service-worker.ts lines 789-888
async function condenseMemories(
  apiKey: string,
  settings: Settings,
  memories: MemoryEntry[],
): Promise<MemoryEntry[]>
```

Process likes and dislikes separately (lines 797-808):

```typescript
const likes = memories.filter((m) => m.type === "like");
const dislikes = memories.filter((m) => m.type === "dislike");

const condensedLikes = await findAndMergeSimilar(apiKey, settings, likes);
const condensedDislikes = await findAndMergeSimilar(
  apiKey,
  settings,
  dislikes,
);

return [...condensedLikes, ...condensedDislikes];
```

AI grouping prompt (lines 818-835):

```typescript
const prompt = `Group these preferences by similarity. Each group should contain preferences that mean essentially the same thing.

PREFERENCES:
${memories.map((m, i) => `${i}: ${m.preference}`).join("\n")}

Rules:
- Only group preferences with very similar meaning (>70% semantic similarity)
- Unique preferences should be in their own single-item group
- For each group with multiple items, provide a merged preference text that captures all of them better

Respond with ONLY valid JSON:
{
  "groups": [[0, 3], [1], [2, 4, 5]],
  "mergedTexts": {
    "0,3": "refined preference for group 0,3",
    "2,4,5": "refined preference for group 2,4,5"
  }
}
```

Merging groups (lines 849-884):

```typescript
const condensed: MemoryEntry[] = [];
for (const group of result.groups) {
  if (group.length === 0) continue;

  if (group.length === 1) {
    condensed.push(memories[group[0]]);
  } else {
    // Merge group into first entry
    const merged = { ...memories[group[0]] };
    merged.sources = [...merged.sources];

    // Get merged text if available
    const groupKey = group.join(",");
    if (result.mergedTexts[groupKey]) {
      merged.preference = result.mergedTexts[groupKey];
    }

    for (let i = 1; i < group.length; i++) {
      const other = memories[group[i]];
      // Add all sources from other memories
      for (const source of other.sources) {
        const exists = merged.sources.some(
          (s) => s.videoId === source.videoId,
        );
        if (!exists) {
          merged.sources.push(source);
        }
      }
      // Take higher confidence
      merged.confidence = Math.max(merged.confidence, other.confidence);
    }

    merged.updatedAt = Date.now();
    condensed.push(merged);
  }
}
```

## Key Files

- `src/background/service-worker.ts` - AI pipeline functions (lines 643-888, 1264-1381)
- `src/shared/storage.ts` - Memory storage, versioning, debouncing (lines 366-507)
- `src/shared/types.ts` - MemoryEntry, VideoSource types (lines 99-121)

## Anti-Patterns

Don't extract preferences without checking similarity first (wastes storage, creates duplicates).

Don't merge across different types (likes vs dislikes) - check `m.type === newMem.type` (line 1295).

Don't skip version increment - cache invalidation required (line 428).

Don't call synthesizeAboutMe on every memory change - use 2s debounce (line 409).

Don't merge if confidence <70% - creates false positives (line 1307).

Don't forget skipVersionIncrement flag when auto-regenerating aboutMe - prevents double increment (lines 1619, 227).
