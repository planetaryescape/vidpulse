import "../styles/panel.css";
import type {
	AnalyzeVideoResponse,
	CheckApiKeyResponse,
	GetCachedResponse,
} from "../shared/messages";
import { MessageType, sendMessage } from "../shared/messages";
import type { SessionVideo, VideoAnalysis } from "../shared/types";
import { initCheckIn } from "./checkin";
import { removeGuardian, shouldBlock, showGuardian } from "./guardian";
import { hasIntentSet, showIntentPrompt } from "./intent";
import { extractVideoId, setupNavigationListener } from "./navigation";
import {
	injectPanel,
	removePanel,
	togglePanelVisibility,
	triggerFeedback,
	triggerRegenerate,
} from "./panel";
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

function getVideoTitle(): string {
	const titleEl = document.querySelector(
		"h1.ytd-video-primary-info-renderer yt-formatted-string",
	);
	return titleEl?.textContent || document.title.replace(" - YouTube", "");
}

function getChannelInfo(): { channelId: string; channelName: string } | null {
	// Try to get channel info from various YouTube elements
	const channelLink = document.querySelector(
		"ytd-video-owner-renderer a.yt-simple-endpoint",
	) as HTMLAnchorElement | null;
	if (channelLink) {
		const href = channelLink.href;
		// Extract channel ID from URL like /channel/UCxxx or /@username
		const channelMatch = href.match(/\/(channel|c|user|@)\/([^/?]+)/);
		const channelId = channelMatch ? channelMatch[2] : href;
		const channelName = channelLink.textContent?.trim() || "Unknown Channel";
		return { channelId, channelName };
	}

	// Fallback: try meta tags
	const channelMeta = document.querySelector(
		'meta[itemprop="channelId"]',
	) as HTMLMetaElement | null;
	const nameMeta = document.querySelector(
		'span[itemprop="author"] link[itemprop="name"]',
	) as HTMLLinkElement | null;
	if (channelMeta) {
		return {
			channelId: channelMeta.content,
			channelName: nameMeta?.getAttribute("content") || "Unknown Channel",
		};
	}

	return null;
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

	// Add video to session
	const sessionVideo: SessionVideo = {
		videoId,
		title: getVideoTitle(),
		startTime: Date.now(),
	};
	await addVideoToSession(sessionVideo);

	const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

	// Check if API key is configured
	const keyCheck = await sendMessage<CheckApiKeyResponse>({
		type: MessageType.CHECK_API_KEY,
	});

	if (!keyCheck.hasKey) {
		await injectPanel({ status: "no_key", videoId });
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
		console.log("VidPulse: RE_DETECT received, forcing re-detection");
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
		}
	});
}

// Initialize
console.log("VidPulse: Content script loaded");
setupNavigationListener(handleNavigation);
setupKeyboardShortcuts();
