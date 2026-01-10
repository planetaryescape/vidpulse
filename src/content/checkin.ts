import { getSession, getSettings } from './storage-proxy';
import type { SessionData } from '../shared/types';

const CHECKIN_OVERLAY_ID = 'vidpulse-checkin-overlay';
let checkInTimer: ReturnType<typeof setTimeout> | null = null;
let lastCheckIn: number = 0;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

function getSessionSummary(session: SessionData): string {
  const videoCount = session.videos.length;
  const categories = { educational: 0, entertainment: 0, productive: 0 };

  for (const video of session.videos) {
    if (video.scores) {
      const maxScore = Math.max(video.scores.productivity, video.scores.educational, video.scores.entertainment);
      if (video.scores.educational === maxScore) categories.educational++;
      else if (video.scores.entertainment === maxScore) categories.entertainment++;
      else categories.productive++;
    }
  }

  const parts: string[] = [];
  if (categories.educational > 0) parts.push(`${categories.educational} educational`);
  if (categories.entertainment > 0) parts.push(`${categories.entertainment} entertainment`);
  if (categories.productive > 0) parts.push(`${categories.productive} productive`);

  return `${videoCount} video${videoCount !== 1 ? 's' : ''}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
}

function createCheckInOverlay(session: SessionData): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = CHECKIN_OVERLAY_ID;
  overlay.className = 'vp-checkin-overlay';

  const content = document.createElement('div');
  content.className = 'vp-checkin-content';

  const icon = document.createElement('div');
  icon.className = 'vp-checkin-icon';
  icon.textContent = '\u23F0'; // ⏰

  const title = document.createElement('h2');
  title.className = 'vp-checkin-title';
  title.textContent = 'Time check';

  const duration = document.createElement('p');
  duration.className = 'vp-checkin-duration';
  duration.textContent = `You've been watching for `;
  const durationStrong = document.createElement('strong');
  durationStrong.textContent = formatDuration(Date.now() - session.startTime);
  duration.appendChild(durationStrong);

  const summary = document.createElement('p');
  summary.className = 'vp-checkin-summary';
  summary.textContent = getSessionSummary(session);

  const question = document.createElement('div');
  question.className = 'vp-checkin-question';
  question.textContent = 'Still intentional?';

  const buttons = document.createElement('div');
  buttons.className = 'vp-checkin-buttons';

  const breakBtn = document.createElement('button');
  breakBtn.className = 'vp-checkin-btn vp-checkin-break';
  breakBtn.setAttribute('type', 'button');
  breakBtn.textContent = 'Take a break';

  const continueBtn = document.createElement('button');
  continueBtn.className = 'vp-checkin-btn vp-checkin-continue';
  continueBtn.setAttribute('type', 'button');
  continueBtn.textContent = 'Continue watching';

  const hint = document.createElement('p');
  hint.className = 'vp-checkin-hint';
  hint.textContent = 'Press Esc to continue';

  // Handle continue
  continueBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissCheckIn();
    scheduleNextCheckIn();
  });

  // Handle break
  breakBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissCheckIn();
    // Pause the video
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      video.pause();
    }
  });

  // Handle escape key
  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dismissCheckIn();
      scheduleNextCheckIn();
    }
  };
  document.addEventListener('keydown', keydownHandler);

  buttons.appendChild(breakBtn);
  buttons.appendChild(continueBtn);

  content.appendChild(icon);
  content.appendChild(title);
  content.appendChild(duration);
  content.appendChild(summary);
  content.appendChild(question);
  content.appendChild(buttons);
  content.appendChild(hint);

  overlay.appendChild(content);

  return overlay;
}

export function showCheckIn(): void {
  // Remove existing overlay if present
  dismissCheckIn();

  getSession().then(session => {
    if (!session) return;

    const overlay = createCheckInOverlay(session);
    document.body.appendChild(overlay);
    lastCheckIn = Date.now();
  });
}

export function dismissCheckIn(): void {
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  const overlay = document.getElementById(CHECKIN_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

export async function scheduleNextCheckIn(): Promise<void> {
  // Clear any existing timer
  if (checkInTimer) {
    clearTimeout(checkInTimer);
    checkInTimer = null;
  }

  const settings = await getSettings();
  if (!settings.checkInEnabled || settings.checkInInterval <= 0) {
    return;
  }

  const intervalMs = settings.checkInInterval * 60 * 1000;

  checkInTimer = setTimeout(async () => {
    const session = await getSession();
    if (session) {
      showCheckIn();
    }
  }, intervalMs);
}

export function cancelCheckIn(): void {
  if (checkInTimer) {
    clearTimeout(checkInTimer);
    checkInTimer = null;
  }
  dismissCheckIn();
}

// Initialize check-in system
export async function initCheckIn(): Promise<void> {
  const settings = await getSettings();
  if (settings.checkInEnabled && settings.checkInInterval > 0) {
    await scheduleNextCheckIn();
  }
}
