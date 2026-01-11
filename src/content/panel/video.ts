import { queryFirst, YT_SELECTORS } from "../selectors";

export function getVideoTitle(): string {
	const titleEl = queryFirst(YT_SELECTORS.VIDEO_TITLE);
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

export function getVideoDuration(): number {
	const video = document.querySelector("video") as HTMLVideoElement | null;
	return video?.duration || 0;
}
