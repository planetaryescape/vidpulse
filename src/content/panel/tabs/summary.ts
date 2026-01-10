import type { VideoAnalysis } from "../../../shared/types";
import { createScoreBar } from "../score";

export function buildSummaryPanel(analysis: VideoAnalysis): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel";
	panel.style.display = "block";

	const summaryText = document.createElement("p");
	summaryText.className = "vp-summary";
	summaryText.textContent = analysis.summary;
	panel.appendChild(summaryText);

	const scores = document.createElement("div");
	scores.className = "vp-scores";
	scores.appendChild(
		createScoreBar("PRODUCTIVE", analysis.scores.productivity),
	);
	scores.appendChild(
		createScoreBar("EDUCATIONAL", analysis.scores.educational),
	);
	scores.appendChild(
		createScoreBar("ENTERTAINING", analysis.scores.entertainment),
	);
	scores.appendChild(createScoreBar("INSPIRING", analysis.scores.inspiring));
	scores.appendChild(createScoreBar("CREATIVE", analysis.scores.creative));
	panel.appendChild(scores);

	return panel;
}
