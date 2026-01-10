import { MessageType, sendMessage } from "../../shared/messages";
import type { ChannelStats } from "../../shared/types";
import { queryFirst, YT_SELECTORS } from "../selectors";
import { getChannelStats } from "../storage-proxy";

export function getChannelInfo(): {
	channelId: string;
	channelName: string;
	channelUrl: string;
} | null {
	const channelLink = queryFirst(
		YT_SELECTORS.CHANNEL_LINK,
	) as HTMLAnchorElement | null;
	if (channelLink) {
		const href = channelLink.href;
		const channelMatch = href.match(/\/(channel|c|user|@)\/([^/?]+)/);
		const channelId = channelMatch ? channelMatch[2] : href;
		const channelName = channelLink.textContent?.trim() || "Unknown Channel";
		return { channelId, channelName, channelUrl: href };
	}

	// Fallback: try meta tags
	const channelMeta = document.querySelector(
		YT_SELECTORS.CHANNEL_META,
	) as HTMLMetaElement | null;
	const nameMeta = document.querySelector(
		YT_SELECTORS.CHANNEL_NAME_META,
	) as HTMLLinkElement | null;
	if (channelMeta) {
		return {
			channelId: channelMeta.content,
			channelName: nameMeta?.getAttribute("content") || "Unknown Channel",
			channelUrl: "",
		};
	}

	return null;
}

export function getSubscriptionStatus():
	| "subscribed"
	| "not_subscribed"
	| "unknown" {
	const subscribeBtn = queryFirst(YT_SELECTORS.SUBSCRIBE_BTN);
	if (!subscribeBtn) return "unknown";

	const btnText = subscribeBtn.textContent?.toLowerCase() || "";
	const ariaLabel =
		subscribeBtn.getAttribute("aria-label")?.toLowerCase() || "";

	if (btnText.includes("subscribed") || ariaLabel.includes("subscribed")) {
		return "subscribed";
	}
	if (btnText.includes("subscribe") || ariaLabel.includes("subscribe")) {
		return "not_subscribed";
	}

	return "unknown";
}

export async function updateLikedChannelSubscriptionStatus(): Promise<void> {
	const channelInfo = getChannelInfo();
	if (!channelInfo) return;

	const status = getSubscriptionStatus();
	if (status === "unknown") return;

	try {
		await sendMessage({
			type: MessageType.UPDATE_SUBSCRIPTION_STATUS,
			channelId: channelInfo.channelId,
			status,
		});
	} catch {
		// Silently fail - not critical
	}
}

export function getChannelTrustBadge(stats: ChannelStats): {
	text: string;
	class: string;
} {
	const avgScore =
		(stats.avgScores.productivity +
			stats.avgScores.educational +
			stats.avgScores.entertainment +
			stats.avgScores.inspiring +
			stats.avgScores.creative) /
		5;
	if (stats.manualTrust === "trusted") {
		return { text: "Trusted", class: "vp-channel-trusted" };
	}
	if (stats.manualTrust === "blocked") {
		return { text: "Blocked", class: "vp-channel-blocked" };
	}
	if (avgScore >= 70) {
		return { text: "High quality", class: "vp-channel-high" };
	}
	if (avgScore >= 40) {
		return { text: "Mixed", class: "vp-channel-mixed" };
	}
	return { text: "Low quality", class: "vp-channel-low" };
}

export async function buildChannelBadge(): Promise<HTMLElement | null> {
	const channelInfo = getChannelInfo();
	if (!channelInfo) return null;

	const allStats = await getChannelStats();
	const stats = allStats[channelInfo.channelId];

	if (!stats || stats.videoCount < 2) return null;

	const badge = getChannelTrustBadge(stats);
	const container = document.createElement("div");
	container.className = "vp-channel-info";

	const badgeEl = document.createElement("span");
	badgeEl.className = `vp-channel-badge ${badge.class}`;
	badgeEl.textContent = badge.text;
	badgeEl.title = `Channel avg: ${Math.round((stats.avgScores.productivity + stats.avgScores.educational + stats.avgScores.entertainment + stats.avgScores.inspiring + stats.avgScores.creative) / 5)} (${stats.videoCount} videos)`;

	container.appendChild(badgeEl);
	return container;
}
