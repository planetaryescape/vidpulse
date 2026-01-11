// Player container detection for overlay injection

import { queryFirst, YT_SELECTORS } from "../selectors";

export function findPlayerContainer(): Element | null {
	return queryFirst(YT_SELECTORS.PLAYER_CONTAINER);
}

export function isAdPlaying(): boolean {
	// Check for ad indicators
	const adOverlay = document.querySelector(".ytp-ad-player-overlay");
	const adModule = document.querySelector(".video-ads.ytp-ad-module");
	return !!(adOverlay || adModule?.classList.contains("ad-showing"));
}

export function isMiniPlayerActive(): boolean {
	const miniPlayer = document.querySelector("ytd-miniplayer");
	return miniPlayer?.hasAttribute("active") ?? false;
}
