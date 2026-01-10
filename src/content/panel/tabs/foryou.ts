import type { VideoAnalysis } from "../../../shared/types";
import { getScoreColor } from "../../../shared/utils";

export function buildForYouPanel(analysis: VideoAnalysis): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel";
	panel.style.display = "none";

	if (analysis.reason) {
		const reasonText = document.createElement("p");
		reasonText.className = "vp-reason";
		reasonText.textContent = analysis.reason;
		panel.appendChild(reasonText);
	}

	if (analysis.matchesInterests !== undefined) {
		const interestBadge = document.createElement("div");
		interestBadge.className = analysis.matchesInterests
			? "vp-interest-match"
			: "vp-interest-mismatch";

		const interestText = document.createElement("span");
		interestText.textContent = analysis.matchesInterests
			? "Matches your interests"
			: "Outside your usual interests";
		interestBadge.appendChild(interestText);

		if (analysis.scores.relevance !== undefined) {
			const interestScore = document.createElement("span");
			interestScore.className = "vp-interest-score";
			interestScore.textContent = `${analysis.scores.relevance}%`;
			interestBadge.appendChild(interestScore);
		}
		panel.appendChild(interestBadge);
	}

	if (analysis.enjoymentConfidence !== undefined) {
		const confidenceSection = document.createElement("div");
		confidenceSection.className = "vp-confidence";

		const confidenceLabel = document.createElement("span");
		confidenceLabel.className = "vp-confidence-label";
		confidenceLabel.textContent = "Enjoyment Confidence";

		const confidenceValue = document.createElement("span");
		confidenceValue.className = "vp-confidence-value";
		confidenceValue.style.color = getScoreColor(analysis.enjoymentConfidence);
		confidenceValue.textContent = `${analysis.enjoymentConfidence}%`;

		confidenceSection.appendChild(confidenceLabel);
		confidenceSection.appendChild(confidenceValue);
		panel.appendChild(confidenceSection);
	}

	return panel;
}
