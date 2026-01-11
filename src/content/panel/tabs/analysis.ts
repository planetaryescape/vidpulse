// Analysis tab - shows per-video political compass and perspective

import type { VideoAnalysis } from "../../../shared/types";
import { createMiniCompass, getPoliticalQuadrant } from "../political-badge";

export function buildAnalysisPanel(analysis: VideoAnalysis): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel vp-analysis-panel";
	panel.id = "analysis-panel";
	panel.style.display = "none";

	// hasPoliticalContent undefined = still loading
	const isLoading = analysis.scores.hasPoliticalContent === undefined;

	if (isLoading) {
		const loading = document.createElement("div");
		loading.className = "vp-analysis-loading";
		loading.textContent = "Loading perspective analysis...";
		panel.appendChild(loading);
		return panel;
	}

	// Political compass section
	const compassSection = document.createElement("div");
	compassSection.className = "vp-analysis-section";

	const compassTitle = document.createElement("h4");
	compassTitle.className = "vp-analysis-title";
	compassTitle.textContent = "Perspective Analysis";
	compassSection.appendChild(compassTitle);

	// Mini compass visualization
	const compass = createMiniCompass(
		analysis.scores.politicalX,
		analysis.scores.politicalY,
		analysis.scores.hasPoliticalContent,
		150,
	);
	compassSection.appendChild(compass);

	// Position description
	const positionDesc = document.createElement("p");
	positionDesc.className = "vp-analysis-desc";

	if (
		!analysis.scores.hasPoliticalContent ||
		analysis.scores.politicalX === undefined ||
		analysis.scores.politicalY === undefined
	) {
		positionDesc.textContent = "This video has neutral perspective.";
	} else {
		const quadrant = getPoliticalQuadrant(
			analysis.scores.politicalX,
			analysis.scores.politicalY,
		);
		positionDesc.textContent = `${quadrant.label} (${analysis.scores.politicalX}, ${analysis.scores.politicalY})`;
	}
	compassSection.appendChild(positionDesc);

	panel.appendChild(compassSection);

	// Perspective section (if available)
	if (analysis.perspective) {
		const perspectiveSection = document.createElement("div");
		perspectiveSection.className = "vp-analysis-section";

		const perspectiveTitle = document.createElement("h4");
		perspectiveTitle.className = "vp-analysis-title";
		perspectiveTitle.textContent = "Perspective";
		perspectiveSection.appendChild(perspectiveTitle);

		const perspectiveText = document.createElement("p");
		perspectiveText.className = "vp-analysis-perspective";
		perspectiveText.textContent = analysis.perspective;
		perspectiveSection.appendChild(perspectiveText);

		panel.appendChild(perspectiveSection);
	}

	// Confidence indicator (based on sample count if available)
	const confidenceSection = document.createElement("div");
	confidenceSection.className = "vp-analysis-section vp-analysis-confidence";

	const confidenceText = document.createElement("span");
	confidenceText.className = "vp-confidence-label";
	confidenceText.textContent = analysis.scores.hasPoliticalContent
		? "Analysis based on video content"
		: "No perspective markers detected";
	confidenceSection.appendChild(confidenceText);

	panel.appendChild(confidenceSection);

	return panel;
}
