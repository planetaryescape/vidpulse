import type { VideoAnalysis, MemoryEntry, Settings, SessionData, SessionVideo, ChannelStats, DailyStats, FocusSchedule, WatchIntent, RelatedResource, LikedChannel } from './types';

// Message types for communication between content script and background
export const MessageType = {
  ANALYZE_VIDEO: 'ANALYZE_VIDEO',
  CHECK_API_KEY: 'CHECK_API_KEY',
  VALIDATE_API_KEY: 'VALIDATE_API_KEY',
  GET_CACHED: 'GET_CACHED',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
  SUBMIT_FEEDBACK: 'SUBMIT_FEEDBACK',
  GET_VIDEO_FEEDBACK: 'GET_VIDEO_FEEDBACK',
  REGENERATE_VIDEO: 'REGENERATE_VIDEO',
  // Storage operations (for content script proxy)
  STORAGE_GET_SETTINGS: 'STORAGE_GET_SETTINGS',
  STORAGE_GET_SESSION: 'STORAGE_GET_SESSION',
  STORAGE_START_SESSION: 'STORAGE_START_SESSION',
  STORAGE_ADD_VIDEO_TO_SESSION: 'STORAGE_ADD_VIDEO_TO_SESSION',
  STORAGE_END_VIDEO_IN_SESSION: 'STORAGE_END_VIDEO_IN_SESSION',
  STORAGE_UPDATE_SESSION_ACTIVITY: 'STORAGE_UPDATE_SESSION_ACTIVITY',
  STORAGE_SET_SESSION_INTENT: 'STORAGE_SET_SESSION_INTENT',
  STORAGE_GET_CHANNEL_STATS: 'STORAGE_GET_CHANNEL_STATS',
  STORAGE_UPDATE_CHANNEL_STATS: 'STORAGE_UPDATE_CHANNEL_STATS',
  STORAGE_UPDATE_DAILY_STATS: 'STORAGE_UPDATE_DAILY_STATS',
  STORAGE_GET_FOCUS_SCHEDULE: 'STORAGE_GET_FOCUS_SCHEDULE',
  STORAGE_PAUSE_FOCUS_MODE: 'STORAGE_PAUSE_FOCUS_MODE',
  STORAGE_GET_OVERRIDE_STATS: 'STORAGE_GET_OVERRIDE_STATS',
  STORAGE_TRACK_OVERRIDE: 'STORAGE_TRACK_OVERRIDE',
  SEARCH_RELATED_CONTENT: 'SEARCH_RELATED_CONTENT',
  REGENERATE_ABOUT_ME: 'REGENERATE_ABOUT_ME',
  GET_LIKED_CHANNELS: 'GET_LIKED_CHANNELS',
  REMOVE_LIKED_CHANNEL: 'REMOVE_LIKED_CHANNEL',
  UPDATE_SUBSCRIPTION_STATUS: 'UPDATE_SUBSCRIPTION_STATUS',
  CONDENSE_MEMORIES: 'CONDENSE_MEMORIES',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

// Request payloads
export interface AnalyzeVideoRequest {
  type: typeof MessageType.ANALYZE_VIDEO;
  videoId: string;
  videoUrl: string;
}

export interface CheckApiKeyRequest {
  type: typeof MessageType.CHECK_API_KEY;
}

export interface ValidateApiKeyRequest {
  type: typeof MessageType.VALIDATE_API_KEY;
  apiKey: string;
}

export interface GetCachedRequest {
  type: typeof MessageType.GET_CACHED;
  videoId: string;
}

export interface OpenOptionsRequest {
  type: typeof MessageType.OPEN_OPTIONS;
}

export interface SubmitFeedbackRequest {
  type: typeof MessageType.SUBMIT_FEEDBACK;
  videoId: string;
  videoTitle: string;
  feedback: 'like' | 'dislike';
  analysis: VideoAnalysis;
  channelInfo?: { channelId: string; channelName: string; channelUrl: string };
}

export interface GetVideoFeedbackRequest {
  type: typeof MessageType.GET_VIDEO_FEEDBACK;
  videoId: string;
}

export interface RegenerateVideoRequest {
  type: typeof MessageType.REGENERATE_VIDEO;
  videoId: string;
  videoUrl: string;
}

// Storage proxy requests
export interface StorageGetSettingsRequest {
  type: typeof MessageType.STORAGE_GET_SETTINGS;
}

export interface StorageGetSessionRequest {
  type: typeof MessageType.STORAGE_GET_SESSION;
}

export interface StorageStartSessionRequest {
  type: typeof MessageType.STORAGE_START_SESSION;
}

export interface StorageAddVideoToSessionRequest {
  type: typeof MessageType.STORAGE_ADD_VIDEO_TO_SESSION;
  video: SessionVideo;
}

export interface StorageEndVideoInSessionRequest {
  type: typeof MessageType.STORAGE_END_VIDEO_IN_SESSION;
  videoId: string;
}

export interface StorageUpdateSessionActivityRequest {
  type: typeof MessageType.STORAGE_UPDATE_SESSION_ACTIVITY;
}

export interface StorageSetSessionIntentRequest {
  type: typeof MessageType.STORAGE_SET_SESSION_INTENT;
  intent: WatchIntent;
}

export interface StorageGetChannelStatsRequest {
  type: typeof MessageType.STORAGE_GET_CHANNEL_STATS;
}

export interface StorageUpdateChannelStatsRequest {
  type: typeof MessageType.STORAGE_UPDATE_CHANNEL_STATS;
  channelId: string;
  channelName: string;
  scores: { productivity: number; educational: number; entertainment: number };
}

export interface StorageUpdateDailyStatsRequest {
  type: typeof MessageType.STORAGE_UPDATE_DAILY_STATS;
  video: {
    duration: number;
    scores: { productivity: number; educational: number; entertainment: number };
    channelId: string;
  };
}

export interface StorageGetFocusScheduleRequest {
  type: typeof MessageType.STORAGE_GET_FOCUS_SCHEDULE;
}

export interface StoragePauseFocusModeRequest {
  type: typeof MessageType.STORAGE_PAUSE_FOCUS_MODE;
  hours: number;
}

export interface StorageGetOverrideStatsRequest {
  type: typeof MessageType.STORAGE_GET_OVERRIDE_STATS;
}

export interface StorageTrackOverrideRequest {
  type: typeof MessageType.STORAGE_TRACK_OVERRIDE;
}

export interface SearchRelatedContentRequest {
  type: typeof MessageType.SEARCH_RELATED_CONTENT;
  videoId: string;
  summary: string;
  tags: string[];
}

export interface RegenerateAboutMeRequest {
  type: typeof MessageType.REGENERATE_ABOUT_ME;
}

export interface GetLikedChannelsRequest {
  type: typeof MessageType.GET_LIKED_CHANNELS;
}

export interface RemoveLikedChannelRequest {
  type: typeof MessageType.REMOVE_LIKED_CHANNEL;
  channelId: string;
}

export interface UpdateSubscriptionStatusRequest {
  type: typeof MessageType.UPDATE_SUBSCRIPTION_STATUS;
  channelId: string;
  status: 'subscribed' | 'not_subscribed' | 'unknown';
}

export interface CondenseMemoriesRequest {
  type: typeof MessageType.CONDENSE_MEMORIES;
}

export type Message =
  | AnalyzeVideoRequest
  | CheckApiKeyRequest
  | ValidateApiKeyRequest
  | GetCachedRequest
  | OpenOptionsRequest
  | SubmitFeedbackRequest
  | GetVideoFeedbackRequest
  | RegenerateVideoRequest
  | StorageGetSettingsRequest
  | StorageGetSessionRequest
  | StorageStartSessionRequest
  | StorageAddVideoToSessionRequest
  | StorageEndVideoInSessionRequest
  | StorageUpdateSessionActivityRequest
  | StorageSetSessionIntentRequest
  | StorageGetChannelStatsRequest
  | StorageUpdateChannelStatsRequest
  | StorageUpdateDailyStatsRequest
  | StorageGetFocusScheduleRequest
  | StoragePauseFocusModeRequest
  | StorageGetOverrideStatsRequest
  | StorageTrackOverrideRequest
  | SearchRelatedContentRequest
  | RegenerateAboutMeRequest
  | GetLikedChannelsRequest
  | RemoveLikedChannelRequest
  | UpdateSubscriptionStatusRequest
  | CondenseMemoriesRequest;

// Response types
export interface AnalyzeVideoResponse {
  success: boolean;
  analysis?: VideoAnalysis;
  error?: string;
}

export interface CheckApiKeyResponse {
  hasKey: boolean;
}

export interface ValidateApiKeyResponse {
  valid: boolean;
  error?: string;
}

export interface GetCachedResponse {
  cached: boolean;
  analysis?: VideoAnalysis;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  memories?: MemoryEntry[];
  error?: string;
}

export interface GetVideoFeedbackResponse {
  hasFeedback: boolean;
  feedback?: 'like' | 'dislike';
}

export interface RegenerateVideoResponse {
  success: boolean;
  analysis?: VideoAnalysis;
  error?: string;
}

// Storage proxy responses
export interface StorageGetSettingsResponse {
  settings: Settings;
}

export interface StorageGetSessionResponse {
  session: SessionData | null;
}

export interface StorageStartSessionResponse {
  session: SessionData;
}

export interface StorageGetChannelStatsResponse {
  stats: Record<string, ChannelStats>;
}

export interface StorageGetFocusScheduleResponse {
  schedule: FocusSchedule;
}

export interface OverrideStats {
  total: number;
  thisWeek: number;
  lastReset: number;
}

export interface StorageGetOverrideStatsResponse {
  stats: OverrideStats;
}

export interface SearchRelatedContentResponse {
  success: boolean;
  resources?: RelatedResource[];
  error?: string;
}

export interface RegenerateAboutMeResponse {
  success: boolean;
  aboutMe?: string;
  error?: string;
}

export interface GetLikedChannelsResponse {
  channels: LikedChannel[];
}

export interface RemoveLikedChannelResponse {
  success: boolean;
}

export interface UpdateSubscriptionStatusResponse {
  success: boolean;
}

export interface CondenseMemoriesResponse {
  success: boolean;
  before?: number;
  after?: number;
  error?: string;
}

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
