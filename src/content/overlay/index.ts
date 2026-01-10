// Video overlay public API

import type { SubmitFeedbackResponse } from "../../shared/messages";
import { MessageType, sendMessage } from "../../shared/messages";
import type { PanelState } from "../../shared/types";
import { getChannelInfo } from "../panel/channel";
import { getVideoTitle } from "../panel/video";
import { createBadge, updateBadgeFeedback } from "./badge";
import { OVERLAY_EXPANDED_ID, OVERLAY_ID } from "./constants";
import {
	findPlayerContainer,
	isAdPlaying,
	isMiniPlayerActive,
} from "./container";
import { createExpandedPanel } from "./expanded";
import {
	clearState,
	dispatchFeedbackEvent,
	getState,
	setState,
	toggleExpanded,
} from "./state";

let injectionInProgress = false;

export async function injectOverlay(state: PanelState): Promise<void> {
	if (injectionInProgress) return;
	if (state.status !== "ready" && state.status !== "partial") return;
	if (!state.analysis) return;

	injectionInProgress = true;

	try {
		// Remove existing overlay
		removeOverlay();

		// Don't show during ads or mini-player
		if (isAdPlaying() || isMiniPlayerActive()) {
			return;
		}

		const player = findPlayerContainer();
		if (!player) {
			console.warn("[VidPulse] Could not find player container for overlay");
			return;
		}

		setState(state);

		// Create overlay container
		const overlay = document.createElement("div");
		overlay.id = OVERLAY_ID;
		overlay.className = "vp-overlay";

		// Create badge row (always visible)
		const badge = createBadge(state.analysis, state.userFeedback, {
			onToggle: () => {
				const nowExpanded = toggleExpanded();
				updateExpandedVisibility(nowExpanded);
			},
			onLike: () => handleFeedback("like"),
			onDislike: () => handleFeedback("dislike"),
		});
		overlay.appendChild(badge);

		// Create expanded panel (hidden by default)
		const expanded = createExpandedPanel(state.analysis);
		expanded.style.display = "none";
		overlay.appendChild(expanded);

		// Inject into player
		player.appendChild(overlay);
	} finally {
		injectionInProgress = false;
	}
}

export function removeOverlay(): void {
	const existing = document.getElementById(OVERLAY_ID);
	if (existing) {
		existing.remove();
	}
	clearState();
}

export function updateOverlay(state: PanelState): void {
	if (state.status !== "ready" && state.status !== "partial") return;
	if (!state.analysis) return;

	const existing = document.getElementById(OVERLAY_ID);
	if (existing) {
		// Re-inject with new state
		injectOverlay(state);
	}
}

export function toggleOverlayExpanded(): void {
	const state = getState();
	if (!state?.analysis) return;

	const nowExpanded = toggleExpanded();
	updateExpandedVisibility(nowExpanded);
}

function updateExpandedVisibility(show: boolean): void {
	const expanded = document.getElementById(OVERLAY_EXPANDED_ID);
	if (expanded) {
		expanded.style.display = show ? "block" : "none";
	}

	// Update badge button state
	const overlay = document.getElementById(OVERLAY_ID);
	if (overlay) {
		if (show) {
			overlay.classList.add("vp-overlay-open");
		} else {
			overlay.classList.remove("vp-overlay-open");
		}
	}
}

async function handleFeedback(feedback: "like" | "dislike"): Promise<void> {
	const state = getState();
	if (!state?.analysis) return;

	try {
		const channelInfo = getChannelInfo() || undefined;
		const response = await sendMessage<SubmitFeedbackResponse>({
			type: MessageType.SUBMIT_FEEDBACK,
			videoId: state.videoId,
			videoTitle: getVideoTitle(),
			feedback,
			analysis: state.analysis,
			channelInfo,
		});

		const success = response.success;
		updateBadgeFeedback(feedback, success);

		// Dispatch event to sync with panel
		dispatchFeedbackEvent({ feedback, success });
	} catch {
		updateBadgeFeedback(feedback, false);
	}
}

// Re-export for keyboard shortcut
export { isExpanded } from "./state";
