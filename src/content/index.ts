import "../styles/panel.css";
import "../styles/overlay.css";
import type {
	AnalyzeVideoResponse,
	CheckApiKeyResponse,
	GetCachedResponse,
	PushedMessage,
} from "../shared/messages";
import { MessageType, sendMessage } from "../shared/messages";
import type { SessionVideo, VideoAnalysis } from "../shared/types";
import { initCheckIn } from "./checkin";
import { removeGuardian, shouldBlock, showGuardian } from "./guardian";
import { hasIntentSet, showIntentPrompt } from "./intent";
import { extractVideoId, setupNavigationListener } from "./navigation";
import {
	injectOverlay,
	removeOverlay,
	toggleOverlayExpanded,
	updateOverlay,
} from "./overlay";
import {
	injectPanel,
	removePanel,
	togglePanelVisibility,
	triggerFeedback,
	triggerRegenerate,
} from "./panel";
import { getChannelInfo } from "./panel/channel";
import { getVideoTitle } from "./panel/video";
import { cleanupPlaylist, handlePlaylistPage } from "./playlist";
import {
	addVideoToSession,
	endVideoInSession,
	getSession,
	getSettings,
	startSession,
	updateChannelStats,
	updateDailyStats,
	updateSessionActivity,
} from "./storage-proxy";

let currentVideoId: string | null = null;
let analysisAbortController: AbortController | null = null;
let guardianDismissed = false; // Track if user dismissed guardian for current video
let currentAnalysis: VideoAnalysis | null = null; // Track current analysis for keyboard shortcuts

async function checkGuardian(analysis: VideoAnalysis): Promise<void> {
	if (guardianDismissed) return;

	const settings = await getSettings();
	const blockInfo = await shouldBlock(analysis, settings);

	if (blockInfo.block) {
		showGuardian(
			analysis,
			settings,
			blockInfo,
			() => {
				// Watch anyway
				guardianDismissed = true;
			},
			() => {
				// Go back
				window.history.back();
			},
		);
	}
}

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

	// Update channel stats
	const channelInfo = getChannelInfo();
	if (channelInfo) {
		await updateChannelStats(channelInfo.channelId, channelInfo.channelName, {
			productivity: analysis.scores.productivity,
			educational: analysis.scores.educational,
			entertainment: analysis.scores.entertainment,
			inspiring: analysis.scores.inspiring,
			creative: analysis.scores.creative,
		});
	}

	// Update daily stats (estimate 5 min watch time for now, will be updated on navigation)
	await updateDailyStats({
		duration: 300, // 5 minutes default, updated when navigating away
		scores: {
			productivity: analysis.scores.productivity,
			educational: analysis.scores.educational,
			entertainment: analysis.scores.entertainment,
			inspiring: analysis.scores.inspiring,
			creative: analysis.scores.creative,
		},
		channelId: channelInfo?.channelId || "",
	});
}

async function handleVideoPage(videoId: string): Promise<void> {
	// Skip if already processing this video
	if (currentVideoId === videoId) return;

	// End previous video in session
	if (currentVideoId) {
		await endVideoInSession(currentVideoId);
	}

	// Cancel any pending analysis
	if (analysisAbortController) {
		analysisAbortController.abort();
	}
	analysisAbortController = new AbortController();

	currentVideoId = videoId;
	currentAnalysis = null;
	guardianDismissed = false; // Reset for new video
	removeGuardian(); // Remove any existing guardian overlay

	// Initialize session if needed
	let session = await getSession();
	const isNewSession = !session;
	if (!session) {
		session = await startSession();
		// Start check-in timer for new session
		await initCheckIn();
	} else {
		await updateSessionActivity();
	}

	// Show intent prompt for new sessions without intent set
	if (isNewSession) {
		const intentSet = await hasIntentSet();
		if (!intentSet) {
			showIntentPrompt(() => {
				// Intent set or skipped, continue normally
			});
		}
	}

	const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

	// Check if API key is configured
	const keyCheck = await sendMessage<CheckApiKeyResponse>({
		type: MessageType.CHECK_API_KEY,
	});

	if (!keyCheck.hasKey) {
		if (keyCheck.invalid) {
			await injectPanel({
				status: "error",
				videoId,
				error: "API key invalid - please update in settings",
			});
		} else {
			await injectPanel({ status: "no_key", videoId });
		}
		return;
	}

	// Check cache first
	const cached = await sendMessage<GetCachedResponse>({
		type: MessageType.GET_CACHED,
		videoId,
	});

	if (cached.cached && cached.analysis) {
		currentAnalysis = cached.analysis;
		await updateSessionVideoWithAnalysis(videoId, cached.analysis);
		await injectPanel({ status: "ready", videoId, analysis: cached.analysis });
		await injectOverlay({
			status: "ready",
			videoId,
			analysis: cached.analysis,
		});
		await checkGuardian(cached.analysis);
		return;
	}

	// Show loading state
	await injectPanel({ status: "loading", videoId });

	try {
		// Request analysis from background worker
		const response = await sendMessage<AnalyzeVideoResponse>({
			type: MessageType.ANALYZE_VIDEO,
			videoId,
			videoUrl,
		});

		// Check if we're still on the same video
		if (currentVideoId !== videoId) return;

		if (response.success && response.analysis) {
			currentAnalysis = response.analysis;
			await updateSessionVideoWithAnalysis(videoId, response.analysis);
			await injectPanel({
				status: "ready",
				videoId,
				analysis: response.analysis,
			});
			await injectOverlay({
				status: "ready",
				videoId,
				analysis: response.analysis,
			});
			await checkGuardian(response.analysis);
		} else {
			await injectPanel({
				status: "error",
				videoId,
				error: response.error || "Analysis failed",
			});
		}
	} catch (error) {
		// Check if we're still on the same video
		if (currentVideoId !== videoId) return;

		await injectPanel({
			status: "error",
			videoId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}

async function handleNavigation(
	_url: string,
	videoId: string | null,
): Promise<void> {
	// End previous video in session
	if (currentVideoId && currentVideoId !== videoId) {
		await endVideoInSession(currentVideoId);
	}

	// Always clean up on navigation to prevent stale UI
	removePanel();
	removeOverlay();
	removeGuardian();

	// Handle playlist pages
	handlePlaylistPage();

	if (videoId) {
		cleanupPlaylist(); // Remove playlist UI when watching a video
		handleVideoPage(videoId);
	} else {
		// Not a video page
		currentVideoId = null;
		currentAnalysis = null;
		guardianDismissed = false;
	}
}

// Listen for re-detection requests from background (e.g., when user clicks extension icon)
chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "RE_DETECT") {
		currentVideoId = null; // Reset to force re-detection
		const videoId = extractVideoId(window.location.href);
		if (videoId) {
			handleVideoPage(videoId);
		}
	}
});

// Keyboard shortcuts
function setupKeyboardShortcuts(): void {
	document.addEventListener("keydown", (e) => {
		// Only handle Shift+key combinations
		if (!e.shiftKey) return;

		// Don't trigger in input fields
		const target = e.target as HTMLElement;
		if (
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.isContentEditable
		) {
			return;
		}

		switch (e.key.toUpperCase()) {
			case "V":
				// Toggle panel visibility
				e.preventDefault();
				togglePanelVisibility();
				break;
			case "L":
				// Like video
				if (currentVideoId && currentAnalysis) {
					e.preventDefault();
					triggerFeedback("like");
				}
				break;
			case "K":
				// Skip/dislike video
				if (currentVideoId && currentAnalysis) {
					e.preventDefault();
					triggerFeedback("dislike");
				}
				break;
			case "R":
				// Regenerate analysis
				if (currentVideoId) {
					e.preventDefault();
					triggerRegenerate();
				}
				break;
			case "O":
				// Toggle overlay expanded/collapsed
				if (currentVideoId && currentAnalysis) {
					e.preventDefault();
					toggleOverlayExpanded();
				}
				break;
		}
	});
}

// Listen for pushed analysis updates from background
chrome.runtime.onMessage.addListener((message: PushedMessage) => {
	if (
		message.type === MessageType.ANALYSIS_PARTIAL &&
		message.videoId === currentVideoId
	) {
		currentAnalysis = message.analysis;
		injectPanel({
			status: "partial",
			videoId: currentVideoId,
			analysis: message.analysis,
		});
		updateOverlay({
			status: "partial",
			videoId: currentVideoId,
			analysis: message.analysis,
		});
	}

	if (
		message.type === MessageType.ANALYSIS_COMPLETE &&
		message.videoId === currentVideoId
	) {
		currentAnalysis = message.analysis;
		updateSessionVideoWithAnalysis(currentVideoId, message.analysis);
		injectPanel({
			status: "ready",
			videoId: currentVideoId,
			analysis: message.analysis,
		});
		injectOverlay({
			status: "ready",
			videoId: currentVideoId,
			analysis: message.analysis,
		});
		checkGuardian(message.analysis);
	}
});

// Initialize
setupNavigationListener(handleNavigation);
setupKeyboardShortcuts();
