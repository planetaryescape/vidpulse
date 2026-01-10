import { getSettings, saveSettings, getMemories, removeMemory, clearMemories, getAllDailyStats, getChannelStats, getFocusSchedule, saveFocusSchedule, getAllNotesIndex, getNotesForVideo, deleteNote, deleteAllNotesForVideo } from '../shared/storage';
import { exportNotesForVideo, exportAllNotes } from '../shared/export';
import type { Settings, GeminiModel, MemoryEntry, DailyStats, FocusSchedule, NotesIndex, VideoNote, LikedChannel } from '../shared/types';

// DOM elements - API Config
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const braveApiKeyInput = document.getElementById('braveApiKey') as HTMLInputElement;
const cacheExpiryInput = document.getElementById('cacheExpiry') as HTMLInputElement;
const saveApiBtn = document.getElementById('saveApiBtn') as HTMLButtonElement;
const apiStatusEl = document.getElementById('apiStatus') as HTMLDivElement;

// DOM elements - Model selectors
const modelVideoReadingSelect = document.getElementById('modelVideoReading') as HTMLSelectElement;
const modelSummarizationSelect = document.getElementById('modelSummarization') as HTMLSelectElement;
const modelReasoningSelect = document.getElementById('modelReasoning') as HTMLSelectElement;
const modelTagsSelect = document.getElementById('modelTags') as HTMLSelectElement;
const modelAnalysisSelect = document.getElementById('modelAnalysis') as HTMLSelectElement;
const modelMemorySelect = document.getElementById('modelMemory') as HTMLSelectElement;
const saveModelsBtn = document.getElementById('saveModelsBtn') as HTMLButtonElement;
const modelsStatusEl = document.getElementById('modelsStatus') as HTMLDivElement;

// DOM elements - Personalization
const aboutMeTextarea = document.getElementById('aboutMe') as HTMLTextAreaElement;
const aboutMeStatusEl = document.getElementById('aboutMeStatus') as HTMLDivElement;
const savePersonalizationBtn = document.getElementById('savePersonalization') as HTMLButtonElement;
const resetAutoSyncBtn = document.getElementById('resetAutoSync') as HTMLButtonElement;
const personalizationStatusEl = document.getElementById('personalizationStatus') as HTMLDivElement;

// DOM elements - Memory management
const memoryCountEl = document.getElementById('memoryCount') as HTMLDivElement;
const memoryListEl = document.getElementById('memoryList') as HTMLDivElement;
const refreshMemoriesBtn = document.getElementById('refreshMemories') as HTMLButtonElement;
const condenseMemoriesBtn = document.getElementById('condenseMemories') as HTMLButtonElement;
const clearMemoriesBtn = document.getElementById('clearMemories') as HTMLButtonElement;
const memoryStatusEl = document.getElementById('memoryStatus') as HTMLDivElement;

// DOM elements - Liked Channels
const likedChannelsCountEl = document.getElementById('likedChannelsCount') as HTMLDivElement;
const likedChannelsListEl = document.getElementById('likedChannelsList') as HTMLDivElement;
const refreshLikedChannelsBtn = document.getElementById('refreshLikedChannels') as HTMLButtonElement;
const likedChannelsStatusEl = document.getElementById('likedChannelsStatus') as HTMLDivElement;

// DOM elements - Guardian
const guardianEnabledCheckbox = document.getElementById('guardianEnabled') as HTMLInputElement;
const minScoreThresholdInput = document.getElementById('minScoreThreshold') as HTMLInputElement;
const blockedTagsInput = document.getElementById('blockedTags') as HTMLInputElement;
const saveGuardianBtn = document.getElementById('saveGuardian') as HTMLButtonElement;
const guardianStatusEl = document.getElementById('guardianStatus') as HTMLDivElement;

// DOM elements - Check-in
const checkInEnabledCheckbox = document.getElementById('checkInEnabled') as HTMLInputElement;
const checkInIntervalSelect = document.getElementById('checkInInterval') as HTMLSelectElement;
const saveCheckInBtn = document.getElementById('saveCheckIn') as HTMLButtonElement;
const checkInStatusEl = document.getElementById('checkInStatus') as HTMLDivElement;

// DOM elements - Digest
const digestContentEl = document.getElementById('digestContent') as HTMLDivElement;

// DOM elements - Notes
const notesSearchInput = document.getElementById('notesSearch') as HTMLInputElement;
const notesVideoListEl = document.getElementById('notesVideoList') as HTMLDivElement;
const notesDetailEl = document.getElementById('notesDetail') as HTMLDivElement;
const refreshNotesBtn = document.getElementById('refreshNotes') as HTMLButtonElement;
const exportAllNotesBtn = document.getElementById('exportAllNotes') as HTMLButtonElement;
const notesStatusEl = document.getElementById('notesStatus') as HTMLDivElement;

// DOM elements - Focus Schedule
const focusEnabledCheckbox = document.getElementById('focusEnabled') as HTMLInputElement;
const focusDay0Checkbox = document.getElementById('focusDay0') as HTMLInputElement;
const focusDay1Checkbox = document.getElementById('focusDay1') as HTMLInputElement;
const focusDay2Checkbox = document.getElementById('focusDay2') as HTMLInputElement;
const focusDay3Checkbox = document.getElementById('focusDay3') as HTMLInputElement;
const focusDay4Checkbox = document.getElementById('focusDay4') as HTMLInputElement;
const focusDay5Checkbox = document.getElementById('focusDay5') as HTMLInputElement;
const focusDay6Checkbox = document.getElementById('focusDay6') as HTMLInputElement;
const focusStartHourSelect = document.getElementById('focusStartHour') as HTMLSelectElement;
const focusEndHourSelect = document.getElementById('focusEndHour') as HTMLSelectElement;
const focusThresholdInput = document.getElementById('focusThreshold') as HTMLInputElement;
const focusBlockEntertainmentCheckbox = document.getElementById('focusBlockEntertainment') as HTMLInputElement;
const saveFocusBtn = document.getElementById('saveFocus') as HTMLButtonElement;
const focusStatusEl = document.getElementById('focusStatus') as HTMLDivElement;

// Tab navigation
const TAB_IDS = ['api', 'personalization', 'productivity', 'insights'] as const;
type TabId = typeof TAB_IDS[number];

function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-nav [role="tab"]');
  const panels = document.querySelectorAll<HTMLDivElement>('[role="tabpanel"]');

  function switchTab(tabId: TabId): void {
    tabs.forEach(tab => {
      const isSelected = tab.id === `tab-${tabId}`;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== `panel-${tabId}`;
    });
    history.replaceState(null, '', `#${tabId}`);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.id.replace('tab-', '') as TabId);
    });
  });

  // Keyboard navigation: Up/Down arrows
  tabs.forEach(tab => {
    tab.addEventListener('keydown', (e) => {
      const idx = TAB_IDS.indexOf(tab.id.replace('tab-', '') as TabId);
      let newIdx = idx;
      if (e.key === 'ArrowDown') { newIdx = (idx + 1) % TAB_IDS.length; e.preventDefault(); }
      if (e.key === 'ArrowUp') { newIdx = (idx - 1 + TAB_IDS.length) % TAB_IDS.length; e.preventDefault(); }
      if (newIdx !== idx) {
        switchTab(TAB_IDS[newIdx]);
        (tabs[newIdx] as HTMLButtonElement).focus();
      }
    });
  });

  // Handle URL hash on load
  const hash = window.location.hash.slice(1) as TabId;
  if (TAB_IDS.includes(hash)) {
    switchTab(hash);
  }
}

function showStatus(element: HTMLElement, message: string, type: 'success' | 'error'): void {
  element.textContent = message;
  element.className = `status ${type}`;

  setTimeout(() => {
    element.className = 'status';
  }, 3000);
}

function clearElement(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function updateAboutMeStatus(autoGenerated: boolean, syncing = false): void {
  clearElement(aboutMeStatusEl);
  if (syncing) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    aboutMeStatusEl.appendChild(spinner);
    aboutMeStatusEl.appendChild(document.createTextNode(' Syncing with memories...'));
    aboutMeStatusEl.className = 'about-me-status syncing';
  } else if (autoGenerated) {
    aboutMeStatusEl.textContent = '(auto-synced with memories)';
    aboutMeStatusEl.className = 'about-me-status auto';
  } else {
    aboutMeStatusEl.textContent = '(manually edited)';
    aboutMeStatusEl.className = 'about-me-status manual';
  }
}

async function renderMemories(): Promise<void> {
  const memories = await getMemories();

  // Update count
  memoryCountEl.textContent = `${memories.length} preference${memories.length !== 1 ? 's' : ''} learned`;

  // Clear list
  clearElement(memoryListEl);

  if (memories.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'memory-empty';
    empty.textContent = "No preferences learned yet. Like or dislike videos to teach VidPulse your taste!";
    memoryListEl.appendChild(empty);
    return;
  }

  // Sort by most recent first (use updatedAt if available, otherwise createdAt)
  const sorted = [...memories].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  for (const memory of sorted) {
    const item = document.createElement('div');
    item.className = 'memory-item';

    const content = document.createElement('div');
    content.className = 'memory-content';

    const type = document.createElement('span');
    type.className = `memory-type ${memory.type}`;
    type.textContent = memory.type.toUpperCase();

    const preference = document.createElement('div');
    preference.className = 'memory-preference';
    preference.textContent = memory.preference;

    const source = document.createElement('div');
    source.className = 'memory-source';

    // Handle multi-source memories
    if (memory.sources && memory.sources.length > 0) {
      if (memory.sources.length === 1) {
        // Single source - simple display
        const s = memory.sources[0];
        let url = `https://www.youtube.com/watch?v=${s.videoId}`;
        if (s.timestamp) url += `&t=${s.timestamp}s`;
        const sourceText = document.createTextNode('From: ');
        const sourceLink = document.createElement('a');
        sourceLink.href = url;
        sourceLink.textContent = s.videoTitle;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        source.appendChild(sourceText);
        source.appendChild(sourceLink);
      } else {
        // Multiple sources - expandable
        const toggle = document.createElement('button');
        toggle.className = 'memory-sources-toggle';
        toggle.textContent = `From ${memory.sources.length} videos`;

        const list = document.createElement('div');
        list.className = 'memory-sources-list hidden';

        for (const s of memory.sources) {
          let url = `https://www.youtube.com/watch?v=${s.videoId}`;
          if (s.timestamp) url += `&t=${s.timestamp}s`;
          const link = document.createElement('a');
          link.href = url;
          link.textContent = s.videoTitle;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          list.appendChild(link);
        }

        toggle.addEventListener('click', () => {
          list.classList.toggle('hidden');
          toggle.textContent = list.classList.contains('hidden')
            ? `From ${memory.sources.length} videos`
            : 'Hide videos';
        });

        source.appendChild(toggle);
        source.appendChild(list);
      }
    } else if (memory.sourceVideoId) {
      // Legacy: single source fields (fallback for old data)
      let url = `https://www.youtube.com/watch?v=${memory.sourceVideoId}`;
      if (memory.sourceTimestamp) url += `&t=${memory.sourceTimestamp}s`;
      const sourceText = document.createTextNode('From: ');
      const sourceLink = document.createElement('a');
      sourceLink.href = url;
      sourceLink.textContent = memory.sourceVideoTitle || 'Unknown video';
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      source.appendChild(sourceText);
      source.appendChild(sourceLink);
    }

    content.appendChild(type);
    content.appendChild(preference);
    content.appendChild(source);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'memory-delete';
    deleteBtn.setAttribute('type', 'button');
    deleteBtn.textContent = '\u00D7'; // × symbol
    deleteBtn.title = 'Remove this preference';
    deleteBtn.addEventListener('click', async () => {
      await removeMemory(memory.id);
      renderMemories();
      showStatus(memoryStatusEl, 'Preference removed', 'success');
    });

    item.appendChild(content);
    item.appendChild(deleteBtn);
    memoryListEl.appendChild(item);
  }
}

async function renderLikedChannels(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_LIKED_CHANNELS' });
    const channels: LikedChannel[] = response.channels || [];

    likedChannelsCountEl.textContent = `${channels.length} channel${channels.length !== 1 ? 's' : ''}`;
    clearElement(likedChannelsListEl);

    if (channels.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'memory-empty';
      empty.textContent = 'No liked channels yet. Like videos to track channels!';
      likedChannelsListEl.appendChild(empty);
      return;
    }

    for (const channel of channels) {
      const item = document.createElement('div');
      item.className = 'liked-channel-item';

      const content = document.createElement('div');
      content.className = 'liked-channel-content';

      const nameRow = document.createElement('div');
      nameRow.className = 'liked-channel-name';
      const nameLink = document.createElement('a');
      nameLink.href = channel.channelUrl;
      nameLink.target = '_blank';
      nameLink.rel = 'noopener';
      nameLink.textContent = channel.channelName;
      nameRow.appendChild(nameLink);

      // Subscription badge
      if (channel.subscriptionStatus && channel.subscriptionStatus !== 'unknown') {
        const badge = document.createElement('span');
        badge.className = `subscription-badge ${channel.subscriptionStatus === 'subscribed' ? 'subscribed' : 'not-subscribed'}`;
        badge.textContent = channel.subscriptionStatus === 'subscribed' ? 'Subscribed' : 'Not Subscribed';
        nameRow.appendChild(badge);
      }

      const stats = document.createElement('div');
      stats.className = 'liked-channel-stats';
      stats.textContent = `${channel.likedVideoIds.length} liked video${channel.likedVideoIds.length !== 1 ? 's' : ''}`;
      if (channel.avgScores) {
        const avg = Math.round((channel.avgScores.productivity + channel.avgScores.educational + channel.avgScores.entertainment) / 3);
        stats.textContent += ` · Avg score: ${avg}`;
      }

      const videos = document.createElement('div');
      videos.className = 'liked-channel-videos';
      videos.textContent = channel.likedVideoTitles.slice(0, 3).join(', ');
      if (channel.likedVideoTitles.length > 3) {
        videos.textContent += `, +${channel.likedVideoTitles.length - 3} more`;
      }

      content.appendChild(nameRow);
      content.appendChild(stats);
      content.appendChild(videos);

      const forgetBtn = document.createElement('button');
      forgetBtn.className = 'liked-channel-forget';
      forgetBtn.textContent = '\u00D7';
      forgetBtn.title = 'Forget this channel';
      forgetBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'REMOVE_LIKED_CHANNEL', channelId: channel.channelId });
        renderLikedChannels();
        showStatus(likedChannelsStatusEl, 'Channel removed', 'success');
      });

      item.appendChild(content);
      item.appendChild(forgetBtn);
      likedChannelsListEl.appendChild(item);
    }
  } catch (error) {
    console.error('Failed to render liked channels:', error);
    showStatus(likedChannelsStatusEl, 'Failed to load channels', 'error');
  }
}

async function loadSettings(): Promise<void> {
  const settings = await getSettings();

  // API Config
  apiKeyInput.value = settings.apiKey || '';
  braveApiKeyInput.value = settings.braveApiKey || '';
  cacheExpiryInput.value = String(settings.cacheExpiry || 365);

  // Model selectors
  modelVideoReadingSelect.value = settings.models.videoReading;
  modelSummarizationSelect.value = settings.models.summarization;
  modelReasoningSelect.value = settings.models.recommendationReasoning;
  modelTagsSelect.value = settings.models.tagGeneration;
  modelAnalysisSelect.value = settings.models.transcriptAnalysis;
  modelMemorySelect.value = settings.models.memoryExtraction;

  // Personalization
  aboutMeTextarea.value = settings.aboutMe || '';
  updateAboutMeStatus(settings.aboutMeAutoGenerated ?? false);

  // Guardian
  guardianEnabledCheckbox.checked = settings.guardianEnabled || false;
  minScoreThresholdInput.value = String(settings.minScoreThreshold || 40);
  blockedTagsInput.value = (settings.blockedTags || []).join(', ');

  // Check-in
  checkInEnabledCheckbox.checked = settings.checkInEnabled || false;
  checkInIntervalSelect.value = String(settings.checkInInterval || 30);

  // Focus Schedule
  const focusSchedule = await getFocusSchedule();
  focusEnabledCheckbox.checked = focusSchedule.enabled;
  const days = focusSchedule.periods[0]?.days || [1, 2, 3, 4, 5];
  focusDay0Checkbox.checked = days.includes(0);
  focusDay1Checkbox.checked = days.includes(1);
  focusDay2Checkbox.checked = days.includes(2);
  focusDay3Checkbox.checked = days.includes(3);
  focusDay4Checkbox.checked = days.includes(4);
  focusDay5Checkbox.checked = days.includes(5);
  focusDay6Checkbox.checked = days.includes(6);
  focusStartHourSelect.value = String(focusSchedule.periods[0]?.startHour || 9);
  focusEndHourSelect.value = String(focusSchedule.periods[0]?.endHour || 17);
  focusThresholdInput.value = String(focusSchedule.focusThreshold || 60);
  focusBlockEntertainmentCheckbox.checked = focusSchedule.blockEntertainment ?? true;

  // Memories
  renderMemories();

  // Liked Channels
  renderLikedChannels();

  // Digest
  renderDigest();
}

async function handleSaveApiConfig(): Promise<void> {
  const apiKey = apiKeyInput.value.trim();
  const braveApiKey = braveApiKeyInput.value.trim();
  const cacheExpiry = parseInt(cacheExpiryInput.value, 10) || 365;

  if (!apiKey) {
    showStatus(apiStatusEl, 'API key is required', 'error');
    return;
  }

  if (cacheExpiry < 1 || cacheExpiry > 365) {
    showStatus(apiStatusEl, 'Cache duration must be between 1 and 365 days', 'error');
    return;
  }

  // Validate API key before saving
  saveApiBtn.disabled = true;
  apiStatusEl.textContent = 'Validating API key...';
  apiStatusEl.className = 'status';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'VALIDATE_API_KEY', apiKey });
    if (!response.valid) {
      showStatus(apiStatusEl, response.error || 'Invalid API key', 'error');
      saveApiBtn.disabled = false;
      return;
    }

    await saveSettings({ apiKey, braveApiKey, cacheExpiry });
    showStatus(apiStatusEl, 'API settings saved!', 'success');
  } catch (error) {
    showStatus(apiStatusEl, 'Failed to validate API key', 'error');
    console.error('Save error:', error);
  } finally {
    saveApiBtn.disabled = false;
  }
}

async function handleSaveModels(): Promise<void> {
  const models = {
    videoReading: modelVideoReadingSelect.value as GeminiModel,
    summarization: modelSummarizationSelect.value as GeminiModel,
    recommendationReasoning: modelReasoningSelect.value as GeminiModel,
    tagGeneration: modelTagsSelect.value as GeminiModel,
    transcriptAnalysis: modelAnalysisSelect.value as GeminiModel,
    memoryExtraction: modelMemorySelect.value as GeminiModel,
  };

  try {
    await saveSettings({ models });
    showStatus(modelsStatusEl, 'Model settings saved!', 'success');
  } catch (error) {
    showStatus(modelsStatusEl, 'Failed to save', 'error');
    console.error('Save error:', error);
  }
}

async function handleSavePersonalization(): Promise<void> {
  const aboutMe = aboutMeTextarea.value.trim();

  try {
    // Manual edit: save both aboutMe and manualPreferences, set flag to false
    await saveSettings({
      aboutMe,
      manualPreferences: aboutMe,
      aboutMeAutoGenerated: false,
    });
    updateAboutMeStatus(false);
    showStatus(personalizationStatusEl, 'Personalization saved!', 'success');
  } catch (error) {
    showStatus(personalizationStatusEl, 'Failed to save', 'error');
    console.error('Save error:', error);
  }
}

async function handleResetAutoSync(): Promise<void> {
  updateAboutMeStatus(false, true); // Show syncing state
  resetAutoSyncBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'REGENERATE_ABOUT_ME' });
    if (response.success) {
      aboutMeTextarea.value = response.aboutMe || '';
      updateAboutMeStatus(true);
      showStatus(personalizationStatusEl, 'Synced with memories', 'success');
    } else {
      updateAboutMeStatus(false);
      showStatus(personalizationStatusEl, response.error || 'Sync failed', 'error');
    }
  } catch (error) {
    updateAboutMeStatus(false);
    showStatus(personalizationStatusEl, 'Failed to sync', 'error');
    console.error('Reset auto sync error:', error);
  } finally {
    resetAutoSyncBtn.disabled = false;
  }
}

async function handleClearMemories(): Promise<void> {
  if (!confirm('Are you sure you want to clear all learned preferences? This cannot be undone.')) {
    return;
  }

  try {
    await clearMemories();
    renderMemories();
    showStatus(memoryStatusEl, 'All preferences cleared', 'success');
  } catch (error) {
    showStatus(memoryStatusEl, 'Failed to clear', 'error');
    console.error('Clear error:', error);
  }
}

async function handleCondenseMemories(): Promise<void> {
  if (!confirm('This will merge similar preferences. Continue?')) {
    return;
  }

  condenseMemoriesBtn.disabled = true;
  condenseMemoriesBtn.textContent = 'Condensing...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONDENSE_MEMORIES' });

    if (response.success) {
      const reduced = (response.before || 0) - (response.after || 0);
      if (reduced > 0) {
        showStatus(memoryStatusEl, `Condensed ${response.before} → ${response.after} (${reduced} merged)`, 'success');
      } else {
        showStatus(memoryStatusEl, 'No similar preferences found to merge', 'success');
      }
      renderMemories();
    } else {
      showStatus(memoryStatusEl, response.error || 'Failed to condense', 'error');
    }
  } catch (error) {
    showStatus(memoryStatusEl, 'Failed to condense', 'error');
    console.error('Condense error:', error);
  } finally {
    condenseMemoriesBtn.disabled = false;
    condenseMemoriesBtn.textContent = 'Condense Similar';
  }
}

async function handleSaveGuardian(): Promise<void> {
  const guardianEnabled = guardianEnabledCheckbox.checked;
  const minScoreThreshold = parseInt(minScoreThresholdInput.value, 10) || 40;
  const blockedTagsRaw = blockedTagsInput.value.trim();
  const blockedTags = blockedTagsRaw
    ? blockedTagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : [];

  if (minScoreThreshold < 0 || minScoreThreshold > 100) {
    showStatus(guardianStatusEl, 'Threshold must be 0-100', 'error');
    return;
  }

  try {
    await saveSettings({ guardianEnabled, minScoreThreshold, blockedTags });
    showStatus(guardianStatusEl, 'Guardian settings saved!', 'success');
  } catch (error) {
    showStatus(guardianStatusEl, 'Failed to save', 'error');
    console.error('Save error:', error);
  }
}

async function handleSaveCheckIn(): Promise<void> {
  const checkInEnabled = checkInEnabledCheckbox.checked;
  const checkInInterval = parseInt(checkInIntervalSelect.value, 10) || 30;

  try {
    await saveSettings({ checkInEnabled, checkInInterval });
    showStatus(checkInStatusEl, 'Check-in settings saved!', 'success');
  } catch (error) {
    showStatus(checkInStatusEl, 'Failed to save', 'error');
    console.error('Save error:', error);
  }
}

async function handleSaveFocus(): Promise<void> {
  const enabled = focusEnabledCheckbox.checked;
  const focusThreshold = parseInt(focusThresholdInput.value, 10) || 60;
  const blockEntertainment = focusBlockEntertainmentCheckbox.checked;

  // Collect selected days
  const days: number[] = [];
  if (focusDay0Checkbox.checked) days.push(0);
  if (focusDay1Checkbox.checked) days.push(1);
  if (focusDay2Checkbox.checked) days.push(2);
  if (focusDay3Checkbox.checked) days.push(3);
  if (focusDay4Checkbox.checked) days.push(4);
  if (focusDay5Checkbox.checked) days.push(5);
  if (focusDay6Checkbox.checked) days.push(6);

  const startHour = parseInt(focusStartHourSelect.value, 10);
  const endHour = parseInt(focusEndHourSelect.value, 10);

  if (focusThreshold < 0 || focusThreshold > 100) {
    showStatus(focusStatusEl, 'Threshold must be 0-100', 'error');
    return;
  }

  if (startHour >= endHour) {
    showStatus(focusStatusEl, 'Start hour must be before end hour', 'error');
    return;
  }

  try {
    await saveFocusSchedule({
      enabled,
      periods: [{ days, startHour, endHour }],
      focusThreshold,
      blockEntertainment,
    });
    showStatus(focusStatusEl, 'Focus settings saved!', 'success');
  } catch (error) {
    showStatus(focusStatusEl, 'Failed to save', 'error');
    console.error('Save error:', error);
  }
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function renderDigest(): Promise<void> {
  clearElement(digestContentEl);

  const allStatsRecord = await getAllDailyStats();
  const allStats = Object.values(allStatsRecord);

  if (allStats.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'digest-empty';
    empty.textContent = 'No watch data yet. Start watching YouTube with VidPulse to see your stats!';
    digestContentEl.appendChild(empty);
    return;
  }

  // Sort by date descending
  const sorted = allStats.sort((a, b) => b.date.localeCompare(a.date));

  // Calculate weekly totals (last 7 days)
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const weeklyStats = sorted.filter(s => s.date >= weekAgoStr);
  const weeklyTime = weeklyStats.reduce((sum, s) => sum + s.totalTime, 0);
  const weeklyVideos = weeklyStats.reduce((sum, s) => sum + s.videoCount, 0);
  const weeklyEducational = weeklyStats.reduce((sum, s) => sum + s.byCategory.educational.count, 0);
  const weeklyEntertainment = weeklyStats.reduce((sum, s) => sum + s.byCategory.entertainment.count, 0);
  const weeklyProductive = weeklyStats.reduce((sum, s) => sum + s.byCategory.productive.count, 0);
  const weeklyInspiring = weeklyStats.reduce((sum, s) => sum + s.byCategory.inspiring.count, 0);
  const weeklyCreative = weeklyStats.reduce((sum, s) => sum + s.byCategory.creative.count, 0);

  // Weekly summary section
  const weeklySummary = document.createElement('div');
  weeklySummary.className = 'digest-weekly';

  const weeklyTitle = document.createElement('h4');
  weeklyTitle.textContent = 'Last 7 Days';
  weeklySummary.appendChild(weeklyTitle);

  const weeklyGrid = document.createElement('div');
  weeklyGrid.className = 'digest-grid';

  const timeBlock = document.createElement('div');
  timeBlock.className = 'digest-stat';
  const timeValue = document.createElement('span');
  timeValue.className = 'digest-value';
  timeValue.textContent = formatTime(weeklyTime);
  const timeLabel = document.createElement('span');
  timeLabel.className = 'digest-label';
  timeLabel.textContent = 'Total time';
  timeBlock.appendChild(timeValue);
  timeBlock.appendChild(timeLabel);

  const videosBlock = document.createElement('div');
  videosBlock.className = 'digest-stat';
  const videosValue = document.createElement('span');
  videosValue.className = 'digest-value';
  videosValue.textContent = String(weeklyVideos);
  const videosLabel = document.createElement('span');
  videosLabel.className = 'digest-label';
  videosLabel.textContent = 'Videos';
  videosBlock.appendChild(videosValue);
  videosBlock.appendChild(videosLabel);

  weeklyGrid.appendChild(timeBlock);
  weeklyGrid.appendChild(videosBlock);
  weeklySummary.appendChild(weeklyGrid);

  // Category breakdown
  const categoryBreakdown = document.createElement('div');
  categoryBreakdown.className = 'digest-categories';

  if (weeklyEducational > 0) {
    const eduCat = document.createElement('span');
    eduCat.className = 'digest-category educational';
    eduCat.textContent = `${weeklyEducational} educational`;
    categoryBreakdown.appendChild(eduCat);
  }
  if (weeklyEntertainment > 0) {
    const entCat = document.createElement('span');
    entCat.className = 'digest-category entertainment';
    entCat.textContent = `${weeklyEntertainment} entertainment`;
    categoryBreakdown.appendChild(entCat);
  }
  if (weeklyProductive > 0) {
    const prodCat = document.createElement('span');
    prodCat.className = 'digest-category productive';
    prodCat.textContent = `${weeklyProductive} productive`;
    categoryBreakdown.appendChild(prodCat);
  }
  if (weeklyInspiring > 0) {
    const inspCat = document.createElement('span');
    inspCat.className = 'digest-category inspiring';
    inspCat.textContent = `${weeklyInspiring} inspiring`;
    categoryBreakdown.appendChild(inspCat);
  }
  if (weeklyCreative > 0) {
    const creativeCat = document.createElement('span');
    creativeCat.className = 'digest-category creative';
    creativeCat.textContent = `${weeklyCreative} creative`;
    categoryBreakdown.appendChild(creativeCat);
  }

  weeklySummary.appendChild(categoryBreakdown);
  digestContentEl.appendChild(weeklySummary);

  // Daily breakdown (last 7 days)
  const dailySection = document.createElement('div');
  dailySection.className = 'digest-daily';

  const dailyTitle = document.createElement('h4');
  dailyTitle.textContent = 'Daily Breakdown';
  dailySection.appendChild(dailyTitle);

  const dailyList = document.createElement('div');
  dailyList.className = 'digest-day-list';

  for (const day of weeklyStats.slice(0, 7)) {
    const dayRow = document.createElement('div');
    dayRow.className = 'digest-day';

    const dayDate = document.createElement('span');
    dayDate.className = 'digest-day-date';
    dayDate.textContent = formatDate(day.date);

    const dayStats = document.createElement('span');
    dayStats.className = 'digest-day-stats';
    dayStats.textContent = `${formatTime(day.totalTime)} · ${day.videoCount} video${day.videoCount !== 1 ? 's' : ''}`;

    dayRow.appendChild(dayDate);
    dayRow.appendChild(dayStats);
    dailyList.appendChild(dayRow);
  }

  dailySection.appendChild(dailyList);
  digestContentEl.appendChild(dailySection);
}

// Notes state
let allNotesIndex: NotesIndex[] = [];
let selectedVideoId: string | null = null;

async function renderNotesVideoList(searchTerm = ''): Promise<void> {
  allNotesIndex = await getAllNotesIndex();

  clearElement(notesVideoListEl);

  const filtered = searchTerm
    ? allNotesIndex.filter(n =>
        n.videoTitle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allNotesIndex;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notes-empty';
    empty.textContent = searchTerm ? 'No matching videos' : 'No notes yet';
    notesVideoListEl.appendChild(empty);
    return;
  }

  for (const index of filtered) {
    const item = document.createElement('div');
    item.className = 'notes-video-item' + (selectedVideoId === index.videoId ? ' active' : '');
    item.dataset.videoId = index.videoId;

    const title = document.createElement('div');
    title.className = 'notes-video-title';
    title.textContent = index.videoTitle;
    title.title = index.videoTitle;

    const count = document.createElement('div');
    count.className = 'notes-video-count';
    count.textContent = `${index.noteCount} note${index.noteCount !== 1 ? 's' : ''}`;

    item.appendChild(title);
    item.appendChild(count);

    item.addEventListener('click', () => {
      selectedVideoId = index.videoId;
      renderNotesVideoList(notesSearchInput.value);
      renderNotesDetail(index.videoId, index.videoTitle, index.videoUrl);
    });

    notesVideoListEl.appendChild(item);
  }
}

async function renderNotesDetail(videoId: string, videoTitle: string, videoUrl: string): Promise<void> {
  clearElement(notesDetailEl);

  const notes = await getNotesForVideo(videoId);

  // Header
  const header = document.createElement('div');
  header.className = 'notes-detail-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'notes-detail-title';
  const titleLink = document.createElement('a');
  titleLink.href = videoUrl;
  titleLink.target = '_blank';
  titleLink.rel = 'noopener';
  titleLink.textContent = videoTitle;
  titleEl.appendChild(titleLink);

  const actions = document.createElement('div');
  actions.className = 'notes-detail-actions';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'secondary';
  exportBtn.textContent = 'Export';
  exportBtn.addEventListener('click', async () => {
    await exportNotesForVideo(videoId);
    showStatus(notesStatusEl, 'Notes exported', 'success');
  });

  const deleteAllBtn = document.createElement('button');
  deleteAllBtn.className = 'danger';
  deleteAllBtn.textContent = 'Delete All';
  deleteAllBtn.addEventListener('click', async () => {
    if (confirm(`Delete all notes for "${videoTitle}"?`)) {
      await deleteAllNotesForVideo(videoId);
      selectedVideoId = null;
      await renderNotesVideoList(notesSearchInput.value);
      clearElement(notesDetailEl);
      const empty = document.createElement('p');
      empty.className = 'notes-empty-detail';
      empty.textContent = 'Select a video to view notes';
      notesDetailEl.appendChild(empty);
      showStatus(notesStatusEl, 'Notes deleted', 'success');
    }
  });

  actions.appendChild(exportBtn);
  actions.appendChild(deleteAllBtn);

  header.appendChild(titleEl);
  header.appendChild(actions);
  notesDetailEl.appendChild(header);

  // Notes list
  const notesList = document.createElement('div');
  notesList.className = 'notes-list';

  for (const note of notes) {
    const card = document.createElement('div');
    card.className = 'note-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'note-card-header';

    const timestamp = document.createElement('button');
    timestamp.className = 'note-timestamp';
    timestamp.textContent = note.timestampFormatted;
    timestamp.title = `Open video at ${note.timestampFormatted}`;
    timestamp.addEventListener('click', () => {
      const url = `${videoUrl}&t=${Math.floor(note.timestamp)}`;
      window.open(url, '_blank');
    });

    cardHeader.appendChild(timestamp);
    card.appendChild(cardHeader);

    if (note.content) {
      const content = document.createElement('div');
      content.className = 'note-card-content';
      content.textContent = note.content;
      card.appendChild(content);
    }

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    meta.textContent = new Date(note.createdAt).toLocaleDateString();
    card.appendChild(meta);

    notesList.appendChild(card);
  }

  notesDetailEl.appendChild(notesList);
}

async function renderNotes(): Promise<void> {
  await renderNotesVideoList();
  clearElement(notesDetailEl);
  const empty = document.createElement('p');
  empty.className = 'notes-empty-detail';
  empty.textContent = 'Select a video to view notes';
  notesDetailEl.appendChild(empty);
  selectedVideoId = null;
}

saveApiBtn.addEventListener('click', handleSaveApiConfig);
saveModelsBtn.addEventListener('click', handleSaveModels);
savePersonalizationBtn.addEventListener('click', handleSavePersonalization);
resetAutoSyncBtn.addEventListener('click', handleResetAutoSync);
refreshMemoriesBtn.addEventListener('click', renderMemories);
condenseMemoriesBtn.addEventListener('click', handleCondenseMemories);
clearMemoriesBtn.addEventListener('click', handleClearMemories);
refreshLikedChannelsBtn.addEventListener('click', renderLikedChannels);
saveGuardianBtn.addEventListener('click', handleSaveGuardian);
saveCheckInBtn.addEventListener('click', handleSaveCheckIn);
saveFocusBtn.addEventListener('click', handleSaveFocus);

// Notes event listeners
refreshNotesBtn.addEventListener('click', renderNotes);
exportAllNotesBtn.addEventListener('click', async () => {
  await exportAllNotes();
  showStatus(notesStatusEl, 'All notes exported', 'success');
});
notesSearchInput.addEventListener('input', () => {
  renderNotesVideoList(notesSearchInput.value);
});

initTabs();
loadSettings();
renderNotes();

// Listen for settings changes (e.g., when aboutMe is regenerated in background)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) {
    const newSettings = changes.settings.newValue as Partial<Settings> | undefined;
    if (newSettings) {
      // Update aboutMe if it changed and is auto-generated
      if (newSettings.aboutMeAutoGenerated && newSettings.aboutMe !== aboutMeTextarea.value) {
        aboutMeTextarea.value = newSettings.aboutMe || '';
        updateAboutMeStatus(true);
      }
    }
  }
});
