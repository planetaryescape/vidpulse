---
name: openrouter-pipeline
description: OpenRouter AI analysis pipeline with dual SDK pattern, multi-phase execution, per-operation model config, JSON extraction, retry logic. Triggers on "generateFromVideo", "generateText", "analyzeVideo", "extractKeyPoints", "ModelConfig", "pipeline", "phase".
---

# OpenRouter Pipeline Patterns

Multi-phase AI analysis pipeline orchestrated in `src/background/service-worker.ts`. Two-phase execution with progressive UI updates. Per-operation model selection. Dual SDK pattern for video vs text operations.

## Dual SDK Pattern

**Native SDK for video operations** (only way to use `video_url` content type):

```typescript
// From openrouter-api.ts
import { OpenRouter } from "@openrouter/sdk";

export async function generateFromVideo(
  apiKey: string,
  model: string,
  videoUrl: string,
  prompt: string,
): Promise<string> {
  const client = new OpenRouter({ apiKey });
  const response = await client.chat.send({
    model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "video_url", videoUrl: { url: videoUrl } },
      ],
    }],
  });
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item.type === "text")
      .map((item) => ("text" in item ? item.text : ""))
      .join("");
  }
  return "";
}
```

**Vercel AI SDK for text/streaming** (cleaner API):

```typescript
// From openrouter-api.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText as aiGenerateText, streamText as aiStreamText } from "ai";

export async function generateText(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const openrouter = createOpenRouter({ apiKey });
  const result = await aiGenerateText({
    model: openrouter(model),
    prompt,
  });
  return result.text;
}

// Streaming for chat
export async function* streamChat(options: ChatStreamOptions): AsyncGenerator<{
  type: "text" | "error" | "done";
  text?: string;
  error?: string;
}> {
  const { apiKey, model, systemPrompt, messages } = options;
  const openrouter = createOpenRouter({ apiKey });

  const result = aiStreamText({
    model: openrouter(model),
    system: systemPrompt,
    messages,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        yield { type: "text", text: part.text };
        break;
      case "error":
        yield { type: "error", error: part.error.message };
        break;
      case "finish":
        yield { type: "done" };
        break;
    }
  }
}
```

## Per-Operation Model Configuration

Each pipeline step uses different model from `ModelConfig`:

```typescript
// From types.ts
export interface ModelConfig {
  videoReading: VideoModel; // Must be Gemini (video-capable)
  summarization: TextModel;
  recommendationReasoning: TextModel;
  tagGeneration: TextModel;
  transcriptAnalysis: TextModel;
  memoryExtraction: TextModel;
  chat?: TextModel;
}

// Usage pattern in service-worker.ts
const content = await readVideoContent(apiKey, settings, videoUrl);
// uses settings.models.videoReading

const summary = await generateSummary(apiKey, settings, content);
// uses settings.models.summarization

const tags = await generateTags(apiKey, settings, content);
// uses settings.models.tagGeneration
```

Only `videoReading` restricted to Gemini models. All others accept any OpenRouter model.

## Two-Phase Execution with Progressive Updates

**Phase 1 (critical path)**: For You tab + Summary. Push partial result immediately:

```typescript
// From service-worker.ts analyzeVideo()
const content = await readVideoContent(apiKey, settings, videoUrl);

// Phase 1: Critical path
const [summary, analysisResult] = await Promise.all([
  generateSummary(apiKey, settings, content),
  analyzeContent(apiKey, settings, content, memories),
]);

const reason = await generateReason(
  apiKey, settings, content,
  analysisResult.scores, analysisResult.verdict, memories,
);

const partialAnalysis: VideoAnalysis = {
  summary,
  reason,
  tags: [], // Phase 2
  scores: analysisResult.scores,
  verdict: analysisResult.verdict,
  keyPoints: undefined, // Phase 2
};

// Push partial to content script
if (tabId) {
  chrome.tabs.sendMessage(tabId, {
    type: MessageType.ANALYSIS_PARTIAL,
    videoId,
    analysis: partialAnalysis,
  });
}
```

**Phase 2 (background)**: Chapters, tags, political analysis:

```typescript
// Phase 2: Background
const phase2Promises: Promise<unknown>[] = [
  generateTags(apiKey, settings, content),
];

// Conditional - only if feature enabled
const keyPointsPromise = settings.showChapters !== false
  ? extractKeyPoints(apiKey, settings, content)
  : Promise.resolve([]);
phase2Promises.push(keyPointsPromise);

const politicalPromise = settings.showPoliticalAnalysis !== false
  ? analyzePoliticalContent(apiKey, settings, content)
  : Promise.resolve({ hasPoliticalContent: false });
phase2Promises.push(politicalPromise);

const [tags, keyPoints, politicalResult] = await Promise.all(phase2Promises);

const fullAnalysis: VideoAnalysis = {
  ...partialAnalysis,
  tags,
  keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
  perspective: politicalResult.hasPoliticalContent ? politicalResult.perspective : undefined,
};

// Push complete to content script
if (tabId) {
  chrome.tabs.sendMessage(tabId, {
    type: MessageType.ANALYSIS_COMPLETE,
    videoId,
    analysis: fullAnalysis,
  });
}
```

Content script receives `ANALYSIS_PARTIAL` first (shows critical data), then `ANALYSIS_COMPLETE` (updates with full data).

## JSON Extraction from Markdown

AI responses often wrap JSON in code blocks. Extract reliably:

```typescript
// From service-worker.ts
function extractJson(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return jsonMatch ? jsonMatch[1].trim() : text.trim();
}

async function generateJson<T>(
  apiKey: string,
  model: string,
  prompt: string,
  fallback: T,
): Promise<T> {
  const text = await generateText(apiKey, model, prompt);
  try {
    return JSON.parse(extractJson(text)) as T;
  } catch {
    return fallback;
  }
}

// Usage
const tags = await generateJson<string[]>(
  apiKey,
  settings.models.tagGeneration,
  tagPrompt,
  ["untagged"], // fallback on parse error
);
```

Always provide fallback value matching expected type. Handles both plain JSON and markdown-wrapped responses.

## Retry with Exponential Backoff

Wrap API calls in `withRetry` for transient failures:

```typescript
// From service-worker.ts
async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; delay?: number; backoff?: number },
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2 } = options || {};

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;

      // Rate limit (429) → longer backoff
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") || error.message.includes("rate"));

      const waitTime = isRateLimit
        ? delay * backoff ** attempt * 2
        : delay * backoff ** attempt;

      await new Promise((r) => setTimeout(r, waitTime));
    }
  }
  throw new Error("Unreachable");
}

// Usage
const content = await withRetry(
  async () => generateFromVideo(apiKey, model, videoUrl, prompt),
  { retries: 3, delay: 2000 },
);
```

Rate limit errors get 2x longer backoff. Video reading uses longer initial delay (2s vs 1s).

## Memory-Based Personalization

Inject learned preferences into prompts:

```typescript
// From service-worker.ts
function buildMemoryContext(memories: MemoryEntry[]): string {
  if (memories.length === 0) return "";

  const likes = memories.filter((m) => m.type === "like");
  const dislikes = memories.filter((m) => m.type === "dislike");

  const parts = ["\n\nLEARNED PREFERENCES:"];

  if (likes.length > 0) {
    parts.push(
      `\nThings user LIKES:\n- ${likes.map((m) => m.preference).join("\n- ")}`,
    );
  }

  if (dislikes.length > 0) {
    parts.push(
      "\nThings user DISLIKES:\n- " +
        dislikes.map((m) => m.preference).join("\n- "),
    );
  }

  return parts.join("");
}

// Usage in analyzeContent prompt
const memories = await getMemories();
prompt += buildMemoryContext(memories);
```

Scoring changes when memories exist - adds `relevance` and `enjoymentConfidence` fields. Cache invalidated when `preferencesVersion` increments.

## Multimodal Video Reading

First step in pipeline - uses Gemini models with `video_url`:

```typescript
// From service-worker.ts
async function readVideoContent(
  apiKey: string,
  settings: Settings,
  videoUrl: string,
): Promise<string> {
  const prompt = `Watch this video and provide a detailed description of its content.
Include:
- Main topics and themes covered
- Key points and arguments made
- Style and tone of presentation
- Target audience
- Any notable quotes or moments

Provide a thorough transcript-like description that captures the essence of the video.`;

  const text = await withRetry(
    async () =>
      generateFromVideo(apiKey, settings.models.videoReading, videoUrl, prompt),
    { retries: 3, delay: 2000 },
  );

  if (!text) {
    throw new Error("Empty response from video reading");
  }

  return text;
}
```

Returns rich content description. All subsequent operations use this text (not video directly). Saves API costs - video analyzed once, then text operations.

## Progressive Messaging Pattern

Content script connects via port for streaming, or receives pushed messages for analysis updates:

```typescript
// Port-based streaming (chat)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "vidpulse-chat") return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === "CHAT_START") {
      const stream = streamChat({ apiKey, model, systemPrompt, messages });
      for await (const part of stream) {
        switch (part.type) {
          case "text":
            port.postMessage({ type: "text", text: part.text });
            break;
          case "error":
            port.postMessage({ type: "error", error: part.error });
            break;
          case "done":
            port.postMessage({ type: "done" });
            break;
        }
      }
    }
  });
});

// Message-based pushed updates (analysis)
chrome.tabs.sendMessage(tabId, {
  type: MessageType.ANALYSIS_PARTIAL,
  videoId,
  analysis: partialAnalysis,
});

// Later...
chrome.tabs.sendMessage(tabId, {
  type: MessageType.ANALYSIS_COMPLETE,
  videoId,
  analysis: fullAnalysis,
});
```

Port keeps connection alive during streaming. Messages pushed asynchronously don't need response.

## Key Files

- `src/background/service-worker.ts` - Analysis orchestration, phase splits, memory integration
- `src/background/openrouter-api.ts` - Dual SDK wrappers (native vs Vercel AI)
- `src/shared/types.ts` - `ModelConfig`, `VideoAnalysis`, `MemoryEntry`

## Avoid

- Don't use Vercel AI SDK for video operations - only native SDK supports `video_url`
- Don't skip retry wrapper for API calls - rate limits common
- Don't block on Phase 2 - push partial immediately
- Don't forget fallback in `generateJson` - parse errors expected
- Don't add Phase 2 fields to `ANALYSIS_PARTIAL` message - UI expects undefined
- Don't call video reading multiple times - expensive, cache the text result
- Don't increment `preferencesVersion` without clearing cache - stale results
