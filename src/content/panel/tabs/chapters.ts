import type { VideoAnalysis } from "../../../shared/types";
import { seekToTime } from "../video";

export function buildChaptersPanel(analysis: VideoAnalysis): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel";
	panel.style.display = "none";

	if (analysis.keyPoints && analysis.keyPoints.length > 0) {
		const keyPointsList = document.createElement("div");
		keyPointsList.className = "vp-keypoints-inline";

		for (const point of analysis.keyPoints) {
			const item = document.createElement("div");
			item.className = "vp-keypoint";

			const timestampBtn = document.createElement("button");
			timestampBtn.className = "vp-keypoint-time";
			timestampBtn.setAttribute("type", "button");
			timestampBtn.textContent = point.timestamp;
			timestampBtn.title = `Jump to ${point.timestamp}`;
			timestampBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				seekToTime(point.seconds);
			});

			const pointContent = document.createElement("div");
			pointContent.className = "vp-keypoint-content";

			const title = document.createElement("div");
			title.className = "vp-keypoint-title";
			title.textContent = point.title;

			const desc = document.createElement("div");
			desc.className = "vp-keypoint-desc";
			desc.textContent = point.description;

			pointContent.appendChild(title);
			pointContent.appendChild(desc);
			item.appendChild(timestampBtn);
			item.appendChild(pointContent);
			keyPointsList.appendChild(item);
		}
		panel.appendChild(keyPointsList);
	} else {
		const noChapters = document.createElement("p");
		noChapters.className = "vp-no-chapters";
		noChapters.textContent = "No chapter information available for this video.";
		panel.appendChild(noChapters);
	}

	return panel;
}
