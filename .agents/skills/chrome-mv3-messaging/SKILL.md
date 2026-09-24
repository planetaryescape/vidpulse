---
name: chrome-mv3-messaging
description: Chrome Extension MV3 message passing patterns for this project. Typed request/response pairs, progressive updates, storage proxy, port-based streaming. Triggers on "chrome.runtime.sendMessage", "chrome.runtime.onMessage", "MessageType", "sendMessage", "storage proxy".
---

# Chrome MV3 Messaging

Extension uses typed bidirectional messaging between content scripts and service worker. Two patterns: one-shot messages (request/response) and port-based streaming (chat).

## Message Type Enum

Use const assertion for type safety:

```typescript
// From src/shared/messages.ts
export const MessageType = {
  ANALYZE_VIDEO: "ANALYZE_VIDEO",
  CHECK_API_KEY: "CHECK_API_KEY",
  STORAGE_GET_SETTINGS: "STORAGE_GET_SETTINGS",
  // Pushed messages (not request/response)
  ANALYSIS_PARTIAL: "ANALYSIS_PARTIAL",
  ANALYSIS_COMPLETE: "ANALYSIS_COMPLETE",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
```

## Request/Response Type Pairs

Each message type has interface with `type` discriminator:

```typescript
// Request
export interface AnalyzeVideoRequest {
  type: typeof MessageType.ANALYZE_VIDEO;
  videoId: string;
  videoUrl: string;
}

// Response
export interface AnalyzeVideoResponse {
  success: boolean;
  analysis?: VideoAnalysis;
  error?: string;
}

// Union of all requests
export type Message = AnalyzeVideoRequest | CheckApiKeyRequest | ...;
```

## Async Message Handler Pattern

**CRITICAL:** Return `true` to indicate async response. Without this, sendResponse won't work.

```typescript
// From src/background/service-worker.ts
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          case MessageType.ANALYZE_VIDEO: {
            const { videoId, videoUrl } = message;
            const analysis = await analyzeVideo(videoUrl, videoId);
            sendResponse({
              success: true,
              analysis,
            } satisfies AnalyzeVideoResponse);
            break;
          }
          case MessageType.CHECK_API_KEY: {
            const settings = await getSettings();
            sendResponse({ hasKey: Boolean(settings.apiKey) } satisfies CheckApiKeyResponse);
            break;
          }
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies AnalyzeVideoResponse);
      }
    })();

    // MUST return true for async handlers
    return true;
  }
);
```

## Sending Messages (Content → Background)

Promisified wrapper handles lastError:

```typescript
// From src/shared/messages.ts
export function sendMessage<T>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Usage in content script
const response = await sendMessage<AnalyzeVideoResponse>({
  type: MessageType.ANALYZE_VIDEO,
  videoId,
  videoUrl,
});
```

## Progressive Updates (Pushed Messages)

Background pushes updates to content script during long operations. Not request/response - one-way messages.

```typescript
// Background pushes partial result
if (tabId) {
  chrome.tabs.sendMessage(tabId, {
    type: MessageType.ANALYSIS_PARTIAL,
    videoId,
    analysis: partialAnalysis,
  });
}

// Later, push complete result
if (tabId) {
  chrome.tabs.sendMessage(tabId, {
    type: MessageType.ANALYSIS_COMPLETE,
    videoId,
    analysis: fullAnalysis,
  });
}

// Content script listens for pushed messages
chrome.runtime.onMessage.addListener((message: PushedMessage) => {
  if (message.type === MessageType.ANALYSIS_PARTIAL && message.videoId === currentVideoId) {
    currentAnalysis = message.analysis;
    injectPanel({ status: "partial", videoId: currentVideoId, analysis: message.analysis });
  }

  if (message.type === MessageType.ANALYSIS_COMPLETE && message.videoId === currentVideoId) {
    currentAnalysis = message.analysis;
    injectPanel({ status: "ready", videoId: currentVideoId, analysis: message.analysis });
  }
});
```

## Abort Controllers for Cancellation

Cancel pending analysis when navigating away:

```typescript
// From src/content/index.ts
let analysisAbortController: AbortController | null = null;

async function handleVideoPage(videoId: string) {
  // Cancel any pending analysis
  if (analysisAbortController) {
    analysisAbortController.abort();
  }
  analysisAbortController = new AbortController();

  // Check if we're still on the same video before updating UI
  if (currentVideoId !== videoId) return;
}
```

## Storage Proxy Pattern

Content scripts can't directly access `chrome.storage.sync` in MV3. Proxy all operations through service worker.

```typescript
// From src/content/storage-proxy.ts
/**
 * Storage proxy for content scripts.
 * Content scripts cannot directly access chrome.storage in MV3,
 * so all storage operations are proxied through the service worker.
 */

export async function getSettings(): Promise<Settings> {
  const response = await sendMessage<StorageGetSettingsResponse>({
    type: MessageType.STORAGE_GET_SETTINGS,
  });
  return response.settings;
}

export async function startSession(): Promise<SessionData> {
  const response = await sendMessage<StorageStartSessionResponse>({
    type: MessageType.STORAGE_START_SESSION,
  });
  return response.session;
}

// Background handler
case MessageType.STORAGE_GET_SETTINGS: {
  const settings = await getSettings();
  sendResponse({ settings } satisfies StorageGetSettingsResponse);
  break;
}
```

Note: Content scripts CAN access `chrome.storage.local` directly - only sync storage needs proxy.

## Port-Based Streaming (Chat)

For streaming responses (not one-shot), use ports instead of sendMessage:

```typescript
// From src/background/service-worker.ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "vidpulse-chat") return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === "CHAT_START") {
      await handleChatStream(port, msg);
    }
  });
});

async function handleChatStream(port: chrome.runtime.Port, request: ChatRequest) {
  // Keep-alive pings during streaming
  const keepAlive = setInterval(() => {
    try {
      port.postMessage({ type: "ping" });
    } catch {
      clearInterval(keepAlive);
    }
  }, 20000);

  try {
    const stream = streamChat({ apiKey, model, messages });

    for await (const part of stream) {
      switch (part.type) {
        case "text":
          port.postMessage({ type: "text", text: part.text });
          break;
        case "error":
          port.postMessage({ type: "error", error: part.error });
          break;
      }
    }

    port.postMessage({ type: "done" });
  } finally {
    clearInterval(keepAlive);
  }
}
```

## Keep-Alive During Long Operations

Service worker can shut down during long operations. Send keep-alive pings:

```typescript
// Keep service worker alive during streaming
const keepAlive = setInterval(() => {
  try {
    port.postMessage({ type: "ping" });
  } catch {
    // Port disconnected
    clearInterval(keepAlive);
  }
}, 20000); // Every 20 seconds

// Always clean up
try {
  // long operation
} finally {
  clearInterval(keepAlive);
}
```

## Key Files

- `src/shared/messages.ts` - Message type definitions, sendMessage wrapper
- `src/background/service-worker.ts` - Message handler with `return true` pattern
- `src/content/index.ts` - Progressive update listeners, abort controllers
- `src/content/storage-proxy.ts` - Storage proxy for MV3 restrictions

## Avoid

- Forgetting `return true` in async message handlers (response won't send)
- Not checking `chrome.runtime.lastError` in sendMessage callback
- Using sendMessage for streaming (use ports instead)
- Directly accessing sync storage from content scripts (use proxy)
- Not canceling pending requests on navigation (use AbortController)
- Forgetting keep-alive during long operations (service worker shuts down)
