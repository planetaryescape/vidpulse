import type { PanelState, VideoAnalysis, SessionData, ChannelStats, WatchIntent, RelatedResource, VideoNote } from '../shared/types';
import type { GetVideoFeedbackResponse, SubmitFeedbackResponse, RegenerateVideoResponse, SearchRelatedContentResponse } from '../shared/messages';
import { sendMessage, MessageType } from '../shared/messages';
import { getScoreColor } from '../shared/utils';
import { getSession, getChannelStats, pauseFocusMode, getNotesForVideo, addNote, updateNote, deleteNote } from './storage-proxy';
import { isFocusModeActive } from './guardian';
import { getIntentAlignment, getIntentLabel } from './intent';
import { exportNotesForVideo } from '../shared/export';

const PANEL_ID = 'vidpulse-panel';
const FLOATING_CONTAINER_ID = 'vidpulse-floating-container';
const FONT_SIZE_KEY = 'vidpulse_fontSize';
const MIN_FONT_SIZE = 0.8;
const MAX_FONT_SIZE = 1.6;
const FONT_SIZE_STEP = 0.1;

async function getFontSize(): Promise<number> {
  const result = await chrome.storage.sync.get(FONT_SIZE_KEY);
  return (result[FONT_SIZE_KEY] as number | undefined) || 1;
}

async function saveFontSize(size: number): Promise<void> {
  await chrome.storage.sync.set({ [FONT_SIZE_KEY]: size });
}

function applyFontSize(panel: HTMLElement, size: number): void {
  panel.style.setProperty('--vp-font-scale', String(size));
}

// Create floating container as fallback when sidebar not found
function createFloatingContainer(): Element {
  // Remove existing floating container
  document.getElementById(FLOATING_CONTAINER_ID)?.remove();

  const container = document.createElement('div');
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

// Find sidebar container with retries and fallbacks, or create floating container
async function findOrCreateContainer(): Promise<{ container: Element; isFloating: boolean }> {
  const selectors = [
    '#secondary',
    '#secondary-inner',
    'ytd-watch-flexy #secondary',
    '#related',
    '#below',
    'ytd-watch-metadata',
  ];

  // Try 5 times with increasing delays
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        console.log(`VidPulse: Found container "${selector}" on attempt ${attempt + 1}`);
        return { container: el, isFloating: false };
      }
    }

    // Wait before next attempt (500ms, 1000ms, 1500ms, 2000ms, 2500ms)
    const delay = 500 * (attempt + 1);
    console.log(`VidPulse: Container not found, retrying in ${delay}ms...`);
    await new Promise(r => setTimeout(r, delay));
  }

  // Fallback: create floating container (always works)
  console.log('VidPulse: Using floating container fallback');
  return { container: createFloatingContainer(), isFloating: true };
}

function getVerdictDisplay(verdict: VideoAnalysis['verdict']): { text: string; class: string } {
  switch (verdict) {
    case 'worth_it':
      return { text: 'WORTH YOUR TIME', class: 'verdict-worth' };
    case 'maybe':
      return { text: 'MAYBE', class: 'verdict-maybe' };
    case 'skip':
      return { text: 'PROBABLY SKIP', class: 'verdict-skip' };
  }
}

function createScoreBar(label: string, score: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'vp-score-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'vp-score-label';
  labelEl.textContent = label;

  const barContainer = document.createElement('div');
  barContainer.className = 'vp-score-bar';

  const barFill = document.createElement('div');
  barFill.className = 'vp-score-fill';
  barFill.style.width = `${score}%`;
  barFill.style.backgroundColor = getScoreColor(score);

  const valueEl = document.createElement('span');
  valueEl.className = 'vp-score-value';
  valueEl.textContent = String(score);

  barContainer.appendChild(barFill);
  row.appendChild(labelEl);
  row.appendChild(barContainer);
  row.appendChild(valueEl);

  return row;
}

function getVideoTitle(): string {
  const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string');
  return titleEl?.textContent || document.title.replace(' - YouTube', '');
}

function seekToTime(seconds: number): void {
  const video = document.querySelector('video') as HTMLVideoElement | null;
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

function getCurrentVideoTime(): number {
  const video = document.querySelector('video') as HTMLVideoElement | null;
  return video ? video.currentTime : 0;
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function generateNoteId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getSessionStats(session: SessionData): { duration: string; videoCount: number; byCategory: Record<string, number> } {
  const duration = formatDuration(Date.now() - session.startTime);
  const videoCount = session.videos.length;

  const byCategory: Record<string, number> = { educational: 0, entertainment: 0, productive: 0, inspiring: 0, creative: 0 };
  for (const video of session.videos) {
    if (video.scores) {
      const maxScore = Math.max(video.scores.productivity, video.scores.educational, video.scores.entertainment, video.scores.inspiring, video.scores.creative);
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

function startSessionTimer(): void {
  if (sessionTimerInterval) return;

  sessionTimerInterval = setInterval(async () => {
    const timerEl = document.querySelector('.vp-session-timer');
    if (!timerEl) return;

    const session = await getSession();
    if (session) {
      const stats = getSessionStats(session);
      timerEl.textContent = `${stats.duration} \u00B7 ${stats.videoCount} video${stats.videoCount !== 1 ? 's' : ''}`;
    }
  }, 10000); // Update every 10 seconds
}

function stopSessionTimer(): void {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }
}

function getChannelInfo(): { channelId: string; channelName: string; channelUrl: string } | null {
  const channelLink = document.querySelector('ytd-video-owner-renderer a.yt-simple-endpoint') as HTMLAnchorElement | null;
  if (channelLink) {
    const href = channelLink.href;
    const channelMatch = href.match(/\/(channel|c|user|@)\/([^\/\?]+)/);
    const channelId = channelMatch ? channelMatch[2] : href;
    const channelName = channelLink.textContent?.trim() || 'Unknown Channel';
    return { channelId, channelName, channelUrl: href };
  }
  return null;
}

function getSubscriptionStatus(): 'subscribed' | 'not_subscribed' | 'unknown' {
  const subscribeBtn = document.querySelector('ytd-subscribe-button-renderer');
  if (!subscribeBtn) return 'unknown';

  // Check button text/label for subscription state
  const btnText = subscribeBtn.textContent?.toLowerCase() || '';
  const ariaLabel = subscribeBtn.getAttribute('aria-label')?.toLowerCase() || '';

  if (btnText.includes('subscribed') || ariaLabel.includes('subscribed')) {
    return 'subscribed';
  }
  if (btnText.includes('subscribe') || ariaLabel.includes('subscribe')) {
    return 'not_subscribed';
  }

  return 'unknown';
}

async function updateLikedChannelSubscriptionStatus(): Promise<void> {
  const channelInfo = getChannelInfo();
  if (!channelInfo) return;

  const status = getSubscriptionStatus();
  if (status === 'unknown') return;

  // Update subscription status for this channel if it's in liked channels
  try {
    await sendMessage({
      type: MessageType.UPDATE_SUBSCRIPTION_STATUS,
      channelId: channelInfo.channelId,
      status,
    });
  } catch {
    // Silently fail - not critical
  }
}

function getChannelTrustBadge(stats: ChannelStats): { text: string; class: string } {
  const avgScore = (stats.avgScores.productivity + stats.avgScores.educational + stats.avgScores.entertainment + stats.avgScores.inspiring + stats.avgScores.creative) / 5;
  if (stats.manualTrust === 'trusted') {
    return { text: 'Trusted', class: 'vp-channel-trusted' };
  }
  if (stats.manualTrust === 'blocked') {
    return { text: 'Blocked', class: 'vp-channel-blocked' };
  }
  if (avgScore >= 70) {
    return { text: 'High quality', class: 'vp-channel-high' };
  }
  if (avgScore >= 40) {
    return { text: 'Mixed', class: 'vp-channel-mixed' };
  }
  return { text: 'Low quality', class: 'vp-channel-low' };
}

async function buildChannelBadge(): Promise<HTMLElement | null> {
  const channelInfo = getChannelInfo();
  if (!channelInfo) return null;

  const allStats = await getChannelStats();
  const stats = allStats[channelInfo.channelId];

  // Only show if we have 2+ videos from this channel
  if (!stats || stats.videoCount < 2) return null;

  const badge = getChannelTrustBadge(stats);
  const container = document.createElement('div');
  container.className = 'vp-channel-info';

  const badgeEl = document.createElement('span');
  badgeEl.className = `vp-channel-badge ${badge.class}`;
  badgeEl.textContent = badge.text;
  badgeEl.title = `Channel avg: ${Math.round((stats.avgScores.productivity + stats.avgScores.educational + stats.avgScores.entertainment + stats.avgScores.inspiring + stats.avgScores.creative) / 5)} (${stats.videoCount} videos)`;

  container.appendChild(badgeEl);
  return container;
}

function createFeedbackButtons(
  state: PanelState
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'vp-feedback';

  const label = document.createElement('span');
  label.className = 'vp-feedback-label';
  label.textContent = 'Was this helpful?';

  const btnContainer = document.createElement('div');
  btnContainer.className = 'vp-feedback-btns';

  const likeBtn = document.createElement('button');
  likeBtn.className = 'vp-feedback-btn vp-like-btn';
  likeBtn.setAttribute('type', 'button');
  likeBtn.title = 'I liked this video';

  const likeIcon = document.createElement('span');
  likeIcon.className = 'vp-feedback-icon';
  likeIcon.textContent = '\u2713'; // ✓ checkmark
  const likeText = document.createElement('span');
  likeText.className = 'vp-feedback-text';
  likeText.textContent = 'Liked';
  likeBtn.appendChild(likeIcon);
  likeBtn.appendChild(likeText);

  const dislikeBtn = document.createElement('button');
  dislikeBtn.className = 'vp-feedback-btn vp-dislike-btn';
  dislikeBtn.setAttribute('type', 'button');
  dislikeBtn.title = "I didn't like this video";

  const dislikeIcon = document.createElement('span');
  dislikeIcon.className = 'vp-feedback-icon';
  dislikeIcon.textContent = '\u2717'; // ✗ cross
  const dislikeText = document.createElement('span');
  dislikeText.className = 'vp-feedback-text';
  dislikeText.textContent = 'Skip';
  dislikeBtn.appendChild(dislikeIcon);
  dislikeBtn.appendChild(dislikeText);

  // Check if already submitted feedback
  if (state.userFeedback) {
    if (state.userFeedback === 'like') {
      likeBtn.classList.add('vp-feedback-active');
    } else {
      dislikeBtn.classList.add('vp-feedback-active');
    }
    likeBtn.disabled = true;
    dislikeBtn.disabled = true;
    label.textContent = 'Feedback saved!';
  }

  const handleFeedback = async (feedback: 'like' | 'dislike') => {
    if (!state.analysis) return;

    likeBtn.disabled = true;
    dislikeBtn.disabled = true;
    label.textContent = 'Saving...';

    try {
      const channelInfo = getChannelInfo() || undefined;
      const response = await sendMessage<SubmitFeedbackResponse>({
        type: MessageType.SUBMIT_FEEDBACK,
        videoId: state.videoId,
        videoTitle: getVideoTitle(),
        feedback,
        analysis: state.analysis,
        channelInfo,
      });

      if (response.success) {
        if (feedback === 'like') {
          likeBtn.classList.add('vp-feedback-active');
        } else {
          dislikeBtn.classList.add('vp-feedback-active');
        }
        label.textContent = 'Feedback saved!';
      } else {
        label.textContent = 'Failed to save';
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
      }
    } catch {
      label.textContent = 'Failed to save';
      likeBtn.disabled = false;
      dislikeBtn.disabled = false;
    }
  };

  likeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFeedback('like');
  });

  dislikeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFeedback('dislike');
  });

  btnContainer.appendChild(likeBtn);
  btnContainer.appendChild(dislikeBtn);
  container.appendChild(label);
  container.appendChild(btnContainer);

  return container;
}

async function buildHeader(state: PanelState, currentFontSize: number): Promise<HTMLElement> {
  const header = document.createElement('div');
  header.className = 'vp-header';

  const logoRow = document.createElement('div');
  logoRow.className = 'vp-logo-row';

  const logo = document.createElement('span');
  logo.className = 'vp-logo';
  logo.textContent = 'VIDPULSE';

  // Session timer
  const sessionTimer = document.createElement('span');
  sessionTimer.className = 'vp-session-timer';
  const session = await getSession();
  if (session) {
    const stats = getSessionStats(session);
    sessionTimer.textContent = `${stats.duration} \u00B7 ${stats.videoCount} video${stats.videoCount !== 1 ? 's' : ''}`;
  }

  logoRow.appendChild(logo);
  logoRow.appendChild(sessionTimer);

  // Focus mode badge
  const focusActive = await isFocusModeActive();
  if (focusActive) {
    const focusBadge = document.createElement('span');
    focusBadge.className = 'vp-focus-badge';
    focusBadge.textContent = 'Focus';
    focusBadge.title = 'Focus mode active - click to pause for 1 hour';
    focusBadge.addEventListener('click', async () => {
      await pauseFocusMode(1);
      focusBadge.remove();
    });
    logoRow.appendChild(focusBadge);
  }

  const controls = document.createElement('div');
  controls.className = 'vp-controls';

  // Font size controls
  const fontControls = document.createElement('div');
  fontControls.className = 'vp-font-controls';

  const decreaseBtn = document.createElement('button');
  decreaseBtn.className = 'vp-font-btn';
  decreaseBtn.setAttribute('type', 'button');
  decreaseBtn.textContent = 'A\u2212';
  decreaseBtn.title = 'Decrease text size';
  decreaseBtn.disabled = currentFontSize <= MIN_FONT_SIZE;

  const increaseBtn = document.createElement('button');
  increaseBtn.className = 'vp-font-btn';
  increaseBtn.setAttribute('type', 'button');
  increaseBtn.textContent = 'A+';
  increaseBtn.title = 'Increase text size';
  increaseBtn.disabled = currentFontSize >= MAX_FONT_SIZE;

  const getCurrentSize = (): number => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return 1;
    const scale = panel.style.getPropertyValue('--vp-font-scale');
    return scale ? parseFloat(scale) : 1;
  };

  decreaseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const current = getCurrentSize();
    const newSize = Math.max(MIN_FONT_SIZE, Math.round((current - FONT_SIZE_STEP) * 10) / 10);
    saveFontSize(newSize);
    applyFontSize(panel, newSize);
    decreaseBtn.disabled = newSize <= MIN_FONT_SIZE;
    increaseBtn.disabled = newSize >= MAX_FONT_SIZE;
  });

  increaseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const current = getCurrentSize();
    const newSize = Math.min(MAX_FONT_SIZE, Math.round((current + FONT_SIZE_STEP) * 10) / 10);
    saveFontSize(newSize);
    applyFontSize(panel, newSize);
    decreaseBtn.disabled = newSize <= MIN_FONT_SIZE;
    increaseBtn.disabled = newSize >= MAX_FONT_SIZE;
  });

  fontControls.appendChild(decreaseBtn);
  fontControls.appendChild(increaseBtn);
  controls.appendChild(fontControls);

  // Regenerate button (only shown when analysis is ready)
  if (state.status === 'ready') {
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'vp-regenerate-btn';
    regenerateBtn.setAttribute('type', 'button');
    regenerateBtn.textContent = '\u21BB';
    regenerateBtn.title = 'Regenerate analysis';
    regenerateBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await injectPanel({ status: 'loading', videoId: state.videoId });
      try {
        const response = await sendMessage<RegenerateVideoResponse>({
          type: MessageType.REGENERATE_VIDEO,
          videoId: state.videoId,
          videoUrl: `https://www.youtube.com/watch?v=${state.videoId}`,
        });
        if (response.success && response.analysis) {
          await injectPanel({ status: 'ready', videoId: state.videoId, analysis: response.analysis });
        } else {
          await injectPanel({ status: 'error', videoId: state.videoId, error: response.error || 'Failed to regenerate' });
        }
      } catch (err) {
        await injectPanel({ status: 'error', videoId: state.videoId, error: err instanceof Error ? err.message : 'Failed to regenerate' });
      }
    });
    controls.appendChild(regenerateBtn);
  }

  // Settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'vp-settings-btn';
  settingsBtn.setAttribute('type', 'button');
  settingsBtn.textContent = '\u2699';
  settingsBtn.title = 'Settings';
  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendMessage({ type: MessageType.OPEN_OPTIONS });
  });
  controls.appendChild(settingsBtn);

  header.appendChild(logoRow);
  header.appendChild(controls);
  return header;
}

function buildLoadingContent(): HTMLElement {
  const loading = document.createElement('div');
  loading.className = 'vp-loading';

  const spinner = document.createElement('div');
  spinner.className = 'vp-spinner';

  const text = document.createElement('p');
  text.textContent = 'Analyzing video...';

  const subtext = document.createElement('p');
  subtext.className = 'vp-subtext';
  subtext.textContent = 'Gemini is watching the video for you';

  loading.appendChild(spinner);
  loading.appendChild(text);
  loading.appendChild(subtext);
  return loading;
}

function buildNoKeyContent(): HTMLElement {
  const noKey = document.createElement('div');
  noKey.className = 'vp-no-key';

  const text = document.createElement('p');
  text.textContent = 'API key required';

  const btn = document.createElement('button');
  btn.className = 'vp-setup-btn';
  btn.setAttribute('type', 'button');
  btn.textContent = 'Set up VidPulse';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendMessage({ type: MessageType.OPEN_OPTIONS });
  });

  noKey.appendChild(text);
  noKey.appendChild(btn);
  return noKey;
}

function buildErrorContent(error?: string): HTMLElement {
  const errorEl = document.createElement('div');
  errorEl.className = 'vp-error';

  const text = document.createElement('p');
  text.textContent = error || 'Analysis failed';

  errorEl.appendChild(text);
  return errorEl;
}

function buildSummaryPanel(analysis: VideoAnalysis): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'vp-tab-panel';
  panel.style.display = 'block';

  const summaryText = document.createElement('p');
  summaryText.className = 'vp-summary';
  summaryText.textContent = analysis.summary;
  panel.appendChild(summaryText);

  const scores = document.createElement('div');
  scores.className = 'vp-scores';
  scores.appendChild(createScoreBar('PRODUCTIVE', analysis.scores.productivity));
  scores.appendChild(createScoreBar('EDUCATIONAL', analysis.scores.educational));
  scores.appendChild(createScoreBar('ENTERTAINING', analysis.scores.entertainment));
  scores.appendChild(createScoreBar('INSPIRING', analysis.scores.inspiring));
  scores.appendChild(createScoreBar('CREATIVE', analysis.scores.creative));
  panel.appendChild(scores);

  return panel;
}

function buildForYouPanel(analysis: VideoAnalysis): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'vp-tab-panel';
  panel.style.display = 'none';

  if (analysis.reason) {
    const reasonText = document.createElement('p');
    reasonText.className = 'vp-reason';
    reasonText.textContent = analysis.reason;
    panel.appendChild(reasonText);
  }

  if (analysis.matchesInterests !== undefined) {
    const interestBadge = document.createElement('div');
    interestBadge.className = analysis.matchesInterests ? 'vp-interest-match' : 'vp-interest-mismatch';

    const interestText = document.createElement('span');
    interestText.textContent = analysis.matchesInterests ? 'Matches your interests' : 'Outside your usual interests';
    interestBadge.appendChild(interestText);

    if (analysis.scores.relevance !== undefined) {
      const interestScore = document.createElement('span');
      interestScore.className = 'vp-interest-score';
      interestScore.textContent = `${analysis.scores.relevance}%`;
      interestBadge.appendChild(interestScore);
    }
    panel.appendChild(interestBadge);
  }

  if (analysis.enjoymentConfidence !== undefined) {
    const confidenceSection = document.createElement('div');
    confidenceSection.className = 'vp-confidence';

    const confidenceLabel = document.createElement('span');
    confidenceLabel.className = 'vp-confidence-label';
    confidenceLabel.textContent = 'Enjoyment Confidence';

    const confidenceValue = document.createElement('span');
    confidenceValue.className = 'vp-confidence-value';
    confidenceValue.style.color = getScoreColor(analysis.enjoymentConfidence);
    confidenceValue.textContent = `${analysis.enjoymentConfidence}%`;

    confidenceSection.appendChild(confidenceLabel);
    confidenceSection.appendChild(confidenceValue);
    panel.appendChild(confidenceSection);
  }

  return panel;
}

function buildChaptersPanel(analysis: VideoAnalysis): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'vp-tab-panel';
  panel.style.display = 'none';

  if (analysis.keyPoints && analysis.keyPoints.length > 0) {
    const keyPointsList = document.createElement('div');
    keyPointsList.className = 'vp-keypoints-inline';

    for (const point of analysis.keyPoints) {
      const item = document.createElement('div');
      item.className = 'vp-keypoint';

      const timestampBtn = document.createElement('button');
      timestampBtn.className = 'vp-keypoint-time';
      timestampBtn.setAttribute('type', 'button');
      timestampBtn.textContent = point.timestamp;
      timestampBtn.title = `Jump to ${point.timestamp}`;
      timestampBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        seekToTime(point.seconds);
      });

      const pointContent = document.createElement('div');
      pointContent.className = 'vp-keypoint-content';

      const title = document.createElement('div');
      title.className = 'vp-keypoint-title';
      title.textContent = point.title;

      const desc = document.createElement('div');
      desc.className = 'vp-keypoint-desc';
      desc.textContent = point.description;

      pointContent.appendChild(title);
      pointContent.appendChild(desc);
      item.appendChild(timestampBtn);
      item.appendChild(pointContent);
      keyPointsList.appendChild(item);
    }
    panel.appendChild(keyPointsList);
  } else {
    const noChapters = document.createElement('p');
    noChapters.className = 'vp-no-chapters';
    noChapters.textContent = 'No chapter information available for this video.';
    panel.appendChild(noChapters);
  }

  return panel;
}

function buildRelatedPanel(state: PanelState): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'vp-tab-panel vp-related-panel';
  panel.style.display = 'none';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'vp-related-loading';
  loadingEl.textContent = 'Finding related resources...';
  panel.appendChild(loadingEl);

  // Load related content async
  if (state.analysis) {
    setTimeout(() => loadRelatedContent(panel, state.videoId, state.analysis!), 100);
  }

  return panel;
}

async function loadRelatedContent(panel: HTMLElement, videoId: string, analysis: VideoAnalysis): Promise<void> {
  try {
    const response = await sendMessage<SearchRelatedContentResponse>({
      type: MessageType.SEARCH_RELATED_CONTENT,
      videoId,
      summary: analysis.summary,
      tags: analysis.tags,
    });

    // Clear loading state
    while (panel.firstChild) {
      panel.removeChild(panel.firstChild);
    }

    if (!response.success) {
      const errorEl = document.createElement('div');
      errorEl.className = 'vp-related-empty';

      if (response.error?.includes('not configured')) {
        errorEl.textContent = 'Brave API key not configured. ';
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = 'Open settings';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          sendMessage({ type: MessageType.OPEN_OPTIONS });
        });
        errorEl.appendChild(link);
      } else {
        errorEl.textContent = response.error || 'Failed to find related content';
      }

      panel.appendChild(errorEl);
      return;
    }

    renderRelatedList(panel, response.resources || []);
  } catch (error) {
    while (panel.firstChild) {
      panel.removeChild(panel.firstChild);
    }

    const errorEl = document.createElement('div');
    errorEl.className = 'vp-related-empty';
    errorEl.textContent = 'Error loading related content';
    panel.appendChild(errorEl);
  }
}

function renderRelatedList(panel: HTMLElement, resources: RelatedResource[]): void {
  // Clear panel safely
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }

  if (resources.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'vp-related-empty';
    empty.textContent = 'No related resources found';
    panel.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'vp-related-list';

  for (const resource of resources) {
    const item = document.createElement('a');
    item.className = 'vp-related-item';
    item.href = resource.url;
    item.target = '_blank';
    item.rel = 'noopener';

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'vp-related-favicon';
    favicon.src = resource.favicon || '';
    favicon.alt = '';
    favicon.onerror = () => {
      favicon.style.display = 'none';
    };

    // Content container
    const content = document.createElement('div');
    content.className = 'vp-related-content';

    const title = document.createElement('div');
    title.className = 'vp-related-title';
    title.textContent = resource.title;

    const desc = document.createElement('div');
    desc.className = 'vp-related-desc';
    const description = resource.description || '';
    desc.textContent = description.length > 120 ? description.slice(0, 120) + '...' : description;

    const source = document.createElement('div');
    source.className = 'vp-related-source';
    source.textContent = resource.source;

    content.appendChild(title);
    content.appendChild(desc);
    content.appendChild(source);

    item.appendChild(favicon);
    item.appendChild(content);
    list.appendChild(item);
  }

  panel.appendChild(list);
}

function buildNotesPanel(state: PanelState): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'vp-tab-panel vp-notes-panel';
  panel.style.display = 'none';

  // Header with add button and export
  const header = document.createElement('div');
  header.className = 'vp-notes-header';

  const addBtn = document.createElement('button');
  addBtn.className = 'vp-add-note-btn';
  addBtn.setAttribute('type', 'button');
  addBtn.textContent = '+ Add Note';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'vp-export-notes-btn';
  exportBtn.setAttribute('type', 'button');
  exportBtn.title = 'Export notes as markdown';
  exportBtn.textContent = '\u2193'; // ↓

  header.appendChild(addBtn);
  header.appendChild(exportBtn);
  panel.appendChild(header);

  // Notes list container
  const notesList = document.createElement('div');
  notesList.className = 'vp-notes-list';
  panel.appendChild(notesList);

  // Empty state
  const emptyState = document.createElement('p');
  emptyState.className = 'vp-no-notes';
  emptyState.textContent = 'No notes yet. Click "Add Note" to capture a thought.';

  // Load and render notes
  const loadNotes = async () => {
    const notes = await getNotesForVideo(state.videoId);
    // Clear safely
    while (notesList.firstChild) {
      notesList.removeChild(notesList.firstChild);
    }

    if (notes.length === 0) {
      notesList.appendChild(emptyState);
      exportBtn.style.display = 'none';
    } else {
      exportBtn.style.display = '';
      for (const note of notes) {
        notesList.appendChild(createNoteItem(note, state.videoId, loadNotes));
      }
    }
  };

  // Add note handler
  addBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const currentTime = getCurrentVideoTime();
    const timestamp = formatTimestamp(currentTime);

    const newNote: VideoNote = {
      id: generateNoteId(),
      videoId: state.videoId,
      videoTitle: getVideoTitle(),
      videoUrl: `https://www.youtube.com/watch?v=${state.videoId}`,
      timestamp: currentTime,
      timestampFormatted: timestamp,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await addNote(newNote);
    await loadNotes();

    // Focus the new note's textarea
    const noteItems = notesList.querySelectorAll('.vp-note-item');
    const lastNote = noteItems[noteItems.length - 1];
    const textarea = lastNote?.querySelector('textarea') as HTMLTextAreaElement;
    textarea?.focus();
  });

  // Export handler
  exportBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await exportNotesForVideo(state.videoId);
  });

  // Initial load
  loadNotes();

  return panel;
}

function createNoteItem(note: VideoNote, videoId: string, onUpdate: () => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'vp-note-item';
  item.dataset.noteId = note.id;

  // Timestamp button
  const timestampBtn = document.createElement('button');
  timestampBtn.className = 'vp-note-time';
  timestampBtn.setAttribute('type', 'button');
  timestampBtn.textContent = note.timestampFormatted;
  timestampBtn.title = `Jump to ${note.timestampFormatted}`;
  timestampBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    seekToTime(note.timestamp);
  });

  // Content area
  const contentArea = document.createElement('div');
  contentArea.className = 'vp-note-content';

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'vp-note-text';
  textarea.value = note.content;
  textarea.placeholder = 'Type your note...';
  textarea.rows = 2;

  // Auto-resize
  const autoResize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 40)}px`;
  };

  // Auto-save with debounce
  let saveTimeout: ReturnType<typeof setTimeout>;
  textarea.addEventListener('input', () => {
    autoResize();
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await updateNote(videoId, note.id, textarea.value);
    }, 500);
  });

  textarea.addEventListener('focus', autoResize);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'vp-note-delete';
  deleteBtn.setAttribute('type', 'button');
  deleteBtn.textContent = '\u2715'; // ×
  deleteBtn.title = 'Delete note';

  deleteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm('Delete this note?')) {
      await deleteNote(videoId, note.id);
      onUpdate();
    }
  });

  contentArea.appendChild(textarea);
  contentArea.appendChild(deleteBtn);

  item.appendChild(timestampBtn);
  item.appendChild(contentArea);

  // Auto-resize on mount
  setTimeout(autoResize, 0);

  return item;
}

async function buildAnalysisContent(analysis: VideoAnalysis, state: PanelState): Promise<HTMLElement> {
  const content = document.createDocumentFragment();

  // Intent alignment badge (if intent is set)
  const session = await getSession();
  if (session?.intent) {
    const alignment = getIntentAlignment(session.intent, analysis.scores);
    const intentBadge = document.createElement('div');
    intentBadge.className = `vp-intent-badge ${alignment.aligned ? 'aligned' : 'misaligned'}`;

    const icon = document.createElement('span');
    icon.className = 'vp-intent-badge-icon';
    icon.textContent = alignment.aligned ? '\u2714' : '\u26A0'; // ✔ or ⚠

    const text = document.createElement('span');
    text.className = 'vp-intent-badge-text';
    text.textContent = alignment.message;

    intentBadge.appendChild(icon);
    intentBadge.appendChild(text);
    content.appendChild(intentBadge);
  }

  // Compact header: Verdict + Relevance + Channel badge
  const compactHeader = document.createElement('div');
  compactHeader.className = 'vp-compact-header';

  // Channel badge (if available)
  const channelBadge = await buildChannelBadge();
  if (channelBadge) {
    compactHeader.appendChild(channelBadge);
  }

  const verdictData = getVerdictDisplay(analysis.verdict);
  const verdictBadge = document.createElement('span');
  verdictBadge.className = `vp-verdict-badge ${verdictData.class}`;
  verdictBadge.textContent = verdictData.text;

  if (analysis.scores.relevance !== undefined) {
    const relevanceScore = document.createElement('span');
    relevanceScore.className = 'vp-relevance-badge';
    relevanceScore.style.color = getScoreColor(analysis.scores.relevance);
    relevanceScore.textContent = `${analysis.scores.relevance}% match`;
    compactHeader.appendChild(relevanceScore);
  }
  compactHeader.appendChild(verdictBadge);

  // Tags
  const tags = document.createElement('div');
  tags.className = 'vp-tags-compact';
  for (const tag of analysis.tags.slice(0, 4)) {
    const tagEl = document.createElement('span');
    tagEl.className = 'vp-tag';
    tagEl.textContent = tag;
    tags.appendChild(tagEl);
  }

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'vp-tab-bar';

  const tabDefs = [
    { id: 'summary', label: 'Summary' },
    { id: 'foryou', label: 'For You' },
    { id: 'chapters', label: 'Chapters', disabled: !analysis.keyPoints?.length },
    { id: 'notes', label: 'Notes' },
    { id: 'related', label: 'Related' },
  ];

  const tabPanels: Record<string, HTMLElement> = {
    summary: buildSummaryPanel(analysis),
    foryou: buildForYouPanel(analysis),
    chapters: buildChaptersPanel(analysis),
    notes: buildNotesPanel(state),
    related: buildRelatedPanel(state),
  };

  tabDefs.forEach((tab, index) => {
    const tabBtn = document.createElement('button');
    tabBtn.className = 'vp-tab' + (index === 0 ? ' vp-tab-active' : '') + (tab.disabled ? ' vp-tab-disabled' : '');
    tabBtn.setAttribute('type', 'button');
    tabBtn.textContent = tab.label;
    tabBtn.disabled = tab.disabled || false;
    tabBtn.dataset.tab = tab.id;

    tabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tab.disabled) return;
      tabBar.querySelectorAll('.vp-tab').forEach(t => t.classList.remove('vp-tab-active'));
      tabBtn.classList.add('vp-tab-active');
      Object.entries(tabPanels).forEach(([id, panel]) => {
        panel.style.display = id === tab.id ? 'block' : 'none';
      });
    });
    tabBar.appendChild(tabBtn);
  });

  // Tab content container
  const tabContent = document.createElement('div');
  tabContent.className = 'vp-tab-content';
  Object.values(tabPanels).forEach(panel => tabContent.appendChild(panel));

  // Assemble
  content.appendChild(compactHeader);
  content.appendChild(tags);
  content.appendChild(tabBar);
  content.appendChild(tabContent);
  content.appendChild(createFeedbackButtons(state));

  const wrapper = document.createElement('div');
  wrapper.appendChild(content);
  return wrapper;
}

async function buildPanelContent(state: PanelState, currentFontSize: number): Promise<DocumentFragment> {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(await buildHeader(state, currentFontSize));

  const content = document.createElement('div');
  content.className = 'vp-content';

  if (state.status === 'loading') {
    content.appendChild(buildLoadingContent());
  } else if (state.status === 'no_key') {
    content.appendChild(buildNoKeyContent());
  } else if (state.status === 'error') {
    content.appendChild(buildErrorContent(state.error));
  } else if (state.status === 'ready' && state.analysis) {
    const analysisContent = await buildAnalysisContent(state.analysis, state);
    while (analysisContent.firstChild) {
      content.appendChild(analysisContent.firstChild);
    }
  }

  fragment.appendChild(content);
  return fragment;
}

export function removePanel(): void {
  stopSessionTimer();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(FLOATING_CONTAINER_ID)?.remove();
}

export async function injectPanel(state: PanelState): Promise<void> {
  try {
    // Run all async operations in parallel for instant cached display
    const [{ container, isFloating }, fontSize, feedbackResponse] = await Promise.all([
      findOrCreateContainer(),
      getFontSize(),
      state.status === 'ready' && state.analysis
        ? sendMessage<GetVideoFeedbackResponse>({
            type: MessageType.GET_VIDEO_FEEDBACK,
            videoId: state.videoId,
          }).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    removePanel();

    const userFeedback = feedbackResponse?.hasFeedback ? feedbackResponse.feedback : undefined;
    const stateWithFeedback = { ...state, userFeedback };

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'vidpulse-panel' + (isFloating ? ' vidpulse-floating' : '');
    applyFontSize(panel, fontSize);
    panel.appendChild(await buildPanelContent(stateWithFeedback, fontSize));

    // Start session timer updates
    startSessionTimer();

    // Add close button for floating panel
    if (isFloating) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'vp-floating-close';
      closeBtn.setAttribute('type', 'button');
      closeBtn.textContent = '\u2715'; // ✕
      closeBtn.title = 'Close panel';
      closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: var(--vp-text-muted, #666);
        z-index: 1;
      `;
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removePanel();
      });
      panel.style.position = 'relative';
      panel.insertBefore(closeBtn, panel.firstChild);
    }

    // Insert at top of container
    container.insertBefore(panel, container.firstChild);

    // Update subscription status for liked channels (opportunistic)
    updateLikedChannelSubscriptionStatus();
  } catch (error) {
    console.error('VidPulse: Failed to inject panel', error);
  }
}

// Exported functions for keyboard shortcuts
export function togglePanelVisibility(): void {
  const panel = document.getElementById(PANEL_ID);
  const floatingContainer = document.getElementById(FLOATING_CONTAINER_ID);

  if (panel) {
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? '' : 'none';
  }
  if (floatingContainer) {
    const isHidden = floatingContainer.style.display === 'none';
    floatingContainer.style.display = isHidden ? '' : 'none';
  }
}

export function triggerFeedback(type: 'like' | 'dislike'): void {
  const btn = type === 'like'
    ? document.querySelector('.vp-like-btn') as HTMLButtonElement
    : document.querySelector('.vp-dislike-btn') as HTMLButtonElement;

  if (btn && !btn.disabled) {
    btn.click();
  }
}

export function triggerRegenerate(): void {
  const btn = document.querySelector('.vp-regenerate-btn') as HTMLButtonElement;
  if (btn) {
    btn.click();
  }
}
