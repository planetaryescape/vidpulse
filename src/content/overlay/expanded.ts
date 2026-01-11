// Expanded overlay panel: verdict, relevance score, all 5 score bars

import type { VideoAnalysis } from "../../shared/types";
import { createPoliticalBadge } from "../panel/political-badge";
import { OVERLAY_EXPANDED_ID } from "./constants";

const SCORE_LABELS: Record<string, string> = {
	productivity: "Productivity",
	educational: "Educational",
	entertainment: "Entertainment",
	inspiring: "Inspiring",
	creative: "Creative",
};

const SCORE_ORDER = [
	"productivity",
	"educational",
	"entertainment",
	"inspiring",
	"creative",
] as const;

export function createExpandedPanel(analysis: VideoAnalysis): HTMLElement {
	const panel = document.createElement("div");
	panel.id = OVERLAY_EXPANDED_ID;
	panel.className = "vp-overlay-expanded";

	// Header: verdict + relevance
	const header = document.createElement("div");
	header.className = "vp-overlay-exp-header";

	const verdictLabel = document.createElement("span");
	verdictLabel.className = `vp-overlay-exp-verdict vp-verdict-${analysis.verdict}`;
	verdictLabel.textContent = formatVerdict(analysis.verdict);
	header.appendChild(verdictLabel);

	if (
		analysis.scores.relevance !== undefined &&
		analysis.scores.relevance > 0
	) {
		const relevance = document.createElement("span");
		relevance.className = "vp-overlay-exp-relevance";
		relevance.textContent = `${analysis.scores.relevance}% match`;
		header.appendChild(relevance);
	}

	panel.appendChild(header);

	// Political badge (only if political data available)
	if (analysis.scores.hasPoliticalContent !== undefined) {
		const politicalRow = document.createElement("div");
		politicalRow.className = "vp-overlay-political";

		const badge = createPoliticalBadge(
			analysis.scores.politicalX,
			analysis.scores.politicalY,
			analysis.scores.hasPoliticalContent,
			analysis.perspective,
		);
		politicalRow.appendChild(badge);

		if (analysis.perspective && analysis.scores.hasPoliticalContent) {
			const perspectiveEl = document.createElement("span");
			perspectiveEl.className = "vp-overlay-perspective";
			perspectiveEl.textContent = analysis.perspective;
			politicalRow.appendChild(perspectiveEl);
		}

		panel.appendChild(politicalRow);
	}

	// Score bars
	const scoresContainer = document.createElement("div");
	scoresContainer.className = "vp-overlay-scores";

	for (const key of SCORE_ORDER) {
		const value = analysis.scores[key];
		const row = createScoreRow(SCORE_LABELS[key], value);
		scoresContainer.appendChild(row);
	}

	panel.appendChild(scoresContainer);

	return panel;
}

function createScoreRow(label: string, value: number): HTMLElement {
	const row = document.createElement("div");
	row.className = "vp-overlay-score-row";

	const labelEl = document.createElement("span");
	labelEl.className = "vp-overlay-score-label";
	labelEl.textContent = label;

	const barContainer = document.createElement("div");
	barContainer.className = "vp-overlay-score-bar";

	const barFill = document.createElement("div");
	barFill.className = "vp-overlay-score-fill";
	barFill.style.width = `${value}%`;
	barFill.style.backgroundColor = getScoreColor(value);

	const valueEl = document.createElement("span");
	valueEl.className = "vp-overlay-score-value";
	valueEl.textContent = String(value);

	barContainer.appendChild(barFill);
	row.appendChild(labelEl);
	row.appendChild(barContainer);
	row.appendChild(valueEl);

	return row;
}

function formatVerdict(verdict: VideoAnalysis["verdict"]): string {
	switch (verdict) {
		case "worth_it":
			return "WORTH IT";
		case "maybe":
			return "MAYBE";
		case "skip":
			return "SKIP";
	}
}

function getScoreColor(value: number): string {
	if (value >= 70) return "var(--vp-score-high, #22c55e)";
	if (value >= 40) return "var(--vp-score-mid, #eab308)";
	return "var(--vp-score-low, #ef4444)";
}
