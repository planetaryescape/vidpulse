// Navigation detection for YouTube SPA
// YouTube fires custom events when navigation completes

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
	setInterval(() => {
		const url = window.location.href;
		if (url !== lastUrl) {
			handleUrlChange(url);
		}
	}, 1000);

	// Initial page load handling - always trigger if on video page
	const tryInitial = () => {
		const videoId = extractVideoId(window.location.href);
		if (videoId) {
			console.log("VidPulse: Initial detection - video ID:", videoId);
			lastVideoId = videoId;
			lastUrl = window.location.href;
			callback(window.location.href, videoId);
		}
	};

	// Try immediately
	tryInitial();

	// Also try after short delay (YouTube may not be ready)
	setTimeout(tryInitial, 500);

	// And after page fully loads
	if (document.readyState !== "complete") {
		window.addEventListener("load", () => setTimeout(tryInitial, 300));
	}
}
