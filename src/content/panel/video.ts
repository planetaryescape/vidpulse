export function getVideoTitle(): string {
	const titleEl = document.querySelector(
		"h1.ytd-video-primary-info-renderer yt-formatted-string",
	);
	return titleEl?.textContent || document.title.replace(" - YouTube", "");
}

export function seekToTime(seconds: number): void {
	const video = document.querySelector("video") as HTMLVideoElement | null;
	if (video) {
		video.currentTime = seconds;
		video.play();
	}
}

export function getCurrentVideoTime(): number {
	const video = document.querySelector("video") as HTMLVideoElement | null;
	return video ? video.currentTime : 0;
}
