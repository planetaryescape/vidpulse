import { MessageType, sendMessage } from "../../shared/messages";

export function buildLoadingContent(): HTMLElement {
	const loading = document.createElement("div");
	loading.className = "vp-loading";

	const spinner = document.createElement("div");
	spinner.className = "vp-spinner";

	const text = document.createElement("p");
	text.textContent = "Analyzing video...";

	const subtext = document.createElement("p");
	subtext.className = "vp-subtext";
	subtext.textContent = "Gemini is watching the video for you";

	loading.appendChild(spinner);
	loading.appendChild(text);
	loading.appendChild(subtext);
	return loading;
}

export function buildNoKeyContent(): HTMLElement {
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
	return noKey;
}

export function buildErrorContent(error?: string): HTMLElement {
	const errorEl = document.createElement("div");
	errorEl.className = "vp-error";

	const text = document.createElement("p");
	text.textContent = error || "Analysis failed";

	errorEl.appendChild(text);
	return errorEl;
}
