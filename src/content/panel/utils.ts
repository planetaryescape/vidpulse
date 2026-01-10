import type { VideoAnalysis } from "../../shared/types";

export function formatTimestamp(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	}
	return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

export function generateNoteId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getVerdictDisplay(verdict: VideoAnalysis["verdict"]): {
	text: string;
	class: string;
} {
	switch (verdict) {
		case "worth_it":
			return { text: "WORTH YOUR TIME", class: "verdict-worth" };
		case "maybe":
			return { text: "MAYBE", class: "verdict-maybe" };
		case "skip":
			return { text: "PROBABLY SKIP", class: "verdict-skip" };
	}
}
