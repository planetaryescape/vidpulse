import type { RegenerateVideoResponse } from "../../shared/messages";
import { MessageType, sendMessage } from "../../shared/messages";
import type { PanelState } from "../../shared/types";
import { isFocusModeActive } from "../guardian";
import { getSession, pauseFocusMode } from "../storage-proxy";
import {
	FONT_SIZE_STEP,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
	PANEL_ID,
} from "./constants";
import { applyFontSize, saveFontSize } from "./font-size";
import { getSessionStats } from "./session";

// Forward declaration - will be imported in assembly.ts
let injectPanelFn: ((state: PanelState) => Promise<void>) | null = null;

export function setInjectPanelFn(
	fn: (state: PanelState) => Promise<void>,
): void {
	injectPanelFn = fn;
}

export async function buildHeader(
	state: PanelState,
	currentFontSize: number,
): Promise<HTMLElement> {
	const header = document.createElement("div");
	header.className = "vp-header";

	const logoRow = document.createElement("div");
	logoRow.className = "vp-logo-row";

	const logo = document.createElement("span");
	logo.className = "vp-logo";
	logo.textContent = "VIDPULSE";

	const sessionTimer = document.createElement("span");
	sessionTimer.className = "vp-session-timer";
	const session = await getSession();
	if (session) {
		const stats = getSessionStats(session);
		sessionTimer.textContent = `${stats.duration} \u00B7 ${stats.videoCount} video${stats.videoCount !== 1 ? "s" : ""}`;
	}

	logoRow.appendChild(logo);
	logoRow.appendChild(sessionTimer);

	const focusActive = await isFocusModeActive();
	if (focusActive) {
		const focusBadge = document.createElement("span");
		focusBadge.className = "vp-focus-badge";
		focusBadge.textContent = "Focus";
		focusBadge.title = "Focus mode active - click to pause for 1 hour";
		focusBadge.addEventListener("click", async () => {
			await pauseFocusMode(1);
			focusBadge.remove();
		});
		logoRow.appendChild(focusBadge);
	}

	const controls = document.createElement("div");
	controls.className = "vp-controls";

	const fontControls = document.createElement("div");
	fontControls.className = "vp-font-controls";

	const decreaseBtn = document.createElement("button");
	decreaseBtn.className = "vp-font-btn";
	decreaseBtn.setAttribute("type", "button");
	decreaseBtn.textContent = "A\u2212";
	decreaseBtn.title = "Decrease text size";
	decreaseBtn.disabled = currentFontSize <= MIN_FONT_SIZE;

	const increaseBtn = document.createElement("button");
	increaseBtn.className = "vp-font-btn";
	increaseBtn.setAttribute("type", "button");
	increaseBtn.textContent = "A+";
	increaseBtn.title = "Increase text size";
	increaseBtn.disabled = currentFontSize >= MAX_FONT_SIZE;

	const getCurrentSize = (): number => {
		const panel = document.getElementById(PANEL_ID);
		if (!panel) return 1;
		const scale = panel.style.getPropertyValue("--vp-font-scale");
		return scale ? parseFloat(scale) : 1;
	};

	decreaseBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		const panel = document.getElementById(PANEL_ID);
		if (!panel) return;
		const current = getCurrentSize();
		const newSize = Math.max(
			MIN_FONT_SIZE,
			Math.round((current - FONT_SIZE_STEP) * 10) / 10,
		);
		saveFontSize(newSize);
		applyFontSize(panel, newSize);
		decreaseBtn.disabled = newSize <= MIN_FONT_SIZE;
		increaseBtn.disabled = newSize >= MAX_FONT_SIZE;
	});

	increaseBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		const panel = document.getElementById(PANEL_ID);
		if (!panel) return;
		const current = getCurrentSize();
		const newSize = Math.min(
			MAX_FONT_SIZE,
			Math.round((current + FONT_SIZE_STEP) * 10) / 10,
		);
		saveFontSize(newSize);
		applyFontSize(panel, newSize);
		decreaseBtn.disabled = newSize <= MIN_FONT_SIZE;
		increaseBtn.disabled = newSize >= MAX_FONT_SIZE;
	});

	fontControls.appendChild(decreaseBtn);
	fontControls.appendChild(increaseBtn);
	controls.appendChild(fontControls);

	if (state.status === "ready") {
		const regenerateBtn = document.createElement("button");
		regenerateBtn.className = "vp-regenerate-btn";
		regenerateBtn.setAttribute("type", "button");
		regenerateBtn.textContent = "\u21BB";
		regenerateBtn.title = "Regenerate analysis";
		regenerateBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (!injectPanelFn) return;

			await injectPanelFn({ status: "loading", videoId: state.videoId });
			try {
				const response = await sendMessage<RegenerateVideoResponse>({
					type: MessageType.REGENERATE_VIDEO,
					videoId: state.videoId,
					videoUrl: `https://www.youtube.com/watch?v=${state.videoId}`,
				});
				if (response.success && response.analysis) {
					await injectPanelFn({
						status: "ready",
						videoId: state.videoId,
						analysis: response.analysis,
					});
				} else {
					await injectPanelFn({
						status: "error",
						videoId: state.videoId,
						error: response.error || "Failed to regenerate",
					});
				}
			} catch (err) {
				await injectPanelFn({
					status: "error",
					videoId: state.videoId,
					error: err instanceof Error ? err.message : "Failed to regenerate",
				});
			}
		});
		controls.appendChild(regenerateBtn);
	}

	const settingsBtn = document.createElement("button");
	settingsBtn.className = "vp-settings-btn";
	settingsBtn.setAttribute("type", "button");
	settingsBtn.textContent = "\u2699";
	settingsBtn.title = "Settings";
	settingsBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	});
	controls.appendChild(settingsBtn);

	header.appendChild(logoRow);
	header.appendChild(controls);
	return header;
}
