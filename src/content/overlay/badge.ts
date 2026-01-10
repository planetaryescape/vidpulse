// Collapsed badge row: verdict icon + like/dislike buttons

import type { VideoAnalysis } from "../../shared/types";
import { OVERLAY_BADGE_ID } from "./constants";

export interface BadgeCallbacks {
	onToggle: () => void;
	onLike: () => void;
	onDislike: () => void;
}

export function createBadge(
	analysis: VideoAnalysis,
	userFeedback: "like" | "dislike" | undefined,
	callbacks: BadgeCallbacks,
): HTMLElement {
	const container = document.createElement("div");
	container.id = OVERLAY_BADGE_ID;
	container.className = "vp-overlay-badge-row";

	// Verdict icon
	const verdictBtn = document.createElement("button");
	verdictBtn.className = `vp-overlay-verdict-icon vp-verdict-${analysis.verdict}`;
	verdictBtn.title = "Click to expand details";
	verdictBtn.setAttribute("type", "button");

	const verdictIcon = getVerdictIcon(analysis.verdict);
	verdictBtn.textContent = verdictIcon;

	verdictBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		callbacks.onToggle();
	});

	// Feedback buttons
	const feedbackContainer = document.createElement("div");
	feedbackContainer.className = "vp-overlay-feedback-btns";

	const likeBtn = document.createElement("button");
	likeBtn.className = "vp-overlay-fb-btn vp-overlay-like";
	likeBtn.setAttribute("type", "button");
	likeBtn.title = "I liked this video";
	const likeIcon = document.createElement("span");
	likeIcon.className = "vp-overlay-fb-icon";
	likeIcon.textContent = "\u2713";
	likeBtn.appendChild(likeIcon);

	const dislikeBtn = document.createElement("button");
	dislikeBtn.className = "vp-overlay-fb-btn vp-overlay-dislike";
	dislikeBtn.setAttribute("type", "button");
	dislikeBtn.title = "I didn't like this video";
	const dislikeIcon = document.createElement("span");
	dislikeIcon.className = "vp-overlay-fb-icon";
	dislikeIcon.textContent = "\u2717";
	dislikeBtn.appendChild(dislikeIcon);

	// Set initial state based on existing feedback
	if (userFeedback) {
		likeBtn.disabled = true;
		dislikeBtn.disabled = true;
		if (userFeedback === "like") {
			likeBtn.classList.add("vp-overlay-fb-active");
		} else {
			dislikeBtn.classList.add("vp-overlay-fb-active");
		}
	}

	likeBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		callbacks.onLike();
	});

	dislikeBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		callbacks.onDislike();
	});

	feedbackContainer.appendChild(likeBtn);
	feedbackContainer.appendChild(dislikeBtn);

	container.appendChild(verdictBtn);
	container.appendChild(feedbackContainer);

	return container;
}

function getVerdictIcon(verdict: VideoAnalysis["verdict"]): string {
	switch (verdict) {
		case "worth_it":
			return "\u2714"; // heavy check mark
		case "maybe":
			return "?";
		case "skip":
			return "\u2716"; // heavy x
	}
}

// Update feedback button states after vote
export function updateBadgeFeedback(
	feedback: "like" | "dislike",
	success: boolean,
): void {
	const badge = document.getElementById(OVERLAY_BADGE_ID);
	if (!badge) return;

	const likeBtn = badge.querySelector(".vp-overlay-like") as HTMLButtonElement;
	const dislikeBtn = badge.querySelector(
		".vp-overlay-dislike",
	) as HTMLButtonElement;

	if (!likeBtn || !dislikeBtn) return;

	if (success) {
		likeBtn.disabled = true;
		dislikeBtn.disabled = true;
		if (feedback === "like") {
			likeBtn.classList.add("vp-overlay-fb-active");
		} else {
			dislikeBtn.classList.add("vp-overlay-fb-active");
		}
	}
}
