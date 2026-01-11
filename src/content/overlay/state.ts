// Overlay state management and panel sync

import type { PanelState } from "../../shared/types";

// Module state
let expanded = false;
let currentState: PanelState | null = null;

export function isExpanded(): boolean {
	return expanded;
}

export function setExpanded(value: boolean): void {
	expanded = value;
}

export function toggleExpanded(): boolean {
	expanded = !expanded;
	return expanded;
}

export function getState(): PanelState | null {
	return currentState;
}

export function setState(state: PanelState): void {
	currentState = state;
}

export function clearState(): void {
	currentState = null;
	expanded = false;
}

// Custom event for syncing feedback between overlay and panel
export const FEEDBACK_EVENT = "vidpulse:overlay-feedback";

export interface FeedbackEventDetail {
	feedback: "like" | "dislike";
	success: boolean;
}

export function dispatchFeedbackEvent(detail: FeedbackEventDetail): void {
	document.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail }));
}
