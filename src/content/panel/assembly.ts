import type { GetVideoFeedbackResponse } from "../../shared/messages";
import { MessageType, sendMessage } from "../../shared/messages";
import type { PanelState, VideoAnalysis } from "../../shared/types";
import { getScoreColor } from "../../shared/utils";
import { getIntentAlignment } from "../intent";
import { getSession, getSettings } from "../storage-proxy";
import {
	buildChannelBadge,
	updateLikedChannelSubscriptionStatus,
} from "./channel";
import { FLOATING_CONTAINER_ID, PANEL_ID } from "./constants";
import { findOrCreateContainer } from "./container";
import { createFeedbackButtons } from "./feedback";
import { applyFontSize, getFontSize } from "./font-size";
import { buildHeader, setInjectPanelFn } from "./header";
import { createPoliticalBadge } from "./political-badge";
import { startSessionTimer, stopSessionTimer } from "./session";
import {
	buildErrorContent,
	buildLoadingContent,
	buildNoKeyContent,
} from "./status";
import { buildAnalysisPanel } from "./tabs/analysis";
import { buildChaptersPanel } from "./tabs/chapters";
import { buildForYouPanel } from "./tabs/foryou";
import { buildNotesPanel } from "./tabs/notes";
import { buildRelatedPanel } from "./tabs/related";
import { buildSummaryPanel } from "./tabs/summary";
import { getVerdictDisplay } from "./utils";

async function buildAnalysisContent(
	analysis: VideoAnalysis,
	state: PanelState,
): Promise<HTMLElement> {
	const content = document.createDocumentFragment();

	const [session, settings] = await Promise.all([getSession(), getSettings()]);
	if (session?.intent) {
		const alignment = getIntentAlignment(session.intent, analysis.scores);
		const intentBadge = document.createElement("div");
		intentBadge.className = `vp-intent-badge ${alignment.aligned ? "aligned" : "misaligned"}`;

		const icon = document.createElement("span");
		icon.className = "vp-intent-badge-icon";
		icon.textContent = alignment.aligned ? "\u2714" : "\u26A0";

		const text = document.createElement("span");
		text.className = "vp-intent-badge-text";
		text.textContent = alignment.message;

		intentBadge.appendChild(icon);
		intentBadge.appendChild(text);
		content.appendChild(intentBadge);
	}

	const compactHeader = document.createElement("div");
	compactHeader.className = "vp-compact-header";

	const channelBadge = await buildChannelBadge();
	if (channelBadge) {
		compactHeader.appendChild(channelBadge);
	}

	const verdictData = getVerdictDisplay(analysis.verdict);
	const verdictBadge = document.createElement("span");
	verdictBadge.className = `vp-verdict-badge ${verdictData.class}`;
	verdictBadge.textContent = verdictData.text;

	if (analysis.scores.relevance !== undefined) {
		const relevanceScore = document.createElement("span");
		relevanceScore.className = "vp-relevance-badge";
		relevanceScore.style.color = getScoreColor(analysis.scores.relevance);
		relevanceScore.textContent = `${analysis.scores.relevance}% match`;
		compactHeader.appendChild(relevanceScore);
	}
	compactHeader.appendChild(verdictBadge);

	// Add political badge (shows quadrant or "Apolitical") if enabled
	if (settings.showPoliticalAnalysis !== false) {
		const politicalBadge = createPoliticalBadge(
			analysis.scores.politicalX,
			analysis.scores.politicalY,
			analysis.scores.hasPoliticalContent,
			analysis.perspective,
		);
		compactHeader.appendChild(politicalBadge);
	}

	const tags = document.createElement("div");
	tags.className = "vp-tags-compact";
	for (const tag of analysis.tags.slice(0, 4)) {
		const tagEl = document.createElement("span");
		tagEl.className = "vp-tag";
		tagEl.textContent = tag;
		tags.appendChild(tagEl);
	}

	const tabBar = document.createElement("div");
	tabBar.className = "vp-tab-bar";

	// Chapters: disabled only when explicitly empty array (not undefined = loading)
	const chaptersDisabled =
		analysis.keyPoints !== undefined && analysis.keyPoints.length === 0;

	// Build tabs conditionally based on settings
	const tabDefs: Array<{ id: string; label: string; disabled?: boolean }> = [
		{ id: "foryou", label: "For You" },
		{ id: "summary", label: "Summary" },
	];
	const tabPanels: Record<string, HTMLElement> = {
		foryou: buildForYouPanel(analysis),
		summary: buildSummaryPanel(analysis),
	};

	// Add chapters tab if enabled
	if (settings.showChapters !== false) {
		tabDefs.push({
			id: "chapters",
			label: "Chapters",
			disabled: chaptersDisabled,
		});
		tabPanels.chapters = buildChaptersPanel(analysis);
	}

	// Always show notes
	tabDefs.push({ id: "notes", label: "Notes" });
	tabPanels.notes = buildNotesPanel(state);

	// Add related tab if enabled
	if (settings.showRelatedContent !== false) {
		tabDefs.push({ id: "related", label: "Related" });
		tabPanels.related = buildRelatedPanel(state);
	}

	// Add analysis tab if enabled
	if (settings.showPoliticalAnalysis !== false) {
		tabDefs.push({ id: "analysis", label: "Analysis" });
		tabPanels.analysis = buildAnalysisPanel(analysis);
	}

	tabDefs.forEach((tab, index) => {
		const tabBtn = document.createElement("button");
		tabBtn.className =
			"vp-tab" +
			(index === 0 ? " vp-tab-active" : "") +
			(tab.disabled ? " vp-tab-disabled" : "");
		tabBtn.setAttribute("type", "button");
		tabBtn.textContent = tab.label;
		tabBtn.disabled = tab.disabled || false;
		tabBtn.dataset.tab = tab.id;

		tabBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (tab.disabled) return;
			for (const t of tabBar.querySelectorAll(".vp-tab")) {
				t.classList.remove("vp-tab-active");
			}
			tabBtn.classList.add("vp-tab-active");
			Object.entries(tabPanels).forEach(([id, panel]) => {
				panel.style.display = id === tab.id ? "block" : "none";
			});
		});
		tabBar.appendChild(tabBtn);
	});

	const tabContent = document.createElement("div");
	tabContent.className = "vp-tab-content";
	for (const panel of Object.values(tabPanels)) {
		tabContent.appendChild(panel);
	}

	content.appendChild(compactHeader);
	content.appendChild(tags);
	content.appendChild(tabBar);
	content.appendChild(tabContent);
	content.appendChild(createFeedbackButtons(state));

	const wrapper = document.createElement("div");
	wrapper.appendChild(content);
	return wrapper;
}

async function buildPanelContent(
	state: PanelState,
	currentFontSize: number,
): Promise<DocumentFragment> {
	const fragment = document.createDocumentFragment();
	fragment.appendChild(await buildHeader(state, currentFontSize));

	const content = document.createElement("div");
	content.className = "vp-content";

	if (state.status === "loading") {
		content.appendChild(buildLoadingContent());
	} else if (state.status === "no_key") {
		content.appendChild(buildNoKeyContent(state.videoId));
	} else if (state.status === "error") {
		content.appendChild(buildErrorContent(state.error, state.videoId));
	} else if (
		(state.status === "ready" || state.status === "partial") &&
		state.analysis
	) {
		const analysisContent = await buildAnalysisContent(state.analysis, state);
		while (analysisContent.firstChild) {
			content.appendChild(analysisContent.firstChild);
		}
	}

	fragment.appendChild(content);
	return fragment;
}

export function removePanel(): void {
	stopSessionTimer();
	document.getElementById(PANEL_ID)?.remove();
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

		const panel = document.createElement("div");
		panel.id = PANEL_ID;
		panel.className = `vidpulse-panel${isFloating ? " vidpulse-floating" : ""}`;
		applyFontSize(panel, fontSize);
		panel.appendChild(await buildPanelContent(stateWithFeedback, fontSize));

		startSessionTimer();

		if (isFloating) {
			const closeBtn = document.createElement("button");
			closeBtn.className = "vp-floating-close";
			closeBtn.setAttribute("type", "button");
			closeBtn.textContent = "\u2715";
			closeBtn.title = "Close panel";
			closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: var(--vp-text-muted, #aaa);
        z-index: 1;
      `;
			closeBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				removePanel();
			});
			panel.style.position = "relative";
			panel.insertBefore(closeBtn, panel.firstChild);
		}

		container.insertBefore(panel, container.firstChild);

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
