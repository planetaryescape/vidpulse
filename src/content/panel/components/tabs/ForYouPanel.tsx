import type { VideoAnalysis } from "../../../../shared/types";
import { getScoreColor } from "../../../../shared/utils";

interface ForYouPanelProps {
	analysis: VideoAnalysis;
}

export function ForYouPanel({ analysis }: ForYouPanelProps) {
	return (
		<div className="vp-tab-panel">
			{analysis.reason && <p className="vp-reason">{analysis.reason}</p>}

			{analysis.matchesInterests !== undefined && (
				<div
					className={
						analysis.matchesInterests
							? "vp-interest-match"
							: "vp-interest-mismatch"
					}
				>
					<span>
						{analysis.matchesInterests
							? "Matches your interests"
							: "Outside your usual interests"}
					</span>
					{analysis.scores.relevance !== undefined && (
						<span className="vp-interest-score">
							{analysis.scores.relevance}%
						</span>
					)}
				</div>
			)}

			{analysis.enjoymentConfidence !== undefined && (
				<div className="vp-confidence">
					<span className="vp-confidence-label">Enjoyment Confidence</span>
					<span
						className="vp-confidence-value"
						style={{ color: getScoreColor(analysis.enjoymentConfidence) }}
					>
						{analysis.enjoymentConfidence}%
					</span>
				</div>
			)}
		</div>
	);
}
