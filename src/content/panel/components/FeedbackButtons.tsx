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

	const handleFeedback = async (type: "like" | "dislike") => {
		if (!analysis || isLoading) return;

		setIsLoading(true);

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
			}
		} catch {
			// Silently fail
		} finally {
			setIsLoading(false);
		}
	};

	const isDisabled = !!feedback || isLoading;

	return (
		<div className="vp-feedback-compact">
			<button
				type="button"
				className={`vp-feedback-icon-btn vp-like-icon-btn${feedback === "like" ? " active" : ""}`}
				title={feedback === "like" ? "Liked" : "I liked this video"}
				disabled={isDisabled}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleFeedback("like");
				}}
			>
				{"\uD83D\uDC4D"}
			</button>
			<button
				type="button"
				className={`vp-feedback-icon-btn vp-dislike-icon-btn${feedback === "dislike" ? " active" : ""}`}
				title={feedback === "dislike" ? "Skipped" : "I didn't like this video"}
				disabled={isDisabled}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleFeedback("dislike");
				}}
			>
				{"\uD83D\uDC4E"}
			</button>
		</div>
	);
}
