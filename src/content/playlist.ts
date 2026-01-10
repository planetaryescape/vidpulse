import type {
	AnalyzeVideoResponse,
	GetCachedResponse,
} from "../shared/messages";
import { MessageType, sendMessage } from "../shared/messages";
import type { VideoAnalysis } from "../shared/types";

const PLAYLIST_PANEL_ID = "vidpulse-playlist-panel";
const ANALYZE_BTN_ID = "vidpulse-analyze-playlist";

interface PlaylistVideo {
	videoId: string;
	title: string;
	thumbnail: string;
	duration: string;
	analysis?: VideoAnalysis;
	status: "pending" | "analyzing" | "done" | "error";
}

interface PlaylistAnalysis {
	videos: PlaylistVideo[];
	analyzed: number;
	total: number;
}

let currentPlaylistId: string | null = null;
let analysisInProgress = false;

export function isPlaylistPage(): boolean {
	return (
		window.location.pathname === "/playlist" &&
		window.location.search.includes("list=")
	);
}

export function extractPlaylistId(): string | null {
	const params = new URLSearchParams(window.location.search);
	return params.get("list");
}

function extractPlaylistVideos(): PlaylistVideo[] {
	const videos: PlaylistVideo[] = [];
	const videoElements = document.querySelectorAll(
		"ytd-playlist-video-renderer",
	);

	videoElements.forEach((el) => {
		const linkEl = el.querySelector("a#video-title") as HTMLAnchorElement;
		const thumbEl = el.querySelector("img") as HTMLImageElement;
		const durationEl = el.querySelector(
			"span.ytd-thumbnail-overlay-time-status-renderer",
		) as HTMLSpanElement;

		if (linkEl) {
			const href = linkEl.href || "";
			const videoIdMatch = href.match(/[?&]v=([^&]+)/);
			if (videoIdMatch) {
				videos.push({
					videoId: videoIdMatch[1],
					title: linkEl.textContent?.trim() || "Unknown",
					thumbnail: thumbEl?.src || "",
					duration: durationEl?.textContent?.trim() || "",
					status: "pending",
				});
			}
		}
	});

	return videos;
}

function getVerdictClass(verdict: string): string {
	switch (verdict) {
		case "worth_it":
			return "vp-verdict-worth";
		case "maybe":
			return "vp-verdict-maybe";
		case "skip":
			return "vp-verdict-skip";
		default:
			return "";
	}
}

function getVerdictText(verdict: string): string {
	switch (verdict) {
		case "worth_it":
			return "Worth It";
		case "maybe":
			return "Maybe";
		case "skip":
			return "Skip";
		default:
			return "";
	}
}

function _clearElement(el: HTMLElement): void {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

function buildPlaylistPanel(analysis: PlaylistAnalysis): HTMLElement {
	const panel = document.createElement("div");
	panel.id = PLAYLIST_PANEL_ID;
	panel.className = "vp-playlist-panel";

	// Header
	const header = document.createElement("div");
	header.className = "vp-playlist-header";

	const title = document.createElement("h3");
	title.className = "vp-playlist-title";
	title.textContent = "VidPulse Analysis";

	const closeBtn = document.createElement("button");
	closeBtn.className = "vp-playlist-close";
	closeBtn.setAttribute("type", "button");
	closeBtn.textContent = "\u00D7"; // ×
	closeBtn.addEventListener("click", removePlaylistPanel);

	header.appendChild(title);
	header.appendChild(closeBtn);
	panel.appendChild(header);

	// Progress/Summary
	const summaryEl = document.createElement("div");
	summaryEl.className = "vp-playlist-summary";

	if (analysis.analyzed < analysis.total) {
		const progressText = document.createElement("div");
		progressText.className = "vp-playlist-progress-text";
		progressText.textContent = `Analyzing ${analysis.analyzed}/${analysis.total} videos...`;
		summaryEl.appendChild(progressText);

		const progressBar = document.createElement("div");
		progressBar.className = "vp-playlist-progress";
		const progressFill = document.createElement("div");
		progressFill.className = "vp-playlist-progress-fill";
		progressFill.style.width = `${(analysis.analyzed / analysis.total) * 100}%`;
		progressBar.appendChild(progressFill);
		summaryEl.appendChild(progressBar);
	} else {
		// Calculate summary stats
		const worthIt = analysis.videos.filter(
			(v) => v.analysis?.verdict === "worth_it",
		).length;
		const maybe = analysis.videos.filter(
			(v) => v.analysis?.verdict === "maybe",
		).length;
		const skip = analysis.videos.filter(
			(v) => v.analysis?.verdict === "skip",
		).length;

		const avgProductivity = Math.round(
			analysis.videos.reduce(
				(sum, v) => sum + (v.analysis?.scores.productivity || 0),
				0,
			) / analysis.total,
		);

		const statsRow = document.createElement("div");
		statsRow.className = "vp-playlist-stats";

		const stats = [
			{ label: "Worth It", value: worthIt, cls: "worth" },
			{ label: "Maybe", value: maybe, cls: "maybe" },
			{ label: "Skip", value: skip, cls: "skip" },
			{ label: "Avg Score", value: avgProductivity, cls: "avg" },
		];

		stats.forEach((stat) => {
			const statEl = document.createElement("div");
			statEl.className = `vp-playlist-stat ${stat.cls}`;
			const valueEl = document.createElement("span");
			valueEl.className = "vp-playlist-stat-value";
			valueEl.textContent = String(stat.value);
			const labelEl = document.createElement("span");
			labelEl.className = "vp-playlist-stat-label";
			labelEl.textContent = stat.label;
			statEl.appendChild(valueEl);
			statEl.appendChild(labelEl);
			statsRow.appendChild(statEl);
		});

		summaryEl.appendChild(statsRow);
	}

	panel.appendChild(summaryEl);

	// Video list
	const videoList = document.createElement("div");
	videoList.className = "vp-playlist-videos";

	// Sort by score (worth_it first, then maybe, then skip)
	const sortedVideos = [...analysis.videos].sort((a, b) => {
		const order = { worth_it: 0, maybe: 1, skip: 2 };
		const aOrder = order[a.analysis?.verdict as keyof typeof order] ?? 3;
		const bOrder = order[b.analysis?.verdict as keyof typeof order] ?? 3;
		if (aOrder !== bOrder) return aOrder - bOrder;
		// Secondary sort by productivity score
		return (
			(b.analysis?.scores.productivity || 0) -
			(a.analysis?.scores.productivity || 0)
		);
	});

	sortedVideos.forEach((video) => {
		const videoEl = document.createElement("div");
		videoEl.className = "vp-playlist-video";

		const thumbEl = document.createElement("img");
		thumbEl.className = "vp-playlist-thumb";
		thumbEl.src =
			video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`;
		thumbEl.alt = "";

		const infoEl = document.createElement("div");
		infoEl.className = "vp-playlist-video-info";

		const titleEl = document.createElement("a");
		titleEl.className = "vp-playlist-video-title";
		titleEl.href = `https://www.youtube.com/watch?v=${video.videoId}`;
		titleEl.textContent = video.title;

		const metaEl = document.createElement("div");
		metaEl.className = "vp-playlist-video-meta";

		if (video.status === "analyzing") {
			metaEl.textContent = "Analyzing...";
		} else if (video.status === "error") {
			metaEl.textContent = "Error";
		} else if (video.analysis) {
			const verdictEl = document.createElement("span");
			verdictEl.className = `vp-playlist-verdict ${getVerdictClass(video.analysis.verdict)}`;
			verdictEl.textContent = getVerdictText(video.analysis.verdict);

			const scoreEl = document.createElement("span");
			scoreEl.className = "vp-playlist-score";
			scoreEl.textContent = `${video.analysis.scores.productivity} prod`;

			metaEl.appendChild(verdictEl);
			metaEl.appendChild(scoreEl);
		} else {
			metaEl.textContent = "Pending";
		}

		infoEl.appendChild(titleEl);
		infoEl.appendChild(metaEl);

		videoEl.appendChild(thumbEl);
		videoEl.appendChild(infoEl);
		videoList.appendChild(videoEl);
	});

	panel.appendChild(videoList);

	// Actions
	if (analysis.analyzed === analysis.total) {
		const actions = document.createElement("div");
		actions.className = "vp-playlist-actions";

		const worthItFirst = sortedVideos.find(
			(v) => v.analysis?.verdict === "worth_it",
		);
		if (worthItFirst) {
			const watchBtn = document.createElement("a");
			watchBtn.className = "vp-playlist-btn";
			watchBtn.href = `https://www.youtube.com/watch?v=${worthItFirst.videoId}&list=${currentPlaylistId}`;
			watchBtn.textContent = "Start with best";
			actions.appendChild(watchBtn);
		}

		panel.appendChild(actions);
	}

	return panel;
}

function updatePlaylistPanel(analysis: PlaylistAnalysis): void {
	const existing = document.getElementById(PLAYLIST_PANEL_ID);
	if (existing) {
		existing.replaceWith(buildPlaylistPanel(analysis));
	} else {
		document.body.appendChild(buildPlaylistPanel(analysis));
	}
}

export function removePlaylistPanel(): void {
	document.getElementById(PLAYLIST_PANEL_ID)?.remove();
}

async function analyzePlaylist(): Promise<void> {
	if (analysisInProgress) return;

	const playlistId = extractPlaylistId();
	if (!playlistId) return;

	currentPlaylistId = playlistId;
	analysisInProgress = true;

	const videos = extractPlaylistVideos();
	if (videos.length === 0) {
		alert("No videos found in playlist");
		analysisInProgress = false;
		return;
	}

	const analysis: PlaylistAnalysis = {
		videos,
		analyzed: 0,
		total: videos.length,
	};

	updatePlaylistPanel(analysis);

	// Analyze videos one by one
	for (let i = 0; i < videos.length; i++) {
		const video = videos[i];
		video.status = "analyzing";
		updatePlaylistPanel(analysis);

		try {
			// Check cache first
			const cached = await sendMessage<GetCachedResponse>({
				type: MessageType.GET_CACHED,
				videoId: video.videoId,
			});

			if (cached.analysis) {
				video.analysis = cached.analysis;
				video.status = "done";
			} else {
				// Analyze video
				const result = await sendMessage<AnalyzeVideoResponse>({
					type: MessageType.ANALYZE_VIDEO,
					videoId: video.videoId,
					videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
				});

				if (result.error) {
					video.status = "error";
				} else if (result.analysis) {
					video.analysis = result.analysis;
					video.status = "done";
				}
			}
		} catch (_err) {
			video.status = "error";
		}

		analysis.analyzed++;
		updatePlaylistPanel(analysis);
	}

	analysisInProgress = false;
}

function injectAnalyzeButton(): void {
	if (document.getElementById(ANALYZE_BTN_ID)) return;

	// Find playlist header area
	const headerArea = document.querySelector("ytd-playlist-header-renderer");
	if (!headerArea) {
		// Retry after a short delay
		setTimeout(injectAnalyzeButton, 500);
		return;
	}

	const btn = document.createElement("button");
	btn.id = ANALYZE_BTN_ID;
	btn.className = "vp-analyze-playlist-btn";
	btn.setAttribute("type", "button");
	btn.textContent = "Analyze Playlist";
	btn.addEventListener("click", analyzePlaylist);

	// Find the buttons area or append to header
	const menuContainer = headerArea.querySelector("ytd-menu-renderer");
	if (menuContainer) {
		menuContainer.insertBefore(btn, menuContainer.firstChild);
	} else {
		headerArea.appendChild(btn);
	}
}

function removeAnalyzeButton(): void {
	document.getElementById(ANALYZE_BTN_ID)?.remove();
}

export function handlePlaylistPage(): void {
	if (isPlaylistPage()) {
		injectAnalyzeButton();
	} else {
		removeAnalyzeButton();
		removePlaylistPanel();
	}
}

export function cleanupPlaylist(): void {
	removeAnalyzeButton();
	removePlaylistPanel();
	analysisInProgress = false;
}
