import type {
	AnalyzeVideoResponse,
	CheckApiKeyResponse,
	CondenseMemoriesResponse,
	GetCachedResponse,
	GetLikedChannelsResponse,
	GetVideoFeedbackResponse,
	Message,
	OverrideStats,
	RegenerateAboutMeResponse,
	RegenerateVideoResponse,
	RemoveLikedChannelResponse,
	SearchRelatedContentResponse,
	StorageGetChannelStatsResponse,
	StorageGetFocusScheduleResponse,
	StorageGetOverrideStatsResponse,
	StorageGetSessionResponse,
	StorageGetSettingsResponse,
	StorageStartSessionResponse,
	SubmitFeedbackResponse,
	UpdateSubscriptionStatusResponse,
	ValidateApiKeyResponse,
} from "../shared/messages";
import { MessageType } from "../shared/messages";
import {
	addFeedback,
	addLikedChannel,
	addMemory,
	addVideoToSession,
	cleanupCache,
	clearVideoCache,
	endVideoInSession,
	getCached,
	getChannelStats,
	getFeedbackForVideo,
	getFocusSchedule,
	getLikedChannels,
	getMemories,
	getSession,
	getSettings,
	mergeMemorySource,
	migrateApiKeysToLocal,
	migrateModelIds,
	pauseFocusMode,
	removeLikedChannel,
	replaceMemories,
	saveSettings,
	setCache,
	setSessionIntent,
	startSession,
	updateChannelStats,
	updateDailyStats,
	updateLikedChannelSubscription,
	updateSessionActivity,
} from "../shared/storage";
import type {
	KeyPoint,
	MemoryEntry,
	RelatedContentCache,
	RelatedResource,
	Settings,
	VideoAnalysis,
} from "../shared/types";
import { debugLog } from "../shared/utils";
import {
	generateFromVideo,
	generateText as openrouterGenerateText,
} from "./openrouter-api";

// Run migrations on startup
migrateApiKeysToLocal().catch(() => {});
migrateModelIds().catch(() => {});

// Helper to extract JSON from response (handles markdown code blocks)
function extractJson(text: string): string {
	const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	return jsonMatch ? jsonMatch[1].trim() : text.trim();
}

// Retry with exponential backoff for API failures
async function withRetry<T>(
	fn: () => Promise<T>,
	options?: { retries?: number; delay?: number; backoff?: number },
): Promise<T> {
	const { retries = 3, delay = 1000, backoff = 2 } = options || {};

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === retries) throw error;

			// Rate limit (429) → longer backoff
			const isRateLimit =
				error instanceof Error &&
				(error.message.includes("429") || error.message.includes("rate"));

			const waitTime = isRateLimit
				? delay * backoff ** attempt * 2
				: delay * backoff ** attempt;

			await new Promise((r) => setTimeout(r, waitTime));
		}
	}
	throw new Error("Unreachable");
}

// Shared OpenRouter API helpers
async function generateText(
	apiKey: string,
	model: string,
	prompt: string,
): Promise<string> {
	return withRetry(async () => {
		return openrouterGenerateText(apiKey, model, prompt);
	});
}

async function generateJson<T>(
	apiKey: string,
	model: string,
	prompt: string,
	fallback: T,
): Promise<T> {
	const text = await generateText(apiKey, model, prompt);
	try {
		return JSON.parse(extractJson(text)) as T;
	} catch {
		return fallback;
	}
}

// Build memory context for prompts
function buildMemoryContext(memories: MemoryEntry[]): string {
	if (memories.length === 0) return "";

	const likes = memories.filter((m) => m.type === "like");
	const dislikes = memories.filter((m) => m.type === "dislike");

	const parts = ["\n\nLEARNED PREFERENCES:"];

	if (likes.length > 0) {
		parts.push(
			`\nThings user LIKES:\n- ${likes.map((m) => m.preference).join("\n- ")}`,
		);
	}

	if (dislikes.length > 0) {
		parts.push(
			"\nThings user DISLIKES:\n- " +
				dislikes.map((m) => m.preference).join("\n- "),
		);
	}

	return parts.join("");
}

async function readVideoContent(
	apiKey: string,
	settings: Settings,
	videoUrl: string,
): Promise<string> {
	const prompt = `Watch this video and provide a detailed description of its content.
Include:
- Main topics and themes covered
- Key points and arguments made
- Style and tone of presentation
- Target audience
- Any notable quotes or moments

Provide a thorough transcript-like description that captures the essence of the video.`;

	const text = await withRetry(
		async () =>
			generateFromVideo(apiKey, settings.models.videoReading, videoUrl, prompt),
		{ retries: 3, delay: 2000 },
	);

	if (!text) {
		throw new Error("Empty response from video reading");
	}

	return text;
}

async function generateSummary(
	apiKey: string,
	settings: Settings,
	content: string,
): Promise<string> {
	const prompt = `Based on this video content, write a 2-3 sentence summary that captures what the video is about. Focus on the main topic and value proposition.

VIDEO CONTENT:
${content}

Respond with ONLY the summary text, no formatting or labels.`;

	const result = await generateText(
		apiKey,
		settings.models.summarization,
		prompt,
	);
	return result || "Unable to generate summary.";
}

async function extractKeyPoints(
	apiKey: string,
	settings: Settings,
	content: string,
): Promise<KeyPoint[]> {
	const prompt = `Analyze this video content and extract the key sections/chapters with timestamps.

VIDEO CONTENT:
${content}

For each major section or topic transition, provide:
- The timestamp when it starts (MM:SS or HH:MM:SS format)
- A brief title (3-6 words)
- A detailed description (1-2 sentences) of what's covered

Respond with ONLY a valid JSON array:
[
  {
    "timestamp": "0:00",
    "seconds": 0,
    "title": "Introduction",
    "description": "Overview of what the video will cover and why it matters."
  },
  {
    "timestamp": "2:35",
    "seconds": 155,
    "title": "Main Topic",
    "description": "Detailed explanation of the core concept with examples."
  }
]

Extract 3-8 key points depending on video length and complexity.`;

	return generateJson<KeyPoint[]>(
		apiKey,
		settings.models.summarization,
		prompt,
		[],
	);
}

async function generateTags(
	apiKey: string,
	settings: Settings,
	content: string,
): Promise<string[]> {
	const prompt = `Based on this video content, generate up to 5 topic tags.
Use lowercase single words like: productivity, education, tech, business, lifestyle, entertainment, gaming, music, cooking, fitness, science, news, comedy, drama, vlog

VIDEO CONTENT:
${content}

Respond with ONLY a JSON array of tags, e.g.: ["tech", "productivity", "tutorial"]`;

	return generateJson<string[]>(apiKey, settings.models.tagGeneration, prompt, [
		"untagged",
	]);
}

interface AnalysisResult {
	scores: {
		productivity: number;
		entertainment: number;
		educational: number;
		inspiring: number;
		creative: number;
		relevance?: number;
	};
	verdict: "worth_it" | "maybe" | "skip";
	matchesInterests?: boolean;
	enjoymentConfidence?: number;
}

async function analyzeContent(
	apiKey: string,
	settings: Settings,
	content: string,
	memories: MemoryEntry[],
): Promise<AnalysisResult> {
	const hasPersonalization =
		settings.aboutMe && settings.aboutMe.trim().length > 0;
	const hasMemories = memories.length > 0;
	const hasPreferences = hasPersonalization || hasMemories;

	let prompt = `Analyze this video content and provide scores and a verdict.

VIDEO CONTENT:
${content}

Score from 0-100:
- productivity: How actionable and useful? Does it teach skills, provide tips?
- educational: How much learning value? Does it explain concepts?
- entertainment: How engaging and enjoyable? Well-produced, interesting?
- inspiring: How motivating? Does it inspire action, share success stories, encourage?
- creative: How artistic/creative? Does it showcase art, design, music, creative expression?`;

	if (hasPreferences) {
		prompt += `
- relevance: How relevant to user's interests?`;
	}

	if (hasMemories) {
		prompt += `
- enjoymentConfidence: 0-100, confidence user will enjoy based on learned preferences`;
	}

	if (hasPersonalization) {
		prompt += `

USER PROFILE:
${settings.aboutMe}`;
	}

	if (hasMemories) {
		prompt += buildMemoryContext(memories);
	}

	prompt += `

VERDICT RULES:
- "worth_it": highest score >= 65 AND another score >= 40
- "maybe": highest score >= 45
- "skip": otherwise

Respond with ONLY valid JSON:
{
  "scores": {
    "productivity": 0,
    "educational": 0,
    "entertainment": 0,
    "inspiring": 0,
    "creative": 0${hasPreferences ? ',\n    "relevance": 0' : ""}
  },
  "verdict": "worth_it"${hasPreferences ? ',\n  "matchesInterests": true' : ""}${hasMemories ? ',\n  "enjoymentConfidence": 50' : ""}
}`;

	const defaultResult: AnalysisResult = {
		scores: {
			productivity: 0,
			entertainment: 0,
			educational: 0,
			inspiring: 0,
			creative: 0,
		},
		verdict: "skip",
	};
	return generateJson<AnalysisResult>(
		apiKey,
		settings.models.transcriptAnalysis,
		prompt,
		defaultResult,
	);
}

async function generateReason(
	apiKey: string,
	settings: Settings,
	content: string,
	scores: AnalysisResult["scores"],
	verdict: AnalysisResult["verdict"],
	memories: MemoryEntry[],
): Promise<string> {
	const hasPersonalization =
		settings.aboutMe && settings.aboutMe.trim().length > 0;
	const hasMemories = memories.length > 0;
	const hasPreferences = hasPersonalization || hasMemories;

	let prompt = `Explain WHY this video is or isn't relevant to this specific user based on their preferences.

VIDEO TOPIC (brief):
${content.slice(0, 1000)}...

SCORES:
- Relevance to user: ${scores.relevance !== undefined ? scores.relevance : "N/A"}
- Productivity: ${scores.productivity}
- Educational: ${scores.educational}

VERDICT: ${verdict}`;

	if (hasPersonalization) {
		prompt += `

USER'S STATED INTERESTS:
${settings.aboutMe}`;
	}

	if (hasMemories) {
		prompt += buildMemoryContext(memories);
	}

	prompt += `

CRITICAL: Your response must explain how this video relates to the USER'S PREFERENCES above.
- DO NOT just describe what the video contains (they already know from the summary)
- DO explain how it connects to their stated interests or learned preferences
- Reference specific things from their profile or preferences
- Be personal: "This aligns with your interest in X" or "Unlike your preference for Y, this video..."

${verdict === "worth_it" ? "Explain which of their interests this serves." : ""}
${verdict === "skip" ? "Explain why this doesn't match what they typically enjoy or find valuable." : ""}
${verdict === "maybe" ? "Explain the partial match - what aligns and what doesn't." : ""}
${!hasPreferences ? "Note: No preferences set yet, so explain based on general quality/value." : ""}

Write 1-2 sentences. Be specific and personal. Respond with ONLY the explanation text.`;

	const result = await generateText(
		apiKey,
		settings.models.recommendationReasoning,
		prompt,
	);
	return result || "Unable to generate recommendation reason.";
}

interface ExtractedPreference {
	preference: string;
	confidence: number;
	extractedFrom: "summary" | "content" | "tags";
	timestampSeconds?: number;
}

async function extractPreferencesFromFeedback(
	apiKey: string,
	settings: Settings,
	feedback: "like" | "dislike",
	videoTitle: string,
	videoId: string,
	analysis: VideoAnalysis,
): Promise<MemoryEntry[]> {
	const keyPointsStr =
		analysis.keyPoints
			?.map((kp) => `[${kp.seconds}s] ${kp.title}`)
			.join(", ") || "none";
	const prompt = `The user ${feedback === "like" ? "LIKED" : "DISLIKED"} a video.

VIDEO TITLE: ${videoTitle}
SUMMARY: ${analysis.summary}
TAGS: ${analysis.tags.join(", ")}
SCORES: productivity=${analysis.scores.productivity}, educational=${analysis.scores.educational}, entertainment=${analysis.scores.entertainment}, inspiring=${analysis.scores.inspiring}, creative=${analysis.scores.creative}
KEY SECTIONS: ${keyPointsStr}

Based on this feedback, extract 1-3 specific preferences about what the user ${feedback === "like" ? "enjoys" : "dislikes"}.
Be specific - not just "likes tech" but "likes deep technical tutorials on system design".
If a preference relates to a specific section, include that section's timestamp.

Respond with ONLY a JSON array:
[
  {
    "preference": "specific preference description",
    "confidence": 0.8,
    "extractedFrom": "summary",
    "timestampSeconds": 120
  }
]

extractedFrom can be: "summary", "content", or "tags"
timestampSeconds is optional - include only if preference clearly relates to a specific section`;

	const extracted = await generateJson<ExtractedPreference[]>(
		apiKey,
		settings.models.memoryExtraction,
		prompt,
		[],
	);

	return extracted.map((e, i) => ({
		id: `${videoId}-${feedback}-${Date.now()}-${i}`,
		type: feedback,
		preference: e.preference,
		confidence: e.confidence,
		sources: [
			{
				videoId,
				videoTitle,
				timestamp: e.timestampSeconds,
				addedAt: Date.now(),
			},
		],
		extractedFrom: e.extractedFrom,
		createdAt: Date.now(),
	}));
}

// Synthesize aboutMe from manual preferences and learned memories
async function synthesizeAboutMe(
	apiKey: string,
	settings: Settings,
	memories: MemoryEntry[],
): Promise<string> {
	const hasManual = settings.manualPreferences?.trim().length > 0;
	const hasMemories = memories.length > 0;

	// No content to synthesize
	if (!hasManual && !hasMemories) return "";

	// Only manual preferences, no memories
	if (!hasMemories) return settings.manualPreferences || "";

	const likes = memories.filter((m) => m.type === "like");
	const dislikes = memories.filter((m) => m.type === "dislike");

	const prompt = `Synthesize a concise user profile from manual preferences and learned behaviors.

MANUAL PREFERENCES:
${settings.manualPreferences || "(none)"}

LEARNED LIKES:
${likes.map((m) => `- ${m.preference}`).join("\n") || "(none)"}

LEARNED DISLIKES:
${dislikes.map((m) => `- ${m.preference}`).join("\n") || "(none)"}

Write a cohesive 2-4 sentence profile that:
1. Keeps manual preferences as foundation
2. Adds learned patterns naturally
3. Removes redundancy
4. Stays specific, not generic

Respond with ONLY the profile text.`;

	return generateText(apiKey, settings.models.memoryExtraction, prompt);
}

// Check if a new preference is similar to existing ones
interface SimilarityResult {
	similarId: string | null;
	confidence: number;
	mergedPreference?: string;
}

async function checkPreferenceSimilarity(
	apiKey: string,
	settings: Settings,
	newPreference: string,
	existingPreferences: { id: string; preference: string }[],
): Promise<SimilarityResult> {
	if (existingPreferences.length === 0) {
		return { similarId: null, confidence: 0 };
	}

	const prompt = `Compare this new preference to existing ones. Find if any existing preference means essentially the same thing.

NEW: "${newPreference}"

EXISTING:
${existingPreferences.map((p) => `- [${p.id}] ${p.preference}`).join("\n")}

If you find a similar preference (>70% similar in meaning), respond with:
- similarId: the ID of the similar preference
- confidence: 0.7-1.0 based on how similar
- mergedPreference: a refined text that captures both preferences better

If no similar preference exists, respond with:
- similarId: null
- confidence: 0

Respond with ONLY valid JSON:
{"similarId": "the-id-or-null", "confidence": 0.8, "mergedPreference": "refined preference text"}`;

	return generateJson<SimilarityResult>(
		apiKey,
		settings.models.memoryExtraction,
		prompt,
		{ similarId: null, confidence: 0 },
	);
}

// Condense memories by grouping similar ones
async function condenseMemories(
	apiKey: string,
	settings: Settings,
	memories: MemoryEntry[],
): Promise<MemoryEntry[]> {
	if (memories.length <= 1) return memories;

	// Process likes and dislikes separately
	const likes = memories.filter((m) => m.type === "like");
	const dislikes = memories.filter((m) => m.type === "dislike");

	const condensedLikes = await findAndMergeSimilar(apiKey, settings, likes);
	const condensedDislikes = await findAndMergeSimilar(
		apiKey,
		settings,
		dislikes,
	);

	return [...condensedLikes, ...condensedDislikes];
}

async function findAndMergeSimilar(
	apiKey: string,
	settings: Settings,
	memories: MemoryEntry[],
): Promise<MemoryEntry[]> {
	if (memories.length <= 1) return memories;

	const prompt = `Group these preferences by similarity. Each group should contain preferences that mean essentially the same thing.

PREFERENCES:
${memories.map((m, i) => `${i}: ${m.preference}`).join("\n")}

Rules:
- Only group preferences with very similar meaning (>70% semantic similarity)
- Unique preferences should be in their own single-item group
- For each group with multiple items, provide a merged preference text that captures all of them better

Respond with ONLY valid JSON:
{
  "groups": [[0, 3], [1], [2, 4, 5]],
  "mergedTexts": {
    "0,3": "refined preference for group 0,3",
    "2,4,5": "refined preference for group 2,4,5"
  }
}`;

	interface GroupResult {
		groups: number[][];
		mergedTexts: Record<string, string>;
	}

	const result = await generateJson<GroupResult>(
		apiKey,
		settings.models.memoryExtraction,
		prompt,
		{ groups: memories.map((_, i) => [i]), mergedTexts: {} },
	);

	// Merge each group
	const condensed: MemoryEntry[] = [];
	for (const group of result.groups) {
		if (group.length === 0) continue;

		if (group.length === 1) {
			condensed.push(memories[group[0]]);
		} else {
			// Merge group into first entry
			const merged = { ...memories[group[0]] };
			merged.sources = [...merged.sources];

			// Get merged text if available
			const groupKey = group.join(",");
			if (result.mergedTexts[groupKey]) {
				merged.preference = result.mergedTexts[groupKey];
			}

			for (let i = 1; i < group.length; i++) {
				const other = memories[group[i]];
				// Add all sources from other memories
				for (const source of other.sources) {
					const exists = merged.sources.some(
						(s) => s.videoId === source.videoId,
					);
					if (!exists) {
						merged.sources.push(source);
					}
				}
				// Take higher confidence
				merged.confidence = Math.max(merged.confidence, other.confidence);
			}

			merged.updatedAt = Date.now();
			condensed.push(merged);
		}
	}

	return condensed;
}

async function analyzeVideo(videoUrl: string): Promise<VideoAnalysis> {
	const settings = await getSettings();

	if (!settings.apiKey) {
		throw new Error("API key not configured");
	}

	const apiKey = settings.apiKey;
	const memories = await getMemories();

	// Step 1: Read video content (multimodal)
	const content = await readVideoContent(apiKey, settings, videoUrl);

	// Step 2: Parallel text operations
	const [summary, tags, analysisResult, keyPoints] = await Promise.all([
		generateSummary(apiKey, settings, content),
		generateTags(apiKey, settings, content),
		analyzeContent(apiKey, settings, content, memories),
		extractKeyPoints(apiKey, settings, content),
	]);

	// Step 3: Generate reason (needs scores/verdict)
	const reason = await generateReason(
		apiKey,
		settings,
		content,
		analysisResult.scores,
		analysisResult.verdict,
		memories,
	);

	return {
		summary,
		reason,
		tags,
		scores: analysisResult.scores,
		verdict: analysisResult.verdict,
		matchesInterests: analysisResult.matchesInterests,
		enjoymentConfidence: analysisResult.enjoymentConfidence,
		keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
	};
}

// Brave Search - Related Web Content
const RELATED_CACHE_KEY = "vidpulse_related_cache";

function generateSearchQuery(summary: string, tags: string[]): string {
	// Extract key topic from first sentence of summary
	const topic = summary.split(".")[0].slice(0, 100);
	// Add top 2 tags for context
	const tagContext = tags.slice(0, 2).join(" ");
	return `${topic} ${tagContext} tutorial article guide`;
}

async function searchBrave(
	query: string,
	apiKey: string,
): Promise<RelatedResource[]> {
	const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;

	return withRetry(
		async () => {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					Accept: "application/json",
					"Accept-Encoding": "gzip",
					"X-Subscription-Token": apiKey,
				},
				credentials: "omit",
			});

			if (!response.ok) {
				throw new Error(`Brave Search failed: ${response.status}`);
			}

			const data = await response.json();

			if (!data.web?.results) {
				return [];
			}

			return data.web.results.map(
				(r: {
					title: string;
					url: string;
					description: string;
					profile?: { img?: string };
				}) => ({
					title: r.title,
					url: r.url,
					description: r.description || "",
					source: new URL(r.url).hostname.replace("www.", ""),
					favicon:
						r.profile?.img ||
						`https://www.google.com/s2/favicons?domain=${new URL(r.url).hostname}`,
				}),
			);
		},
		{ retries: 2, delay: 500 },
	);
}

async function getRelatedCache(
	videoId: string,
): Promise<RelatedContentCache | null> {
	const result = await chrome.storage.local.get(RELATED_CACHE_KEY);
	const cache = (result[RELATED_CACHE_KEY] || {}) as Record<
		string,
		RelatedContentCache
	>;
	const entry = cache[videoId];

	if (!entry) return null;

	// Expire after 7 days
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	if (Date.now() - entry.cachedAt > weekMs) {
		delete cache[videoId];
		await chrome.storage.local.set({ [RELATED_CACHE_KEY]: cache });
		return null;
	}

	return entry;
}

async function setRelatedCache(
	videoId: string,
	resources: RelatedResource[],
	searchQuery: string,
): Promise<void> {
	const result = await chrome.storage.local.get(RELATED_CACHE_KEY);
	const cache = (result[RELATED_CACHE_KEY] || {}) as Record<
		string,
		RelatedContentCache
	>;

	cache[videoId] = {
		videoId,
		resources,
		searchQuery,
		cachedAt: Date.now(),
	};

	// Limit cache size to 50 entries
	const keys = Object.keys(cache);
	if (keys.length > 50) {
		const oldest = keys.sort(
			(a, b) => cache[a].cachedAt - cache[b].cachedAt,
		)[0];
		delete cache[oldest];
	}

	await chrome.storage.local.set({ [RELATED_CACHE_KEY]: cache });
}

chrome.runtime.onMessage.addListener(
	(message: Message, _sender, sendResponse) => {
		(async () => {
			try {
				switch (message.type) {
					case MessageType.ANALYZE_VIDEO: {
						const { videoId, videoUrl } = message;

						// Check cache first
						const cached = await getCached(videoId);
						if (cached) {
							sendResponse({
								success: true,
								analysis: cached,
							} satisfies AnalyzeVideoResponse);
							return;
						}

						// Analyze video
						const analysis = await analyzeVideo(videoUrl);

						// Cache result
						await setCache(videoId, analysis);

						sendResponse({
							success: true,
							analysis,
						} satisfies AnalyzeVideoResponse);
						break;
					}

					case MessageType.CHECK_API_KEY: {
						const settings = await getSettings();
						if (!settings.apiKey) {
							sendResponse({ hasKey: false } satisfies CheckApiKeyResponse);
							break;
						}
						// Validate key actually works with OpenRouter
						try {
							await openrouterGenerateText(
								settings.apiKey,
								"google/gemini-3-flash-preview",
								"Say OK",
							);
							sendResponse({ hasKey: true } satisfies CheckApiKeyResponse);
						} catch {
							// Key exists but invalid - treat as no key
							sendResponse({
								hasKey: false,
								invalid: true,
							} satisfies CheckApiKeyResponse);
						}
						break;
					}

					case MessageType.VALIDATE_API_KEY: {
						const { apiKey } = message;
						try {
							await openrouterGenerateText(
								apiKey,
								"google/gemini-3-flash-preview",
								"Hi",
							);
							sendResponse({ valid: true } satisfies ValidateApiKeyResponse);
						} catch (error) {
							const errorMessage =
								error instanceof Error ? error.message : "Unknown error";
							// Show actual error to help user diagnose
							sendResponse({
								valid: false,
								error: errorMessage,
							} satisfies ValidateApiKeyResponse);
						}
						break;
					}

					case MessageType.VALIDATE_BRAVE_API_KEY: {
						const { apiKey } = message;
						try {
							const response = await fetch(
								"https://api.search.brave.com/res/v1/web/search?q=test&count=1",
								{
									headers: {
										Accept: "application/json",
										"X-Subscription-Token": apiKey,
									},
								},
							);
							if (response.ok) {
								sendResponse({
									valid: true,
								} satisfies ValidateApiKeyResponse);
							} else if (response.status === 401 || response.status === 403) {
								sendResponse({
									valid: false,
									error: "Invalid Brave API key",
								} satisfies ValidateApiKeyResponse);
							} else {
								sendResponse({
									valid: false,
									error: `Brave API error: ${response.status}`,
								} satisfies ValidateApiKeyResponse);
							}
						} catch {
							sendResponse({
								valid: false,
								error: "Network error - check connection",
							} satisfies ValidateApiKeyResponse);
						}
						break;
					}

					case MessageType.GET_CACHED: {
						const { videoId } = message;
						const cached = await getCached(videoId);
						sendResponse({
							cached: Boolean(cached),
							analysis: cached || undefined,
						} satisfies GetCachedResponse);
						break;
					}

					case MessageType.OPEN_OPTIONS: {
						chrome.runtime.openOptionsPage();
						sendResponse({ success: true });
						break;
					}

					case MessageType.SUBMIT_FEEDBACK: {
						const { videoId, videoTitle, feedback, analysis, channelInfo } =
							message;
						const settings = await getSettings();

						if (!settings.apiKey) {
							sendResponse({
								success: false,
								error: "API key not configured",
							} satisfies SubmitFeedbackResponse);
							return;
						}

						const apiKey = settings.apiKey;

						// Extract preferences from feedback
						const extractedMemories = await extractPreferencesFromFeedback(
							apiKey,
							settings,
							feedback,
							videoTitle,
							videoId,
							analysis,
						);

						// Get existing memories to check for similarity
						const existingMemories = await getMemories();
						const resultMemories: MemoryEntry[] = [];

						for (const newMem of extractedMemories) {
							// Only check same type (likes vs dislikes)
							const sameType = existingMemories.filter(
								(m) => m.type === newMem.type,
							);

							// Check for similar existing preference
							const similarity = await checkPreferenceSimilarity(
								apiKey,
								settings,
								newMem.preference,
								sameType.map((m) => ({ id: m.id, preference: m.preference })),
							);

							if (similarity.similarId && similarity.confidence >= 0.7) {
								// Merge into existing memory
								await mergeMemorySource(
									similarity.similarId,
									newMem.sources[0],
									newMem.confidence,
									similarity.mergedPreference,
								);
								// Return the merged memory info
								const mergedMem = existingMemories.find(
									(m) => m.id === similarity.similarId,
								);
								if (mergedMem) {
									resultMemories.push({
										...mergedMem,
										preference:
											similarity.mergedPreference || mergedMem.preference,
									});
								}
							} else {
								// Create new memory
								await addMemory(newMem);
								resultMemories.push(newMem);
							}
						}

						// Store feedback in history
						await addFeedback({
							videoId,
							videoTitle,
							feedback,
							analysis,
							timestamp: Date.now(),
						});

						// Track liked channel (only for likes)
						if (feedback === "like" && channelInfo) {
							await addLikedChannel(
								channelInfo.channelId,
								channelInfo.channelName,
								channelInfo.channelUrl,
								videoId,
								videoTitle,
								analysis.scores,
							);
						}

						sendResponse({
							success: true,
							memories: resultMemories,
						} satisfies SubmitFeedbackResponse);
						break;
					}

					case MessageType.GET_VIDEO_FEEDBACK: {
						const { videoId } = message;
						const feedback = await getFeedbackForVideo(videoId);
						sendResponse({
							hasFeedback: Boolean(feedback),
							feedback: feedback?.feedback,
						} satisfies GetVideoFeedbackResponse);
						break;
					}

					case MessageType.REGENERATE_VIDEO: {
						const { videoId, videoUrl } = message;

						// Clear existing cache
						await clearVideoCache(videoId);

						// Analyze fresh
						const analysis = await analyzeVideo(videoUrl);

						// Cache new result
						await setCache(videoId, analysis);

						sendResponse({
							success: true,
							analysis,
						} satisfies RegenerateVideoResponse);
						break;
					}

					// Storage proxy handlers for content scripts
					case MessageType.STORAGE_GET_SETTINGS: {
						const settings = await getSettings();
						sendResponse({ settings } satisfies StorageGetSettingsResponse);
						break;
					}

					case MessageType.STORAGE_GET_SESSION: {
						const session = await getSession();
						sendResponse({ session } satisfies StorageGetSessionResponse);
						break;
					}

					case MessageType.STORAGE_START_SESSION: {
						const session = await startSession();
						sendResponse({ session } satisfies StorageStartSessionResponse);
						break;
					}

					case MessageType.STORAGE_ADD_VIDEO_TO_SESSION: {
						const { video } = message;
						await addVideoToSession(video);
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_END_VIDEO_IN_SESSION: {
						const { videoId } = message;
						await endVideoInSession(videoId);
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_UPDATE_SESSION_ACTIVITY: {
						await updateSessionActivity();
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_SET_SESSION_INTENT: {
						const { intent } = message;
						await setSessionIntent(intent);
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_GET_CHANNEL_STATS: {
						const stats = await getChannelStats();
						sendResponse({ stats } satisfies StorageGetChannelStatsResponse);
						break;
					}

					case MessageType.STORAGE_UPDATE_CHANNEL_STATS: {
						const { channelId, channelName, scores } = message;
						await updateChannelStats(channelId, channelName, scores);
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_UPDATE_DAILY_STATS: {
						const { video } = message;
						await updateDailyStats(
							video.duration,
							video.scores,
							video.channelId,
						);
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_GET_FOCUS_SCHEDULE: {
						const schedule = await getFocusSchedule();
						sendResponse({
							schedule,
						} satisfies StorageGetFocusScheduleResponse);
						break;
					}

					case MessageType.STORAGE_PAUSE_FOCUS_MODE: {
						const { hours } = message;
						await pauseFocusMode(hours);
						sendResponse({ success: true });
						break;
					}

					case MessageType.STORAGE_GET_OVERRIDE_STATS: {
						const OVERRIDE_KEY = "vidpulse_overrides";
						const result = await chrome.storage.local.get(OVERRIDE_KEY);
						const stats = (result[OVERRIDE_KEY] as
							| OverrideStats
							| undefined) || { total: 0, thisWeek: 0, lastReset: Date.now() };

						// Reset weekly counter if needed
						const weekMs = 7 * 24 * 60 * 60 * 1000;
						if (Date.now() - stats.lastReset > weekMs) {
							stats.thisWeek = 0;
							stats.lastReset = Date.now();
							await chrome.storage.local.set({ [OVERRIDE_KEY]: stats });
						}

						sendResponse({ stats } satisfies StorageGetOverrideStatsResponse);
						break;
					}

					case MessageType.STORAGE_TRACK_OVERRIDE: {
						const OVERRIDE_KEY = "vidpulse_overrides";
						const result = await chrome.storage.local.get(OVERRIDE_KEY);
						const stats = (result[OVERRIDE_KEY] as
							| OverrideStats
							| undefined) || { total: 0, thisWeek: 0, lastReset: Date.now() };

						// Reset weekly counter if needed
						const weekMs = 7 * 24 * 60 * 60 * 1000;
						if (Date.now() - stats.lastReset > weekMs) {
							stats.thisWeek = 0;
							stats.lastReset = Date.now();
						}

						stats.total++;
						stats.thisWeek++;
						await chrome.storage.local.set({ [OVERRIDE_KEY]: stats });
						sendResponse({ success: true });
						break;
					}

					case MessageType.SEARCH_RELATED_CONTENT: {
						const { videoId, summary, tags } = message;
						const settings = await getSettings();

						if (!settings.braveApiKey) {
							sendResponse({
								success: false,
								error: "Brave API key not configured",
							} satisfies SearchRelatedContentResponse);
							return;
						}

						// Check cache first
						const cached = await getRelatedCache(videoId);
						if (cached) {
							sendResponse({
								success: true,
								resources: cached.resources,
							} satisfies SearchRelatedContentResponse);
							return;
						}

						const query = generateSearchQuery(summary, tags);
						const resources = await searchBrave(query, settings.braveApiKey);

						// Cache results
						await setRelatedCache(videoId, resources, query);

						sendResponse({
							success: true,
							resources,
						} satisfies SearchRelatedContentResponse);
						break;
					}

					case MessageType.REGENERATE_ABOUT_ME: {
						const settings = await getSettings();

						if (!settings.apiKey) {
							sendResponse({
								success: false,
								error: "API key not configured",
							} satisfies RegenerateAboutMeResponse);
							return;
						}

						const apiKey = settings.apiKey;
						const memories = await getMemories();

						try {
							const aboutMe = await synthesizeAboutMe(
								apiKey,
								settings,
								memories,
							);

							// Save with auto-generated flag
							await saveSettings({
								aboutMe,
								aboutMeAutoGenerated: true,
							});

							sendResponse({
								success: true,
								aboutMe,
							} satisfies RegenerateAboutMeResponse);
						} catch (error) {
							console.error("Failed to synthesize aboutMe:", error);
							sendResponse({
								success: false,
								error:
									error instanceof Error ? error.message : "Synthesis failed",
							} satisfies RegenerateAboutMeResponse);
						}
						break;
					}

					case MessageType.GET_LIKED_CHANNELS: {
						const channels = await getLikedChannels();
						const channelList = Object.values(channels).sort(
							(a, b) => b.lastLikedAt - a.lastLikedAt,
						);
						sendResponse({
							channels: channelList,
						} satisfies GetLikedChannelsResponse);
						break;
					}

					case MessageType.REMOVE_LIKED_CHANNEL: {
						const { channelId } = message;
						await removeLikedChannel(channelId);
						sendResponse({
							success: true,
						} satisfies RemoveLikedChannelResponse);
						break;
					}

					case MessageType.UPDATE_SUBSCRIPTION_STATUS: {
						const { channelId, status } = message;
						await updateLikedChannelSubscription(channelId, status);
						sendResponse({
							success: true,
						} satisfies UpdateSubscriptionStatusResponse);
						break;
					}

					case MessageType.CONDENSE_MEMORIES: {
						const settings = await getSettings();

						if (!settings.apiKey) {
							sendResponse({
								success: false,
								error: "API key not configured",
							} satisfies CondenseMemoriesResponse);
							return;
						}

						const apiKey = settings.apiKey;
						const memories = await getMemories();
						const beforeCount = memories.length;

						try {
							const condensed = await condenseMemories(
								apiKey,
								settings,
								memories,
							);
							await replaceMemories(condensed);

							sendResponse({
								success: true,
								before: beforeCount,
								after: condensed.length,
							} satisfies CondenseMemoriesResponse);
						} catch (error) {
							console.error("Failed to condense memories:", error);
							sendResponse({
								success: false,
								error:
									error instanceof Error ? error.message : "Condense failed",
							} satisfies CondenseMemoriesResponse);
						}
						break;
					}
				}
			} catch (error) {
				console.error("VidPulse background error:", error);
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				} satisfies AnalyzeVideoResponse);
			}
		})();

		// Return true to indicate async response
		return true;
	},
);

// Cleanup cache periodically
chrome.runtime.onStartup.addListener(() => {
	cleanupCache();
});

// Also cleanup when extension is installed/updated
chrome.runtime.onInstalled.addListener(async () => {
	cleanupCache();

	// Migration: initialize new fields for existing users
	const settings = await getSettings();
	if (settings.manualPreferences === undefined) {
		// First time: treat existing aboutMe as manual preferences
		await saveSettings({
			manualPreferences: settings.aboutMe || "",
			aboutMeAutoGenerated: false, // preserve existing as manual
		});
	}
});

// When user clicks extension icon, trigger re-detection on current tab
chrome.action.onClicked.addListener(async (tab) => {
	if (tab.id && tab.url?.includes("youtube.com")) {
		debugLog("Extension icon clicked, sending RE_DETECT to tab", tab.id);
		try {
			await chrome.tabs.sendMessage(tab.id, { type: "RE_DETECT" });
		} catch {
			// Content script not ready - likely tab opened before extension install/update
			// Reload the tab to trigger manifest-based injection
			debugLog("Content script not ready, reloading tab");
			chrome.tabs.reload(tab.id);
		}
	} else {
		// Not on YouTube, open options page
		chrome.runtime.openOptionsPage();
	}
});

debugLog("Background service worker loaded");
