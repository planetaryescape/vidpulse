import type { SessionData } from "../../shared/types";
import { getSession } from "../storage-proxy";
import { formatDuration } from "./utils";

export function getSessionStats(session: SessionData): {
	duration: string;
	videoCount: number;
	byCategory: Record<string, number>;
} {
	// Use accumulated watch time if available, otherwise fall back to wall clock
	const watchTimeMs = (session.totalWatchTime || 0) * 1000;
	const duration = formatDuration(
		watchTimeMs > 0 ? watchTimeMs : Date.now() - session.startTime,
	);
	const videoCount = session.videos.length;

	const byCategory: Record<string, number> = {
		educational: 0,
		entertainment: 0,
		productive: 0,
		inspiring: 0,
		creative: 0,
	};
	for (const video of session.videos) {
		if (video.scores) {
			const maxScore = Math.max(
				video.scores.productivity,
				video.scores.educational,
				video.scores.entertainment,
				video.scores.inspiring,
				video.scores.creative,
			);
			if (video.scores.educational === maxScore) byCategory.educational++;
			else if (video.scores.entertainment === maxScore)
				byCategory.entertainment++;
			else if (video.scores.inspiring === maxScore) byCategory.inspiring++;
			else if (video.scores.creative === maxScore) byCategory.creative++;
			else byCategory.productive++;
		}
	}

	return { duration, videoCount, byCategory };
}

let sessionTimerInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionTimer(): void {
	if (sessionTimerInterval) return;

	sessionTimerInterval = setInterval(async () => {
		const timerEl = document.querySelector(".vp-session-timer");
		if (!timerEl) return;

		const session = await getSession();
		if (session) {
			const stats = getSessionStats(session);
			timerEl.textContent = `${stats.duration} \u00B7 ${stats.videoCount} video${stats.videoCount !== 1 ? "s" : ""}`;
		}
	}, 10000);
}

export function stopSessionTimer(): void {
	if (sessionTimerInterval) {
		clearInterval(sessionTimerInterval);
		sessionTimerInterval = null;
	}
}
