import { render } from "preact";
import type { GetVideoFeedbackResponse } from "../../shared/messages";
import { MessageType, sendMessage } from "../../shared/messages";
import type { PanelState } from "../../shared/types";
import { updateLikedChannelSubscriptionStatus } from "./channel";
import { Panel } from "./components/Panel";
import { FLOATING_CONTAINER_ID, PANEL_ID } from "./constants";
import { findOrCreateContainer } from "./container";
import { applyFontSize, getFontSize } from "./font-size";
import { setInjectPanelFn } from "./header";
import { startSessionTimer, stopSessionTimer } from "./session";

export function removePanel(): void {
	stopSessionTimer();
	const panel = document.getElementById(PANEL_ID);
	if (panel) {
		render(null, panel);
		panel.remove();
	}
	document.getElementById(FLOATING_CONTAINER_ID)?.remove();
}

// Guard to prevent concurrent panel injections
let injectionInProgress = false;

export async function injectPanel(state: PanelState): Promise<void> {
	// Prevent concurrent injections that cause duplicates
	if (injectionInProgress) return;
	injectionInProgress = true;

	// Remove existing panel FIRST, before any async work
	removePanel();

	try {
		const [{ container, isFloating }, fontSize, feedbackResponse] =
			await Promise.all([
				findOrCreateContainer(),
				getFontSize(),
				(state.status === "ready" || state.status === "partial") &&
				state.analysis
					? sendMessage<GetVideoFeedbackResponse>({
							type: MessageType.GET_VIDEO_FEEDBACK,
							videoId: state.videoId,
						}).catch(() => undefined)
					: Promise.resolve(undefined),
			]);

		const userFeedback = feedbackResponse?.hasFeedback
			? feedbackResponse.feedback
			: undefined;
		const stateWithFeedback = { ...state, userFeedback };

		// Create container element
		const panel = document.createElement("div");
		panel.id = PANEL_ID;
		panel.className = `vidpulse-panel${isFloating ? " vidpulse-floating" : ""}`;
		if (isFloating) {
			panel.style.position = "relative";
		}
		applyFontSize(panel, fontSize);

		// Insert into DOM first
		container.insertBefore(panel, container.firstChild);

		// Render Preact component into the panel
		render(
			<Panel
				initialState={stateWithFeedback}
				fontSize={fontSize}
				isFloating={isFloating}
				onClose={isFloating ? removePanel : undefined}
			/>,
			panel,
		);

		startSessionTimer();
		updateLikedChannelSubscriptionStatus();
	} catch (error) {
		console.error("VidPulse: Failed to inject panel", error);
	} finally {
		injectionInProgress = false;
	}
}

// Register injectPanel with header module to avoid circular dependency
setInjectPanelFn(injectPanel);

export function togglePanelVisibility(): void {
	const panel = document.getElementById(PANEL_ID);
	const floatingContainer = document.getElementById(FLOATING_CONTAINER_ID);

	if (panel) {
		const isHidden = panel.style.display === "none";
		panel.style.display = isHidden ? "" : "none";
	}
	if (floatingContainer) {
		const isHidden = floatingContainer.style.display === "none";
		floatingContainer.style.display = isHidden ? "" : "none";
	}
}

export function triggerFeedback(type: "like" | "dislike"): void {
	const btn =
		type === "like"
			? (document.querySelector(".vp-like-btn") as HTMLButtonElement)
			: (document.querySelector(".vp-dislike-btn") as HTMLButtonElement);

	if (btn && !btn.disabled) {
		btn.click();
	}
}

export function triggerRegenerate(): void {
	const btn = document.querySelector(".vp-regenerate-btn") as HTMLButtonElement;
	if (btn) {
		btn.click();
	}
}
