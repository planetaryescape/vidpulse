import type { VideoAnalysis } from "../../../../shared/types";
import { getPoliticalQuadrant, MiniCompass } from "../PoliticalBadge";

interface AnalysisPanelProps {
	analysis: VideoAnalysis;
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
	const isLoading = analysis.scores.hasPoliticalContent === undefined;

	if (isLoading) {
		return (
			<div className="vp-tab-panel vp-analysis-panel" id="analysis-panel">
				<div className="vp-analysis-loading">
					Loading perspective analysis...
				</div>
			</div>
		);
	}

	const hasPolitical = analysis.scores.hasPoliticalContent;
	const hasCoordinates =
		analysis.scores.politicalX !== undefined &&
		analysis.scores.politicalY !== undefined;

	let positionText = "This video has neutral perspective.";
	if (
		hasPolitical &&
		hasCoordinates &&
		analysis.scores.politicalX !== undefined &&
		analysis.scores.politicalY !== undefined
	) {
		const quadrant = getPoliticalQuadrant(
			analysis.scores.politicalX,
			analysis.scores.politicalY,
		);
		positionText = `${quadrant.label} (${analysis.scores.politicalX}, ${analysis.scores.politicalY})`;
	}

	return (
		<div className="vp-tab-panel vp-analysis-panel" id="analysis-panel">
			<div className="vp-analysis-section">
				<h4 className="vp-analysis-title">Perspective Analysis</h4>
				<MiniCompass
					politicalX={analysis.scores.politicalX}
					politicalY={analysis.scores.politicalY}
					hasPoliticalContent={analysis.scores.hasPoliticalContent}
					size={150}
				/>
				<p className="vp-analysis-desc">{positionText}</p>
			</div>

			{analysis.perspective && (
				<div className="vp-analysis-section">
					<h4 className="vp-analysis-title">Perspective</h4>
					<p className="vp-analysis-perspective">{analysis.perspective}</p>
				</div>
			)}

			<div className="vp-analysis-section vp-analysis-confidence">
				<span className="vp-confidence-label">
					{hasPolitical
						? "Analysis based on video content"
						: "No perspective markers detected"}
				</span>
			</div>
		</div>
	);
}
