/**
 * Video player watcher for tracking actual watch time.
 * Listens to YouTube video play/pause events and accumulates watch time.
 */

let videoElement: HTMLVideoElement | null = null;
let isPlaying = false;
let accumulatedWatchTime = 0; // seconds
let lastPlayTimestamp = 0;
let currentVideoId: string | null = null;
let observer: MutationObserver | null = null;

function onPlay(): void {
	if (!isPlaying) {
		isPlaying = true;
		lastPlayTimestamp = Date.now();
	}
}

function onPause(): void {
	if (isPlaying) {
		const elapsed = (Date.now() - lastPlayTimestamp) / 1000;
		accumulatedWatchTime += elapsed;
		isPlaying = false;
	}
}

function attachListeners(video: HTMLVideoElement): void {
	video.addEventListener("play", onPlay);
	video.addEventListener("pause", onPause);
	video.addEventListener("ended", onPause);
	videoElement = video;

	// If video is already playing when we attach
	if (!video.paused) {
		onPlay();
	}
}

function detachListeners(): void {
	if (videoElement) {
		videoElement.removeEventListener("play", onPlay);
		videoElement.removeEventListener("pause", onPause);
		videoElement.removeEventListener("ended", onPause);
		videoElement = null;
	}
}

function findAndAttachVideo(): void {
	const video = document.querySelector<HTMLVideoElement>(
		"video.html5-main-video",
	);
	if (video && video !== videoElement) {
		detachListeners();
		attachListeners(video);
	}
}

export function initVideoWatcher(videoId: string): void {
	// Clean up if switching videos
	if (currentVideoId !== videoId) {
		cleanupVideoWatcher();
	}

	currentVideoId = videoId;
	accumulatedWatchTime = 0;
	isPlaying = false;
	lastPlayTimestamp = 0;

	// Find video element (may not exist immediately)
	findAndAttachVideo();

	// Watch for video element being added/replaced (SPA navigation)
	if (!observer) {
		observer = new MutationObserver(() => {
			if (currentVideoId) {
				findAndAttachVideo();
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}
}

export function getAccumulatedWatchTime(): number {
	// Include any currently playing time
	if (isPlaying) {
		const elapsed = (Date.now() - lastPlayTimestamp) / 1000;
		return accumulatedWatchTime + elapsed;
	}
	return accumulatedWatchTime;
}

export function cleanupVideoWatcher(): void {
	// Finalize any playing time
	if (isPlaying) {
		onPause();
	}

	detachListeners();

	if (observer) {
		observer.disconnect();
		observer = null;
	}

	currentVideoId = null;
	accumulatedWatchTime = 0;
	isPlaying = false;
	lastPlayTimestamp = 0;
}
