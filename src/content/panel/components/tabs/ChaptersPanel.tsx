import type { VideoAnalysis } from "../../../../shared/types";
import { seekToTime } from "../../video";

interface ChaptersPanelProps {
	analysis: VideoAnalysis;
}

export function ChaptersPanel({ analysis }: ChaptersPanelProps) {
	if (analysis.keyPoints === undefined) {
		return (
			<div className="vp-tab-panel">
				<div className="vp-chapters-loading">Loading chapters...</div>
			</div>
		);
	}

	if (analysis.keyPoints.length === 0) {
		return (
			<div className="vp-tab-panel">
				<p className="vp-no-chapters">
					No chapter information available for this video.
				</p>
			</div>
		);
	}

	return (
		<div className="vp-tab-panel">
			<div className="vp-keypoints-inline">
				{analysis.keyPoints.map((point, index) => (
					<div key={index} className="vp-keypoint">
						<button
							type="button"
							className="vp-keypoint-time"
							title={`Jump to ${point.timestamp}`}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								seekToTime(point.seconds);
							}}
						>
							{point.timestamp}
						</button>
						<div className="vp-keypoint-content">
							<div className="vp-keypoint-title">{point.title}</div>
							<div className="vp-keypoint-desc">{point.description}</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
