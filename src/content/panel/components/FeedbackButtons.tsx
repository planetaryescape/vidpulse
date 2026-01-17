import { useState } from "preact/hooks";
import type { SubmitFeedbackResponse } from "../../../shared/messages";
import { MessageType, sendMessage } from "../../../shared/messages";
import type { VideoAnalysis } from "../../../shared/types";
import { getChannelInfo } from "../channel";
import { getVideoTitle } from "../video";

interface FeedbackButtonsProps {
	videoId: string;
	analysis?: VideoAnalysis;
	userFeedback?: "like" | "dislike";
}

export function FeedbackButtons({
	videoId,
	analysis,
	userFeedback: initialFeedback,
}: FeedbackButtonsProps) {
	const [feedback, setFeedback] = useState<"like" | "dislike" | undefined>(
		initialFeedback,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [label, setLabel] = useState(
		initialFeedback ? "Feedback saved!" : "Was this helpful?",
	);

	const handleFeedback = async (type: "like" | "dislike") => {
		if (!analysis || isLoading) return;

		setIsLoading(true);
		setLabel("Saving...");

		try {
			const channelInfo = getChannelInfo() || undefined;
			const response = await sendMessage<SubmitFeedbackResponse>({
				type: MessageType.SUBMIT_FEEDBACK,
				videoId,
				videoTitle: getVideoTitle(),
				feedback: type,
				analysis,
				channelInfo,
			});

			if (response.success) {
				setFeedback(type);
				setLabel("Feedback saved!");
			} else {
				setLabel("Failed to save");
				setIsLoading(false);
			}
		} catch {
			setLabel("Failed to save");
			setIsLoading(false);
		}
	};

	const isDisabled = !!feedback || isLoading;

	return (
		<div className="vp-feedback">
			<span className="vp-feedback-label">{label}</span>
			<div className="vp-feedback-btns">
				<button
					type="button"
					className={`vp-feedback-btn vp-like-btn${feedback === "like" ? " vp-feedback-active" : ""}`}
					title="I liked this video"
					disabled={isDisabled}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleFeedback("like");
					}}
				>
					<span className="vp-feedback-icon">{"\u2713"}</span>
					<span className="vp-feedback-text">Liked</span>
				</button>
				<button
					type="button"
					className={`vp-feedback-btn vp-dislike-btn${feedback === "dislike" ? " vp-feedback-active" : ""}`}
					title="I didn't like this video"
					disabled={isDisabled}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleFeedback("dislike");
					}}
				>
					<span className="vp-feedback-icon">{"\u2717"}</span>
					<span className="vp-feedback-text">Skip</span>
				</button>
			</div>
		</div>
	);
}
