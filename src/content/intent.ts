import type { WatchIntent } from "../shared/types";
import { getSession, setSessionIntent } from "./storage-proxy";

const INTENT_OVERLAY_ID = "vidpulse-intent-overlay";
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

export function showIntentPrompt(
	onComplete: (intent: WatchIntent | null) => void,
): void {
	// Remove existing overlay if present
	dismissIntentPrompt();

	const overlay = document.createElement("div");
	overlay.id = INTENT_OVERLAY_ID;
	overlay.className = "vp-intent-overlay";

	const content = document.createElement("div");
	content.className = "vp-intent-content";

	const icon = document.createElement("div");
	icon.className = "vp-intent-icon";
	icon.textContent = "\uD83C\uDFAF"; // 🎯

	const title = document.createElement("h2");
	title.className = "vp-intent-title";
	title.textContent = "What's your goal?";

	const subtitle = document.createElement("p");
	subtitle.className = "vp-intent-subtitle";
	subtitle.textContent = "Set your intention for this session";

	const options = document.createElement("div");
	options.className = "vp-intent-options";

	const intents: { value: WatchIntent; label: string; emoji: string }[] = [
		{ value: "learning", label: "Learning", emoji: "\uD83D\uDCDA" }, // 📚
		{ value: "research", label: "Research", emoji: "\uD83D\uDD0D" }, // 🔍
		{ value: "relaxing", label: "Relaxing", emoji: "\uD83D\uDECB" }, // 🛋️
		{ value: "browsing", label: "Browsing", emoji: "\uD83C\uDF10" }, // 🌐
	];

	const selectIntent = async (intent: WatchIntent) => {
		await setSessionIntent(intent);
		dismissIntentPrompt();
		onComplete(intent);
	};

	for (const intent of intents) {
		const btn = document.createElement("button");
		btn.className = "vp-intent-btn";
		btn.setAttribute("type", "button");

		const emoji = document.createElement("span");
		emoji.className = "vp-intent-emoji";
		emoji.textContent = intent.emoji;

		const label = document.createElement("span");
		label.className = "vp-intent-label";
		label.textContent = intent.label;

		btn.appendChild(emoji);
		btn.appendChild(label);

		btn.addEventListener("click", () => selectIntent(intent.value));
		options.appendChild(btn);
	}

	const skipBtn = document.createElement("button");
	skipBtn.className = "vp-intent-skip";
	skipBtn.setAttribute("type", "button");
	skipBtn.textContent = "Skip";
	skipBtn.addEventListener("click", () => {
		dismissIntentPrompt();
		onComplete(null);
	});

	// Handle escape key
	keydownHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			dismissIntentPrompt();
			onComplete(null);
		}
	};
	document.addEventListener("keydown", keydownHandler);

	content.appendChild(icon);
	content.appendChild(title);
	content.appendChild(subtitle);
	content.appendChild(options);
	content.appendChild(skipBtn);

	overlay.appendChild(content);
	document.body.appendChild(overlay);
}

export function dismissIntentPrompt(): void {
	if (keydownHandler) {
		document.removeEventListener("keydown", keydownHandler);
		keydownHandler = null;
	}
	const overlay = document.getElementById(INTENT_OVERLAY_ID);
	if (overlay) {
		overlay.remove();
	}
}

export async function hasIntentSet(): Promise<boolean> {
	const session = await getSession();
	return !!session?.intent;
}

export function getIntentLabel(intent: WatchIntent): string {
	const labels: Record<WatchIntent, string> = {
		learning: "Learning",
		research: "Research",
		relaxing: "Relaxing",
		browsing: "Browsing",
	};
	return labels[intent] || intent;
}

export function getIntentAlignment(
	intent: WatchIntent,
	scores: { productivity: number; educational: number; entertainment: number },
): { aligned: boolean; message: string } {
	const { productivity, educational, entertainment } = scores;

	switch (intent) {
		case "learning":
			if (educational >= 60) {
				return { aligned: true, message: "Matches your learning intent" };
			}
			return { aligned: false, message: "Less educational than intended" };

		case "research":
			if (educational >= 50 || productivity >= 50) {
				return { aligned: true, message: "Matches your research intent" };
			}
			return {
				aligned: false,
				message: "Less research-oriented than intended",
			};

		case "relaxing":
			if (entertainment >= 50) {
				return { aligned: true, message: "Matches your relaxing intent" };
			}
			return { aligned: false, message: "More serious than intended" };

		case "browsing":
			// Browsing is intentionally low-commitment, always aligned
			return { aligned: true, message: "Just browsing" };

		default:
			return { aligned: true, message: "" };
	}
}
