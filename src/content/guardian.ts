import type { VideoAnalysis, Settings, FocusSchedule } from '../shared/types';
import { getScoreLevel } from '../shared/utils';
import { getFocusSchedule, isInFocusPeriod, trackOverride } from './storage-proxy';

const GUARDIAN_ID = 'vidpulse-guardian';
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

export interface BlockResult {
  block: boolean;
  reason: string;
  blockedTags?: string[];
  focusMode?: boolean;
}

export async function shouldBlock(analysis: VideoAnalysis, settings: Settings): Promise<BlockResult> {
  if (!settings.guardianEnabled) {
    return { block: false, reason: '' };
  }

  // Check blocked tags first
  const matchedBlockedTags = analysis.tags.filter(tag =>
    settings.blockedTags.some(blocked => tag.toLowerCase().includes(blocked.toLowerCase()))
  );

  if (matchedBlockedTags.length > 0) {
    return {
      block: true,
      reason: 'blocked_tags',
      blockedTags: matchedBlockedTags,
    };
  }

  // Check focus schedule
  const focusSchedule = await getFocusSchedule();
  const inFocusPeriod = isInFocusPeriod(focusSchedule);

  // Determine threshold to use
  const threshold = inFocusPeriod ? focusSchedule.focusThreshold : settings.minScoreThreshold;

  // Check if all scores are below threshold
  const { productivity, educational, entertainment } = analysis.scores;
  const allBelowThreshold =
    productivity < threshold &&
    educational < threshold &&
    entertainment < threshold;

  if (allBelowThreshold) {
    return {
      block: true,
      reason: 'low_scores',
      focusMode: inFocusPeriod,
    };
  }

  // Focus mode: block entertainment-dominant videos
  if (inFocusPeriod && focusSchedule.blockEntertainment) {
    const isEntertainmentDominant = entertainment > productivity && entertainment > educational;
    if (isEntertainmentDominant && entertainment >= 60) {
      return {
        block: true,
        reason: 'focus_entertainment',
        focusMode: true,
      };
    }
  }

  return { block: false, reason: '', focusMode: inFocusPeriod };
}

export async function isFocusModeActive(): Promise<boolean> {
  const focusSchedule = await getFocusSchedule();
  return isInFocusPeriod(focusSchedule);
}

export function removeGuardian(): void {
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  document.getElementById(GUARDIAN_ID)?.remove();
}

export function showGuardian(
  analysis: VideoAnalysis,
  settings: Settings,
  blockInfo: { reason: string; blockedTags?: string[] },
  onWatchAnyway: () => void,
  onSkip: () => void
): void {
  removeGuardian();

  const overlay = document.createElement('div');
  overlay.id = GUARDIAN_ID;
  overlay.className = 'vp-guardian-overlay';

  const content = document.createElement('div');
  content.className = 'vp-guardian-content';

  // Icon
  const icon = document.createElement('div');
  icon.className = 'vp-guardian-icon';
  icon.textContent = '\u26A0'; // Warning symbol
  content.appendChild(icon);

  // Title
  const title = document.createElement('h2');
  title.className = 'vp-guardian-title';
  title.textContent = 'This might not be worth your time';
  content.appendChild(title);

  // Message
  const message = document.createElement('p');
  message.className = 'vp-guardian-message';
  if (blockInfo.reason === 'blocked_tags') {
    message.textContent = 'This video contains content you asked to be warned about.';
  } else if (blockInfo.reason === 'focus_entertainment') {
    message.textContent = 'Focus mode is blocking entertainment content.';
  } else {
    message.textContent = 'This video scored below your minimum threshold in all categories.';
  }
  content.appendChild(message);

  // Reason box
  const reasonBox = document.createElement('div');
  reasonBox.className = 'vp-guardian-reason';

  const reasonTitle = document.createElement('div');
  reasonTitle.className = 'vp-guardian-reason-title';
  if (blockInfo.reason === 'blocked_tags') {
    reasonTitle.textContent = 'Matched Tags';
  } else if (blockInfo.reason === 'focus_entertainment') {
    reasonTitle.textContent = 'Focus Mode Active';
  } else {
    reasonTitle.textContent = 'Scores';
  }
  reasonBox.appendChild(reasonTitle);

  if (blockInfo.reason === 'blocked_tags' && blockInfo.blockedTags) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'vp-guardian-blocked-tags';
    tagsEl.textContent = blockInfo.blockedTags.join(', ');
    reasonBox.appendChild(tagsEl);
  } else if (blockInfo.reason === 'focus_entertainment') {
    const focusMsg = document.createElement('div');
    focusMsg.className = 'vp-guardian-focus-msg';
    focusMsg.textContent = 'Entertainment content is restricted during focus hours. This video is primarily entertainment.';
    reasonBox.appendChild(focusMsg);
  } else {
    const scoresEl = document.createElement('div');
    scoresEl.className = 'vp-guardian-scores';

    const scores = [
      { label: 'Productive', value: analysis.scores.productivity },
      { label: 'Educational', value: analysis.scores.educational },
      { label: 'Entertainment', value: analysis.scores.entertainment },
    ];

    for (const score of scores) {
      const scoreEl = document.createElement('div');
      scoreEl.className = 'vp-guardian-score';

      const valueEl = document.createElement('div');
      valueEl.className = `vp-guardian-score-value ${getScoreLevel(score.value)}`;
      valueEl.textContent = String(score.value);

      const labelEl = document.createElement('div');
      labelEl.className = 'vp-guardian-score-label';
      labelEl.textContent = score.label;

      scoreEl.appendChild(valueEl);
      scoreEl.appendChild(labelEl);
      scoresEl.appendChild(scoreEl);
    }

    reasonBox.appendChild(scoresEl);
  }

  content.appendChild(reasonBox);

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'vp-guardian-buttons';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'vp-guardian-btn vp-guardian-btn-skip';
  skipBtn.textContent = 'Go Back';
  skipBtn.onclick = () => {
    removeGuardian();
    onSkip();
  };

  const watchBtn = document.createElement('button');
  watchBtn.className = 'vp-guardian-btn vp-guardian-btn-watch';
  watchBtn.textContent = 'Watch Anyway';
  watchBtn.onclick = async () => {
    await trackOverride();
    removeGuardian();
    onWatchAnyway();
  };

  buttons.appendChild(skipBtn);
  buttons.appendChild(watchBtn);
  content.appendChild(buttons);

  // Hint
  const hint = document.createElement('p');
  hint.className = 'vp-guardian-hint';
  hint.textContent = 'Press Esc to dismiss';
  content.appendChild(hint);

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // Keyboard handler
  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeGuardian();
      onWatchAnyway();
    }
  };
  document.addEventListener('keydown', keydownHandler);
}
