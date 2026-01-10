// Blind spot analysis - detects narrow perspective consumption patterns
// Inspired by Ground News approach to showing missing viewpoints

import { getAllDailyStats } from "../shared/storage";
import type { BlindSpotAnalysis } from "../shared/types";

// Known perspective mappings for common topics
const PERSPECTIVE_MAPPINGS: Record<string, string[]> = {
	technology: [
		"startup founder",
		"enterprise",
		"academic",
		"consumer",
		"critical",
		"regulatory",
	],
	politics: [
		"progressive",
		"conservative",
		"libertarian",
		"centrist",
		"socialist",
		"populist",
	],
	economics: [
		"keynesian",
		"austrian",
		"monetarist",
		"marxist",
		"supply-side",
		"MMT",
	],
	business: [
		"entrepreneur",
		"corporate",
		"investor",
		"employee",
		"consumer",
		"regulator",
	],
	science: [
		"academic",
		"industry",
		"skeptic",
		"popularizer",
		"applied",
		"theoretical",
	],
	health: [
		"mainstream medical",
		"alternative",
		"preventive",
		"pharmaceutical",
		"holistic",
		"patient",
	],
	education: [
		"traditional",
		"progressive",
		"vocational",
		"self-directed",
		"institutional",
		"reform",
	],
	environment: [
		"activist",
		"industry",
		"scientific",
		"economic",
		"regulatory",
		"individual",
	],
};

const BLIND_SPOT_THRESHOLDS = {
	minVideosPerTopic: 8, // Alert after 8+ videos on same topic
	minPerspectives: 2, // Warn if <2 perspectives
	minTopicCoverage: 40, // Warn if <40% of available topics
};

interface TopicData {
	count: number;
	perspectives: Set<string>;
	tags: string[];
}

function _normalizeTag(tag: string): string {
	return tag.toLowerCase().trim();
}

function _mapTagToTopic(tag: string): string | null {
	const normalized = _normalizeTag(tag);

	// Direct matches
	for (const topic of Object.keys(PERSPECTIVE_MAPPINGS)) {
		if (normalized.includes(topic) || topic.includes(normalized)) {
			return topic;
		}
	}

	// Fuzzy matches
	const topicKeywords: Record<string, string[]> = {
		technology: [
			"tech",
			"software",
			"ai",
			"programming",
			"coding",
			"startup",
			"app",
		],
		politics: [
			"political",
			"election",
			"government",
			"policy",
			"democrat",
			"republican",
			"left",
			"right",
		],
		economics: [
			"economy",
			"finance",
			"money",
			"market",
			"inflation",
			"gdp",
			"trade",
		],
		business: [
			"entrepreneur",
			"company",
			"startup",
			"management",
			"leadership",
			"corporate",
		],
		science: [
			"research",
			"study",
			"experiment",
			"scientific",
			"physics",
			"biology",
			"chemistry",
		],
		health: [
			"medical",
			"wellness",
			"fitness",
			"diet",
			"mental health",
			"healthcare",
		],
		education: [
			"learning",
			"school",
			"university",
			"teaching",
			"course",
			"tutorial",
		],
		environment: [
			"climate",
			"sustainability",
			"green",
			"eco",
			"renewable",
			"pollution",
		],
	};

	for (const [topic, keywords] of Object.entries(topicKeywords)) {
		if (keywords.some((kw) => normalized.includes(kw))) {
			return topic;
		}
	}

	return null;
}

// Export for future use
export { _normalizeTag as normalizeTag, _mapTagToTopic as mapTagToTopic };

function suggestMissingPerspectives(
	topic: string,
	currentPerspectives: string[],
): string[] {
	const allPerspectives = PERSPECTIVE_MAPPINGS[topic] || [];
	const current = new Set(currentPerspectives.map((p) => p.toLowerCase()));

	return allPerspectives
		.filter((p) => !current.has(p.toLowerCase()))
		.slice(0, 3);
}

export async function analyzeBlindSpots(days = 30): Promise<BlindSpotAnalysis> {
	const allStatsRecord = await getAllDailyStats();
	const allStats = Object.values(allStatsRecord);

	// Filter to recent days
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - days);
	const cutoffStr = cutoffDate.toISOString().split("T")[0];

	const recentStats = allStats.filter((s) => s.date >= cutoffStr);

	// Aggregate topics and perspectives from tags
	const topicData: Record<string, TopicData> = {};

	for (const day of recentStats) {
		// Extract perspectives from watched video tags (stored in byCategory)
		// Note: This is a simplified approach - in production you'd want to
		// store per-video perspective data during analysis
		for (const category of Object.values(day.byCategory)) {
			if (category.count > 0) {
				// We don't have direct access to tags here, so we'll use
				// category names as a proxy for topics
				const topic = category.count > 0 ? "general" : null;
				if (topic && !topicData[topic]) {
					topicData[topic] = { count: 0, perspectives: new Set(), tags: [] };
				}
			}
		}
	}

	// Calculate narrow perspectives
	const narrowPerspectives: BlindSpotAnalysis["narrowPerspectives"] = [];

	for (const [topic, data] of Object.entries(topicData)) {
		if (data.count >= BLIND_SPOT_THRESHOLDS.minVideosPerTopic) {
			const perspectiveArray = Array.from(data.perspectives);
			if (perspectiveArray.length < BLIND_SPOT_THRESHOLDS.minPerspectives) {
				const missing = suggestMissingPerspectives(topic, perspectiveArray);
				if (missing.length > 0) {
					narrowPerspectives.push({
						topic,
						videoCount: data.count,
						perspectives:
							perspectiveArray.length > 0 ? perspectiveArray : ["unknown"],
						missing,
					});
				}
			}
		}
	}

	// Calculate topic coverage
	const totalPossibleTopics = Object.keys(PERSPECTIVE_MAPPINGS).length;
	const coveredTopics = Object.keys(topicData).filter(
		(t) => topicData[t].count >= 3, // At least 3 videos to count as "covered"
	).length;
	const topicCoverage = Math.round((coveredTopics / totalPossibleTopics) * 100);

	return {
		narrowPerspectives,
		topicCoverage,
		lastAnalyzed: Date.now(),
	};
}
