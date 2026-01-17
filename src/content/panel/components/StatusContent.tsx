import { useState } from "preact/hooks";
import type { RegenerateVideoResponse } from "../../../shared/messages";
import { MessageType, sendMessage } from "../../../shared/messages";

export function LoadingContent() {
	return (
		<div className="vp-loading">
			<div className="vp-spinner" />
			<p>Analyzing video...</p>
			<p className="vp-subtext">AI is watching the video for you</p>
		</div>
	);
}

interface RetryButtonProps {
	videoId: string;
	onSuccess: (analysis: unknown) => void;
	onError: (error: string) => void;
}

function RetryButton({ videoId, onSuccess, onError }: RetryButtonProps) {
	const [isRetrying, setIsRetrying] = useState(false);

	const handleRetry = async () => {
		setIsRetrying(true);
		try {
			const response = await sendMessage<RegenerateVideoResponse>({
				type: MessageType.REGENERATE_VIDEO,
				videoId,
				videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
			});
			if (response.success && response.analysis) {
				onSuccess(response.analysis);
			} else {
				onError(response.error || "Analysis failed");
			}
		} catch (err) {
			onError(err instanceof Error ? err.message : "Analysis failed");
		}
		setIsRetrying(false);
	};

	return (
		<button
			type="button"
			className="vp-setup-btn"
			disabled={isRetrying}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				handleRetry();
			}}
		>
			{isRetrying ? "Analyzing..." : "Retry Analysis"}
		</button>
	);
}

interface NoKeyContentProps {
	videoId?: string;
	onSuccess?: (analysis: unknown) => void;
	onError?: (error: string) => void;
}

export function NoKeyContent({
	videoId,
	onSuccess,
	onError,
}: NoKeyContentProps) {
	const handleOpenSettings = () => {
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	};

	return (
		<div className="vp-no-key">
			<p>API key required</p>
			<button
				type="button"
				className="vp-setup-btn"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleOpenSettings();
				}}
			>
				Set up VidPulse
			</button>
			{videoId && onSuccess && onError && (
				<RetryButton
					videoId={videoId}
					onSuccess={onSuccess}
					onError={onError}
				/>
			)}
		</div>
	);
}

interface ErrorContentProps {
	error?: string;
	videoId?: string;
	onSuccess?: (analysis: unknown) => void;
	onError?: (error: string) => void;
}

export function ErrorContent({
	error,
	videoId,
	onSuccess,
	onError,
}: ErrorContentProps) {
	const handleOpenSettings = () => {
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	};

	return (
		<div className="vp-error">
			<p>{error || "Analysis failed"}</p>
			<button
				type="button"
				className="vp-setup-btn"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					handleOpenSettings();
				}}
			>
				Open Settings
			</button>
			{videoId && onSuccess && onError && (
				<RetryButton
					videoId={videoId}
					onSuccess={onSuccess}
					onError={onError}
				/>
			)}
		</div>
	);
}
