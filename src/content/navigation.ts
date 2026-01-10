// Navigation detection for YouTube SPA
// YouTube fires custom events when navigation completes

import { debugLog } from "../shared/utils";

type NavigationCallback = (url: string, videoId: string | null) => void;

export function extractVideoId(url: string): string | null {
	try {
		const urlObj = new URL(url);
		if (urlObj.pathname === "/watch") {
			return urlObj.searchParams.get("v");
		}
	} catch {
		// Invalid URL
	}
	return null;
}

export function isVideoPage(url: string): boolean {
	return extractVideoId(url) !== null;
}

export function setupNavigationListener(callback: NavigationCallback): void {
	let lastUrl = window.location.href;
	let lastVideoId = extractVideoId(lastUrl);

	const handleUrlChange = (url: string) => {
		const videoId = extractVideoId(url);
		// Only trigger if URL actually changed
		if (url !== lastUrl || videoId !== lastVideoId) {
			lastUrl = url;
			lastVideoId = videoId;
			callback(url, videoId);
		}
	};

	// YouTube's custom navigation event - primary method
	document.addEventListener("yt-navigate-finish", () => {
		handleUrlChange(window.location.href);
	});

	// Fallback: popstate for browser back/forward navigation
	window.addEventListener("popstate", () => {
		handleUrlChange(window.location.href);
	});

	// Fallback: URL polling for edge cases YouTube's events miss
	// 5s interval balances battery/CPU savings vs responsiveness
	setInterval(() => {
		const url = window.location.href;
		if (url !== lastUrl) {
			handleUrlChange(url);
		}
	}, 5000);

	// Initial page load handling - trigger once if on video page
	const tryInitial = () => {
		const videoId = extractVideoId(window.location.href);
		if (videoId) {
			debugLog("Initial detection - video ID:", videoId);
			lastVideoId = videoId;
			lastUrl = window.location.href;
			callback(window.location.href, videoId);
		}
	};

	// Call once: immediately if loaded, otherwise after load
	if (document.readyState === "complete") {
		tryInitial();
	} else {
		window.addEventListener("load", () => setTimeout(tryInitial, 300), {
			once: true,
		});
	}
}
