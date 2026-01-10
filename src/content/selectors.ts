// Centralized YouTube DOM selectors with fallback arrays
// YouTube periodically changes their DOM structure - having fallbacks increases resilience

export const YT_SELECTORS = {
	// Sidebar container
	SIDEBAR: [
		"#secondary",
		"#secondary-inner",
		"ytd-watch-flexy #secondary",
		"#related",
		"#below",
		"ytd-watch-metadata",
	],

	// Video title
	VIDEO_TITLE: [
		"h1.ytd-video-primary-info-renderer yt-formatted-string",
		"h1.title yt-formatted-string",
		"#title h1 yt-formatted-string",
	],

	// Channel link
	CHANNEL_LINK: [
		"ytd-video-owner-renderer a.yt-simple-endpoint",
		"#owner a.yt-simple-endpoint",
		"ytd-channel-name a",
	],

	// Subscribe button
	SUBSCRIBE_BTN: [
		"ytd-subscribe-button-renderer",
		"#subscribe-button ytd-subscribe-button-renderer",
	],

	// Playlist
	PLAYLIST_VIDEO: [
		"ytd-playlist-video-renderer",
		"ytd-playlist-panel-video-renderer",
	],
	PLAYLIST_HEADER: [
		"ytd-playlist-header-renderer",
		"#header ytd-playlist-header-renderer",
	],
	PLAYLIST_MENU: ["ytd-menu-renderer", "#top-level-buttons-computed"],
	VIDEO_TITLE_LINK: ["a#video-title", "a.ytd-playlist-video-renderer"],
	DURATION_SPAN: [
		"span.ytd-thumbnail-overlay-time-status-renderer",
		"ytd-thumbnail-overlay-time-status-renderer span",
	],

	// Meta fallbacks (single selectors, not arrays)
	CHANNEL_META: 'meta[itemprop="channelId"]',
	CHANNEL_NAME_META: 'span[itemprop="author"] link[itemprop="name"]',
};

// Query first matching element from fallback array
export function queryFirst(selectors: string[]): Element | null {
	for (const sel of selectors) {
		const el = document.querySelector(sel);
		if (el) return el;
	}
	return null;
}

// Query all elements using first matching selector from fallback array
export function queryAll(selectors: string[]): Element[] {
	for (const sel of selectors) {
		const els = document.querySelectorAll(sel);
		if (els.length > 0) return Array.from(els);
	}
	return [];
}
