import type { VideoAnalysis } from "../../../../shared/types";

interface ForYouPanelProps {
	analysis: VideoAnalysis;
}

export function ForYouPanel({ analysis }: ForYouPanelProps) {
	return (
		<div className="vp-tab-panel">
			{analysis.reason && <p className="vp-reason">{analysis.reason}</p>}
		</div>
	);
}
