import { getScoreColor } from "../../../shared/utils";

interface ScoreBarProps {
	label: string;
	score: number;
}

export function ScoreBar({ label, score }: ScoreBarProps) {
	return (
		<div className="vp-score-row">
			<span className="vp-score-label">{label}</span>
			<div className="vp-score-bar">
				<div
					className="vp-score-fill"
					style={{
						width: `${score}%`,
						backgroundColor: getScoreColor(score),
					}}
				/>
			</div>
			<span className="vp-score-value">{score}</span>
		</div>
	);
}
