import type { KeyPoint, VideoNote } from "../shared/types";
import { formatTimestamp } from "./panel/utils";
import { getVideoDuration, seekToTime } from "./panel/video";
import { queryFirst, YT_SELECTORS } from "./selectors";

interface MarkerData {
	seconds: number;
	type: "chapter" | "note";
	label: string;
	description?: string;
}

// Module state
let markersContainer: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let currentVideoId: string | null = null;
let currentChapters: KeyPoint[] = [];
let currentNotes: VideoNote[] = [];
let sessionVisible = true; // session-level toggle

/**
 * Inject markers into YouTube's player container (above progress bar)
 */
export function injectMarkers(
	videoId: string,
	chapters: KeyPoint[],
	notes: VideoNote[],
): void {
	// Clean up existing markers first
	removeMarkers();

	currentVideoId = videoId;
	currentChapters = chapters;
	currentNotes = notes;

	const playerContainer = queryFirst(YT_SELECTORS.PLAYER_CONTAINER);
	if (!playerContainer) {
		// Retry after short delay - YouTube may still be loading
		setTimeout(() => {
			if (currentVideoId === videoId) {
				const retryPlayer = queryFirst(YT_SELECTORS.PLAYER_CONTAINER);
				if (retryPlayer) {
					createMarkersContainer(retryPlayer as HTMLElement);
					renderMarkers();
					setupResizeObserver(retryPlayer as HTMLElement);
					setupDurationListener();
				}
			}
		}, 1000);
		return;
	}

	createMarkersContainer(playerContainer as HTMLElement);
	renderMarkers();
	setupResizeObserver(playerContainer as HTMLElement);
	setupDurationListener();
}

/**
 * Remove all markers and cleanup
 */
export function removeMarkers(): void {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}

	if (markersContainer) {
		markersContainer.remove();
		markersContainer = null;
	}

	currentVideoId = null;
	currentChapters = [];
	currentNotes = [];
}

/**
 * Update markers when notes change (without full re-injection)
 */
export function updateMarkersForNotes(
	videoId: string,
	notes: VideoNote[],
): void {
	if (videoId !== currentVideoId || !markersContainer) return;
	currentNotes = notes;
	renderMarkers();
}

/**
 * Toggle marker visibility (session-level)
 */
export function setMarkersVisible(visible: boolean): void {
	sessionVisible = visible;
	if (markersContainer) {
		markersContainer.style.display = visible ? "block" : "none";
	}
}

/**
 * Get current visibility state
 */
export function areMarkersVisible(): boolean {
	return sessionVisible;
}

// Internal: Create the markers container element
function createMarkersContainer(playerContainer: HTMLElement): void {
	markersContainer = document.createElement("div");
	markersContainer.className = "vp-markers-container";
	markersContainer.style.display = sessionVisible ? "block" : "none";

	// Player container is already positioned
	playerContainer.appendChild(markersContainer);
}

// Internal: Clear container children safely
function clearContainer(): void {
	if (!markersContainer) return;
	while (markersContainer.firstChild) {
		markersContainer.removeChild(markersContainer.firstChild);
	}
}

// Internal: Render all markers
function renderMarkers(): void {
	if (!markersContainer) return;

	// Clear existing markers
	clearContainer();

	const duration = getVideoDuration();

	// Combine chapters and notes into marker data
	const markers: MarkerData[] = [];

	for (const chapter of currentChapters) {
		markers.push({
			seconds: chapter.seconds,
			type: "chapter",
			label: chapter.title,
			description: chapter.description,
		});
	}

	for (const note of currentNotes) {
		markers.push({
			seconds: note.timestamp,
			type: "note",
			label: note.content || "Note",
		});
	}

	// Render each marker
	for (const marker of markers) {
		const el = createMarkerElement(marker, duration);
		markersContainer.appendChild(el);
	}
}

// Internal: Create a single marker element
function createMarkerElement(data: MarkerData, duration: number): HTMLElement {
	const marker = document.createElement("div");
	marker.className = `vp-marker vp-marker-${data.type}`;
	marker.dataset.seconds = String(data.seconds);

	// Position marker
	const pct = duration > 0 ? (data.seconds / duration) * 100 : 0;
	marker.style.left = `${pct}%`;

	// Edge detection for tooltip positioning
	if (pct < 15) {
		marker.classList.add("vp-marker-edge-left");
	} else if (pct > 85) {
		marker.classList.add("vp-marker-edge-right");
	}

	// Marker line
	const line = document.createElement("div");
	line.className = "vp-marker-line";
	marker.appendChild(line);

	// Tooltip
	const tooltip = document.createElement("div");
	tooltip.className = "vp-marker-tooltip";

	const time = document.createElement("span");
	time.className = "vp-marker-time";
	time.textContent = formatTimestamp(data.seconds);
	tooltip.appendChild(time);

	if (data.type === "chapter") {
		// Chapter: show title and description
		const label = document.createElement("span");
		label.className = "vp-marker-label";
		label.textContent = data.label;
		tooltip.appendChild(label);

		if (data.description) {
			const desc = document.createElement("div");
			desc.className = "vp-marker-description";
			desc.textContent = data.description;
			tooltip.appendChild(desc);
		}
	} else {
		// Note: show full content (scrollable)
		const content = document.createElement("div");
		content.className = "vp-marker-note-content";
		content.textContent = data.label;
		tooltip.appendChild(content);
	}

	marker.appendChild(tooltip);

	// Click to seek
	marker.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		seekToTime(data.seconds);
	});

	return marker;
}

// Internal: Setup resize observer for progress bar
function setupResizeObserver(progressBar: HTMLElement): void {
	resizeObserver = new ResizeObserver(() => {
		// Re-render markers when progress bar size changes
		renderMarkers();
	});
	resizeObserver.observe(progressBar);
}

// Internal: Listen for video duration becoming available
function setupDurationListener(): void {
	const video = document.querySelector("video");
	if (!video) return;

	// If duration already available, re-render
	if (video.duration && !Number.isNaN(video.duration)) {
		renderMarkers();
		return;
	}

	// Wait for metadata
	const onLoadedMetadata = () => {
		renderMarkers();
		video.removeEventListener("loadedmetadata", onLoadedMetadata);
	};
	video.addEventListener("loadedmetadata", onLoadedMetadata);
}
