---
name: chrome-port-streaming
description: Chrome port-based streaming for real-time chat responses. Long-lived connections vs one-shot messages, keep-alive pings, message history, cleanup. Triggers on "chrome.runtime.onConnect", "port.postMessage", "streamChat", "vidpulse-chat", "chat", "streaming".
---

# Chrome Port-Based Streaming

Project uses long-lived port connections for streaming AI chat responses, not standard `chrome.runtime.sendMessage` one-shot pattern.

## Port Connection Setup

Background worker listens for named port connections:

```typescript
// From src/background/service-worker.ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "vidpulse-chat") return;

  const keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  port.onDisconnect.addListener(() => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type === "CHAT_START") {
      await handleChatStream(port, msg);
    }
  });
});
```

Content script creates connection:

```typescript
// From src/content/panel/tabs/chat.ts
port = chrome.runtime.connect({ name: "vidpulse-chat" });

port.onMessage.addListener((part: ChatStreamPart) => {
  switch (part.type) {
    case "text":
      currentText += part.text || "";
      updateStreamingContent(currentStreamEl, currentText);
      break;
    case "error":
      showError(currentStreamEl, part.error || "Unknown error");
      break;
    case "done":
      finalizeMessage(currentStreamEl, currentText);
      port?.disconnect();
      break;
    case "ping":
      // Keep-alive, ignore
      break;
  }
});

port.postMessage({
  type: "CHAT_START",
  videoId: state.videoId,
  message,
  videoContent: cache?.videoContent || "",
  analysis: state.analysis,
  videoTitle: getVideoTitle(),
});
```

## Keep-Alive During Streaming

Chrome kills idle service workers. Send pings every 20s to prevent disconnect:

```typescript
// From src/background/service-worker.ts
const keepAlive = setInterval(() => {
  try {
    port.postMessage({ type: "ping" });
  } catch {
    // Port disconnected
    clearInterval(keepAlive);
  }
}, 20000);
```

Always clear in `finally` block:

```typescript
try {
  // streaming logic
} finally {
  clearInterval(keepAlive);
}
```

## Stream Message Types

Interface for stream parts:

```typescript
// From src/content/panel/tabs/chat.ts
interface ChatStreamPart {
  type: "text" | "error" | "done" | "ping";
  text?: string;
  error?: string;
}
```

Background sends:
- `{ type: "text", text: "chunk" }` - incremental text
- `{ type: "error", error: "message" }` - errors during stream
- `{ type: "done" }` - stream complete
- `{ type: "ping" }` - keep-alive (content ignores)

Pattern for streaming loop:

```typescript
// From src/background/service-worker.ts
let fullText = "";

const stream = streamChat({
  apiKey: settings.apiKey,
  model: chatModel,
  systemPrompt,
  messages,
});

for await (const part of stream) {
  switch (part.type) {
    case "text":
      fullText += part.text || "";
      port.postMessage({ type: "text", text: part.text });
      break;
    case "error":
      port.postMessage({ type: "error", error: part.error });
      break;
    case "done":
      break;
  }
}

port.postMessage({ type: "done" });
```

## Chat History Management

Load history before sending request:

```typescript
// From src/background/service-worker.ts
const history = await getChatHistory(request.videoId);
const messages: CoreMessage[] = [];

if (history?.messages) {
  for (const msg of history.messages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }
}

// Add current user message
messages.push({
  role: "user",
  content: request.message,
});
```

Save after stream completes (not during):

```typescript
// From src/background/service-worker.ts
// Save user message
await saveChatMessage(request.videoId, request.videoTitle, {
  id: crypto.randomUUID(),
  role: "user",
  content: request.message,
  timestamp: Date.now(),
});

// Save assistant response
if (fullText) {
  await saveChatMessage(request.videoId, request.videoTitle, {
    id: crypto.randomUUID(),
    role: "assistant",
    content: fullText,
    timestamp: Date.now(),
  });
}
```

Content script loads history via proxy (content scripts can't access `chrome.storage.local` directly in MV3):

```typescript
// From src/content/panel/tabs/chat.ts
async function getChatHistoryProxy(
  videoId: string,
): Promise<ChatHistory | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_CHAT_HISTORY", videoId },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response?.history || null);
      },
    );
  });
}
```

## System Prompt Building

Build context from video content, analysis, memories:

```typescript
// From src/background/service-worker.ts
function buildChatSystemPrompt(
  videoContent: string,
  analysis: VideoAnalysis,
  settings: Settings,
  memories: MemoryEntry[],
): string {
  const memoryContext = buildMemoryContext(memories);
  const keyPointsStr =
    analysis.keyPoints
      ?.map((kp) => `- [${kp.timestamp}] ${kp.title}: ${kp.description}`)
      .join("\n") || "None";

  return `You are a helpful assistant discussing a YouTube video with the user.

VIDEO CONTENT (from AI analysis):
${videoContent || "No detailed content available."}

VIDEO SUMMARY: ${analysis.summary}

KEY POINTS:
${keyPointsStr}

TAGS: ${analysis.tags.join(", ")}

${settings.aboutMe ? `USER PROFILE:\n${settings.aboutMe}` : ""}
${memoryContext}

INSTRUCTIONS:
- Answer questions about the video content
- Reference specific timestamps when relevant (format: [MM:SS])
- Use brave_search tool to find additional information if needed
- Be concise but thorough
- If something isn't in the video, say so
- When citing search results, mention the source`;
}
```

## Cleanup on Disconnect

Always handle disconnect to prevent leaks:

```typescript
// From src/content/panel/tabs/chat.ts
port.onDisconnect.addListener(() => {
  if (chrome.runtime.lastError && currentStreamEl) {
    showError(currentStreamEl, "Connection lost");
  }
  enableInput();
});
```

Disconnect after completion:

```typescript
case "done":
  if (currentStreamEl) {
    finalizeMessage(currentStreamEl, currentText);
  }
  enableInput();
  port?.disconnect();
  port = null;
  break;
```

## UI Updates During Stream

Create streaming message with cursor:

```typescript
// From src/content/panel/tabs/chat.ts
function createStreamingMessage(container: HTMLElement): HTMLElement {
  const el = document.createElement("div");
  el.className = "vp-chat-message vp-chat-assistant vp-chat-streaming";

  const content = document.createElement("div");
  content.className = "vp-chat-content";

  const cursor = document.createElement("span");
  cursor.className = "vp-chat-cursor";
  content.appendChild(cursor);

  el.appendChild(content);
  container.appendChild(el);
  return el;
}
```

Update incrementally:

```typescript
function updateStreamingContent(messageEl: HTMLElement, text: string): void {
  const content = messageEl.querySelector(".vp-chat-content");
  if (content) {
    content.textContent = "";
    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    content.appendChild(textSpan);

    const cursor = document.createElement("span");
    cursor.className = "vp-chat-cursor";
    content.appendChild(cursor);
  }
}
```

Finalize (remove cursor, class):

```typescript
function finalizeMessage(messageEl: HTMLElement, text: string): void {
  const content = messageEl.querySelector(".vp-chat-content");
  if (content) {
    content.textContent = text;
  }
  messageEl.classList.remove("vp-chat-streaming");
}
```

## Error Handling

Show errors in UI, re-enable input:

```typescript
// From src/content/panel/tabs/chat.ts
function showError(messageEl: HTMLElement, error: string): void {
  const content = messageEl.querySelector(".vp-chat-content");
  if (content) {
    content.textContent = "";
    const errorSpan = document.createElement("span");
    errorSpan.className = "vp-chat-error";
    errorSpan.textContent = `Error: ${error}`;
    content.appendChild(errorSpan);
  }
  messageEl.classList.remove("vp-chat-streaming");
}
```

Catch errors in background handler:

```typescript
// From src/background/service-worker.ts
try {
  // stream logic
} catch (error) {
  port.postMessage({
    type: "error",
    error: error instanceof Error ? error.message : "Unknown error",
  });
} finally {
  clearInterval(keepAlive);
}
```

## Key Files

- `src/background/service-worker.ts` - Port listener, `handleChatStream()`, keep-alive
- `src/content/panel/tabs/chat.ts` - Port connection, UI updates, message handling
- `src/shared/storage.ts` - `getChatHistory()`, `saveChatMessage()`
- `src/background/openrouter-api.ts` - `streamChat()` function

## Avoid

- Don't use `chrome.runtime.sendMessage` for streaming (can't stream)
- Don't forget keep-alive pings (service worker dies)
- Don't save messages during stream (wait for completion)
- Don't skip `port.disconnect()` cleanup
- Don't assume port stays alive without pings
- Don't use `innerHTML` for chat messages (XSS risk, use `textContent`)
