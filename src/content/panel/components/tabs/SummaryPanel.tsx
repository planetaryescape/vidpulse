import type { VideoAnalysis } from "../../../../shared/types";
import { ScoreBar } from "../ScoreBar";

interface SummaryPanelProps {
	analysis: VideoAnalysis;
}

export function SummaryPanel({ analysis }: SummaryPanelProps) {
	return (
		<div className="vp-tab-panel">
			<p className="vp-summary">{analysis.summary}</p>
			<div className="vp-scores">
				<ScoreBar label="PRODUCTIVE" score={analysis.scores.productivity} />
				<ScoreBar label="EDUCATIONAL" score={analysis.scores.educational} />
				<ScoreBar label="ENTERTAINING" score={analysis.scores.entertainment} />
				<ScoreBar label="INSPIRING" score={analysis.scores.inspiring} />
				<ScoreBar label="CREATIVE" score={analysis.scores.creative} />
			</div>
		</div>
	);
}
