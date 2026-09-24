---
name: youtube-session-tracking
description: Session-based watch time and intent tracking for this project. Handles session lifecycle with 30-min inactivity timeout, watch time accumulation from video play/pause events, intent-based recommendations. Triggers on "getSession", "startSession", "addVideoToSession", "endVideoInSession", "SessionData", "chrome.storage.session".
---

# YouTube Session Tracking

Session tracking system using `chrome.storage.session` (auto-cleared on browser close). Tracks watch time via video play/pause events, not wall clock. 30-minute inactivity timeout ends sessions automatically.

## Session Lifecycle

Session starts on first video page visit, ends on 30-min inactivity or browser close:

```typescript
// From src/content/index.ts
let session = await getSession();
const isNewSession = !session;
if (!session) {
  session = await startSession();
  // Start check-in timer for new session
  await initCheckIn();
} else {
  await updateSessionActivity();
}
```

Session structure in `storage.ts`:

```typescript
// From src/shared/storage.ts
const SESSION_KEY = "vidpulse_session";
const SESSION_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export async function getSession(): Promise<SessionData | null> {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const session = result[SESSION_KEY] as SessionData | undefined;

  if (!session) return null;

  // Check for inactivity timeout
  if (Date.now() - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
    await chrome.storage.session.remove(SESSION_KEY);
    return null;
  }

  return session;
}
```

## Session Data Structure

```typescript
// From src/shared/types.ts
export interface SessionData {
  startTime: number;           // session start timestamp
  lastActivity: number;         // last activity timestamp (for inactivity reset)
  videos: SessionVideo[];       // videos watched this session
  intent?: WatchIntent;         // user's declared intent
  totalWatchTime?: number;      // accumulated watch time in seconds
}

export interface SessionVideo {
  videoId: string;
  title: string;
  startTime: number;            // when user started watching
  endTime?: number;             // when user navigated away
  watchDuration?: number;       // actual seconds watched (accumulated from play/pause)
  scores?: {
    productivity: number;
    educational: number;
    entertainment: number;
    inspiring: number;
    creative: number;
  };
  verdict?: "worth_it" | "maybe" | "skip";
}
```

## Watch Time Accumulation

Actual watch time tracked via video player events, not wall clock:

```typescript
// From src/content/video-watcher.ts
let accumulatedWatchTime = 0; // seconds
let isPlaying = false;
let lastPlayTimestamp = 0;

function onPlay(): void {
  if (!isPlaying) {
    isPlaying = true;
    lastPlayTimestamp = Date.now();
  }
}

function onPause(): void {
  if (isPlaying) {
    const elapsed = (Date.now() - lastPlayTimestamp) / 1000;
    accumulatedWatchTime += elapsed;
    isPlaying = false;
  }
}

export function getAccumulatedWatchTime(): number {
  // Include any currently playing time
  if (isPlaying) {
    const elapsed = (Date.now() - lastPlayTimestamp) / 1000;
    return accumulatedWatchTime + elapsed;
  }
  return accumulatedWatchTime;
}
```

Initialize watcher on each new video:

```typescript
// From src/content/index.ts
initVideoWatcher(videoId);
```

## Adding Videos to Session

Videos added when analysis completes:

```typescript
// From src/content/index.ts
async function updateSessionVideoWithAnalysis(
  videoId: string,
  analysis: VideoAnalysis,
): Promise<void> {
  const sessionVideo: SessionVideo = {
    videoId,
    title: getVideoTitle(),
    startTime: Date.now(),
    scores: {
      productivity: analysis.scores.productivity,
      educational: analysis.scores.educational,
      entertainment: analysis.scores.entertainment,
      inspiring: analysis.scores.inspiring,
      creative: analysis.scores.creative,
    },
    verdict: analysis.verdict,
  };
  await addVideoToSession(sessionVideo);
}
```

Storage implementation (deduplicates):

```typescript
// From src/shared/storage.ts
export async function addVideoToSession(video: SessionVideo): Promise<void> {
  let session = await getSession();
  if (!session) {
    session = await startSession();
  }

  // Check if video already in session
  const existing = session.videos.find((v) => v.videoId === video.videoId);
  if (existing) {
    // Update existing entry
    Object.assign(existing, video);
  } else {
    session.videos.push(video);
  }

  session.lastActivity = Date.now();
  await chrome.storage.session.set({ [SESSION_KEY]: session });
}
```

## Ending Videos

End video on navigation away, using accumulated watch time:

```typescript
// From src/content/index.ts
async function endCurrentVideo(videoId: string): Promise<void> {
  // Get actual watch duration from video watcher
  const watchDuration = Math.round(getAccumulatedWatchTime());

  // Get session to find video scores for daily stats
  const session = await getSession();
  const video = session?.videos.find((v) => v.videoId === videoId);

  // Update daily stats with actual duration
  if (watchDuration > 0 && video?.scores) {
    await updateDailyStats({
      duration: watchDuration,
      scores: video.scores,
      channelId: "", // Channel ID not stored in session video
    });
  }

  // End video in session with watch duration
  await endVideoInSession(videoId, watchDuration);

  // Clean up video watcher
  cleanupVideoWatcher();
}
```

Storage implementation:

```typescript
// From src/shared/storage.ts
export async function endVideoInSession(
  videoId: string,
  watchDuration?: number,
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const video = session.videos.find((v) => v.videoId === videoId);
  if (video && !video.endTime) {
    video.endTime = Date.now();
    if (watchDuration !== undefined) {
      video.watchDuration = watchDuration;
      // Add to session total watch time
      session.totalWatchTime = (session.totalWatchTime || 0) + watchDuration;
    }
    await chrome.storage.session.set({ [SESSION_KEY]: session });
  }
}
```

## Session Activity Updates

Update activity timestamp to prevent inactivity timeout:

```typescript
// From src/content/index.ts
await updateSessionActivity();

// From src/shared/storage.ts
export async function updateSessionActivity(): Promise<void> {
  const session = await getSession();
  if (session) {
    session.lastActivity = Date.now();
    await chrome.storage.session.set({ [SESSION_KEY]: session });
  }
}
```

## Intent Declaration

Users can declare intent for session (affects recommendations):

```typescript
// From src/shared/types.ts
export type WatchIntent = "learning" | "research" | "relaxing" | "browsing";

// From src/shared/storage.ts
export async function setSessionIntent(
  intent: SessionData["intent"],
): Promise<void> {
  const session = await getSession();
  if (session) {
    session.intent = intent;
    await chrome.storage.session.set({ [SESSION_KEY]: session });
  }
}
```

## Session Timer Display

Panel header shows live session duration:

```typescript
// From src/content/panel/session.ts
export function getSessionStats(session: SessionData): {
  duration: string;
  videoCount: number;
  byCategory: Record<string, number>;
} {
  // Use accumulated watch time if available, otherwise fall back to wall clock
  const watchTimeMs = (session.totalWatchTime || 0) * 1000;
  const duration = formatDuration(
    watchTimeMs > 0 ? watchTimeMs : Date.now() - session.startTime,
  );
  const videoCount = session.videos.length;

  const byCategory: Record<string, number> = {
    educational: 0,
    entertainment: 0,
    productive: 0,
    inspiring: 0,
    creative: 0,
  };
  for (const video of session.videos) {
    if (video.scores) {
      const maxScore = Math.max(
        video.scores.productivity,
        video.scores.educational,
        video.scores.entertainment,
        video.scores.inspiring,
        video.scores.creative,
      );
      if (video.scores.educational === maxScore) byCategory.educational++;
      else if (video.scores.entertainment === maxScore) byCategory.entertainment++;
      else if (video.scores.inspiring === maxScore) byCategory.inspiring++;
      else if (video.scores.creative === maxScore) byCategory.creative++;
      else byCategory.productive++;
    }
  }

  return { duration, videoCount, byCategory };
}

let sessionTimerInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionTimer(): void {
  if (sessionTimerInterval) return;

  sessionTimerInterval = setInterval(async () => {
    const timerEl = document.querySelector(".vp-session-timer");
    if (!timerEl) return;

    const session = await getSession();
    if (session) {
      const stats = getSessionStats(session);
      timerEl.textContent = `${stats.duration} · ${stats.videoCount} video${stats.videoCount !== 1 ? "s" : ""}`;
    }
  }, 10000);
}
```

## Content Script Proxy

Content scripts in MV3 cannot access `chrome.storage` directly, use proxy:

```typescript
// From src/content/storage-proxy.ts
export async function getSession(): Promise<SessionData | null> {
  const response = await sendMessage<StorageGetSessionResponse>({
    type: MessageType.STORAGE_GET_SESSION,
  });
  return response.session;
}

export async function addVideoToSession(video: SessionVideo): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_ADD_VIDEO_TO_SESSION,
    video,
  });
}

export async function endVideoInSession(
  videoId: string,
  watchDuration?: number,
): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_END_VIDEO_IN_SESSION,
    videoId,
    watchDuration,
  });
}
```

## Daily Stats Rollup

Session data flows into daily stats when videos end:

```typescript
// From src/content/index.ts
if (watchDuration > 0 && video?.scores) {
  await updateDailyStats({
    duration: watchDuration,
    scores: video.scores,
    channelId: "",
  });
}
```

## Key Files

- `src/shared/storage.ts` - Session storage functions (lines 530-628)
- `src/content/index.ts` - Session lifecycle orchestration (lines 169-178, 122-144)
- `src/content/video-watcher.ts` - Watch time accumulation from player events
- `src/content/storage-proxy.ts` - Content script storage proxy
- `src/content/panel/session.ts` - Session stats and timer display
- `src/shared/types.ts` - SessionData and SessionVideo types (lines 142-164)

## Important Patterns

Always check for expired sessions:

```typescript
const session = await getSession(); // Returns null if expired or missing
if (!session) {
  session = await startSession();
}
```

Always use accumulated watch time, not wall clock:

```typescript
const watchDuration = Math.round(getAccumulatedWatchTime());
// NOT: Date.now() - startTime
```

Always update activity on user interaction:

```typescript
await updateSessionActivity(); // Prevents inactivity timeout
```

Always clean up watcher when video ends:

```typescript
cleanupVideoWatcher(); // Detaches event listeners
```

## Avoid

- Don't use wall clock time for watch duration (inaccurate if user pauses)
- Don't forget to end previous video before starting new one
- Don't access chrome.storage.session directly from content scripts (use proxy)
- Don't start new session without checking for existing session first
- Don't forget to clean up video watcher event listeners
- Don't assume session exists (30-min timeout, browser close clears it)
