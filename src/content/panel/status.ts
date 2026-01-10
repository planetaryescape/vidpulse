import type { RegenerateVideoResponse } from "../../shared/messages";
import { MessageType, sendMessage } from "../../shared/messages";
import { injectPanel } from "./assembly";

export function buildLoadingContent(): HTMLElement {
	const loading = document.createElement("div");
	loading.className = "vp-loading";

	const spinner = document.createElement("div");
	spinner.className = "vp-spinner";

	const text = document.createElement("p");
	text.textContent = "Analyzing video...";

	const subtext = document.createElement("p");
	subtext.className = "vp-subtext";
	subtext.textContent = "AI is watching the video for you";

	loading.appendChild(spinner);
	loading.appendChild(text);
	loading.appendChild(subtext);
	return loading;
}

function createRetryButton(videoId: string): HTMLButtonElement {
	const retryBtn = document.createElement("button");
	retryBtn.className = "vp-setup-btn";
	retryBtn.setAttribute("type", "button");
	retryBtn.textContent = "Retry Analysis";
	retryBtn.addEventListener("click", async (e) => {
		e.preventDefault();
		e.stopPropagation();
		retryBtn.disabled = true;
		retryBtn.textContent = "Analyzing...";
		try {
			const response = await sendMessage<RegenerateVideoResponse>({
				type: MessageType.REGENERATE_VIDEO,
				videoId,
				videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
			});
			if (response.success && response.analysis) {
				await injectPanel({
					status: "ready",
					videoId,
					analysis: response.analysis,
				});
			} else {
				await injectPanel({
					status: "error",
					videoId,
					error: response.error || "Analysis failed",
				});
			}
		} catch (err) {
			await injectPanel({
				status: "error",
				videoId,
				error: err instanceof Error ? err.message : "Analysis failed",
			});
		}
	});
	return retryBtn;
}

export function buildNoKeyContent(videoId?: string): HTMLElement {
	const noKey = document.createElement("div");
	noKey.className = "vp-no-key";

	const text = document.createElement("p");
	text.textContent = "API key required";

	const btn = document.createElement("button");
	btn.className = "vp-setup-btn";
	btn.setAttribute("type", "button");
	btn.textContent = "Set up VidPulse";
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	});

	noKey.appendChild(text);
	noKey.appendChild(btn);

	if (videoId) {
		noKey.appendChild(createRetryButton(videoId));
	}

	return noKey;
}

export function buildErrorContent(
	error?: string,
	videoId?: string,
): HTMLElement {
	const errorEl = document.createElement("div");
	errorEl.className = "vp-error";

	const text = document.createElement("p");
	text.textContent = error || "Analysis failed";

	const btn = document.createElement("button");
	btn.className = "vp-setup-btn";
	btn.setAttribute("type", "button");
	btn.textContent = "Open Settings";
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	});

	errorEl.appendChild(text);
	errorEl.appendChild(btn);

	if (videoId) {
		errorEl.appendChild(createRetryButton(videoId));
	}

	return errorEl;
}
