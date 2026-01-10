/**
 * Storage proxy for content scripts.
 * Content scripts cannot directly access chrome.storage in MV3,
 * so all storage operations are proxied through the service worker.
 */

import type { Settings, SessionData, SessionVideo, ChannelStats, FocusSchedule, WatchIntent } from '../shared/types';
import type {
  StorageGetSettingsResponse,
  StorageGetSessionResponse,
  StorageStartSessionResponse,
  StorageGetChannelStatsResponse,
  StorageGetFocusScheduleResponse,
  StorageGetOverrideStatsResponse,
  OverrideStats,
} from '../shared/messages';
import { sendMessage, MessageType } from '../shared/messages';

export async function getSettings(): Promise<Settings> {
  const response = await sendMessage<StorageGetSettingsResponse>({
    type: MessageType.STORAGE_GET_SETTINGS,
  });
  return response.settings;
}

export async function getSession(): Promise<SessionData | null> {
  const response = await sendMessage<StorageGetSessionResponse>({
    type: MessageType.STORAGE_GET_SESSION,
  });
  return response.session;
}

export async function startSession(): Promise<SessionData> {
  const response = await sendMessage<StorageStartSessionResponse>({
    type: MessageType.STORAGE_START_SESSION,
  });
  return response.session;
}

export async function addVideoToSession(video: SessionVideo): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_ADD_VIDEO_TO_SESSION,
    video,
  });
}

export async function endVideoInSession(videoId: string): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_END_VIDEO_IN_SESSION,
    videoId,
  });
}

export async function updateSessionActivity(): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_UPDATE_SESSION_ACTIVITY,
  });
}

export async function setSessionIntent(intent: WatchIntent): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_SET_SESSION_INTENT,
    intent,
  });
}

export async function getChannelStats(): Promise<Record<string, ChannelStats>> {
  const response = await sendMessage<StorageGetChannelStatsResponse>({
    type: MessageType.STORAGE_GET_CHANNEL_STATS,
  });
  return response.stats;
}

export async function updateChannelStats(
  channelId: string,
  channelName: string,
  scores: { productivity: number; educational: number; entertainment: number }
): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_UPDATE_CHANNEL_STATS,
    channelId,
    channelName,
    scores,
  });
}

export async function updateDailyStats(video: {
  duration: number;
  scores: { productivity: number; educational: number; entertainment: number };
  channelId: string;
}): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_UPDATE_DAILY_STATS,
    video,
  });
}

export async function getFocusSchedule(): Promise<FocusSchedule> {
  const response = await sendMessage<StorageGetFocusScheduleResponse>({
    type: MessageType.STORAGE_GET_FOCUS_SCHEDULE,
  });
  return response.schedule;
}

export async function pauseFocusMode(hours: number): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_PAUSE_FOCUS_MODE,
    hours,
  });
}

export async function getOverrideStats(): Promise<OverrideStats> {
  const response = await sendMessage<StorageGetOverrideStatsResponse>({
    type: MessageType.STORAGE_GET_OVERRIDE_STATS,
  });
  return response.stats;
}

export async function trackOverride(): Promise<void> {
  await sendMessage<{ success: boolean }>({
    type: MessageType.STORAGE_TRACK_OVERRIDE,
  });
}

// Re-export isInFocusPeriod as it's a pure function that doesn't need storage access
export { isInFocusPeriod } from '../shared/storage';

// Re-export notes functions - content scripts can access chrome.storage.local directly
export { getNotesForVideo, addNote, updateNote, deleteNote, getAllNotes } from '../shared/storage';
