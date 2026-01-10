import type { SubmitFeedbackResponse } from "../../shared/messages";
import { MessageType, sendMessage } from "../../shared/messages";
import type { PanelState } from "../../shared/types";
import { getChannelInfo } from "./channel";
import { getVideoTitle } from "./video";

export function createFeedbackButtons(state: PanelState): HTMLElement {
	const container = document.createElement("div");
	container.className = "vp-feedback";

	const label = document.createElement("span");
	label.className = "vp-feedback-label";
	label.textContent = "Was this helpful?";

	const btnContainer = document.createElement("div");
	btnContainer.className = "vp-feedback-btns";

	const likeBtn = document.createElement("button");
	likeBtn.className = "vp-feedback-btn vp-like-btn";
	likeBtn.setAttribute("type", "button");
	likeBtn.title = "I liked this video";

	const likeIcon = document.createElement("span");
	likeIcon.className = "vp-feedback-icon";
	likeIcon.textContent = "\u2713";
	const likeText = document.createElement("span");
	likeText.className = "vp-feedback-text";
	likeText.textContent = "Liked";
	likeBtn.appendChild(likeIcon);
	likeBtn.appendChild(likeText);

	const dislikeBtn = document.createElement("button");
	dislikeBtn.className = "vp-feedback-btn vp-dislike-btn";
	dislikeBtn.setAttribute("type", "button");
	dislikeBtn.title = "I didn't like this video";

	const dislikeIcon = document.createElement("span");
	dislikeIcon.className = "vp-feedback-icon";
	dislikeIcon.textContent = "\u2717";
	const dislikeText = document.createElement("span");
	dislikeText.className = "vp-feedback-text";
	dislikeText.textContent = "Skip";
	dislikeBtn.appendChild(dislikeIcon);
	dislikeBtn.appendChild(dislikeText);

	if (state.userFeedback) {
		if (state.userFeedback === "like") {
			likeBtn.classList.add("vp-feedback-active");
		} else {
			dislikeBtn.classList.add("vp-feedback-active");
		}
		likeBtn.disabled = true;
		dislikeBtn.disabled = true;
		label.textContent = "Feedback saved!";
	}

	const handleFeedback = async (feedback: "like" | "dislike") => {
		if (!state.analysis) return;

		likeBtn.disabled = true;
		dislikeBtn.disabled = true;
		label.textContent = "Saving...";

		try {
			const channelInfo = getChannelInfo() || undefined;
			const response = await sendMessage<SubmitFeedbackResponse>({
				type: MessageType.SUBMIT_FEEDBACK,
				videoId: state.videoId,
				videoTitle: getVideoTitle(),
				feedback,
				analysis: state.analysis,
				channelInfo,
			});

			if (response.success) {
				if (feedback === "like") {
					likeBtn.classList.add("vp-feedback-active");
				} else {
					dislikeBtn.classList.add("vp-feedback-active");
				}
				label.textContent = "Feedback saved!";
			} else {
				label.textContent = "Failed to save";
				likeBtn.disabled = false;
				dislikeBtn.disabled = false;
			}
		} catch {
			label.textContent = "Failed to save";
			likeBtn.disabled = false;
			dislikeBtn.disabled = false;
		}
	};

	likeBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		handleFeedback("like");
	});

	dislikeBtn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		handleFeedback("dislike");
	});

	btnContainer.appendChild(likeBtn);
	btnContainer.appendChild(dislikeBtn);
	container.appendChild(label);
	container.appendChild(btnContainer);

	return container;
}
