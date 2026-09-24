// YouTube transcript fetcher — service-worker safe (no DOMParser, no Node APIs)

export interface TranscriptSegment {
	text: string;
	start: number; // seconds
	duration: number; // seconds
}

export interface TranscriptResult {
	segments: TranscriptSegment[];
	fullText: string; // timestamped text for analysis
	language: string;
}

const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
};

function decodeEntities(text: string): string {
	return text
		.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m])
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/\n/g, " ")
		.trim();
}

function formatTimestamp(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

const MAX_TEXT_LENGTH = 50_000;

export async function fetchTranscript(
	videoId: string,
): Promise<TranscriptResult> {
	// 1. Fetch video page HTML
	const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
	const resp = await fetch(pageUrl, {
		headers: { "Accept-Language": "en-US,en;q=0.9" },
	});
	if (!resp.ok) throw new Error(`Failed to fetch video page: ${resp.status}`);
	const html = await resp.text();

	// 2. Extract captions config from ytInitialPlayerResponse
	const captionsMatch = html.match(
		/"captions"\s*:\s*(\{.*?"captionTracks"\s*:\s*\[.*?\].*?\})/s,
	);
	if (!captionsMatch) {
		throw new Error(
			"This video has no captions/transcript available. VidPulse cannot analyze videos without captions.",
		);
	}

	// Extract captionTracks array
	const tracksMatch = captionsMatch[1].match(
		/"captionTracks"\s*:\s*(\[.*?\])/s,
	);
	if (!tracksMatch) {
		throw new Error(
			"This video has no captions/transcript available. VidPulse cannot analyze videos without captions.",
		);
	}

	const tracks = JSON.parse(tracksMatch[1]) as Array<{
		baseUrl: string;
		languageCode: string;
		kind?: string;
	}>;

	if (!tracks.length) {
		throw new Error(
			"This video has no captions/transcript available. VidPulse cannot analyze videos without captions.",
		);
	}

	// 3. Select best track: English manual > English auto > first available
	const englishManual = tracks.find(
		(t) => t.languageCode === "en" && t.kind !== "asr",
	);
	const englishAuto = tracks.find((t) => t.languageCode === "en");
	const track = englishManual || englishAuto || tracks[0];

	// 4. Fetch caption XML
	const captionResp = await fetch(track.baseUrl);
	if (!captionResp.ok)
		throw new Error(`Failed to fetch captions: ${captionResp.status}`);
	const xml = await captionResp.text();

	// 5. Parse XML with regex (no DOMParser in service workers)
	const segmentRegex =
		/<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
	const segments: TranscriptSegment[] = [];

	for (
		let match = segmentRegex.exec(xml);
		match !== null;
		match = segmentRegex.exec(xml)
	) {
		segments.push({
			start: Number.parseFloat(match[1]),
			duration: Number.parseFloat(match[2]),
			text: decodeEntities(match[3]),
		});
	}

	if (!segments.length) {
		throw new Error("Failed to parse transcript segments");
	}

	// 6. Format as timestamped text
	let fullText = segments
		.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
		.join("\n");

	// 7. Truncate if too long (keep beginning + end for context)
	if (fullText.length > MAX_TEXT_LENGTH) {
		const half = Math.floor(MAX_TEXT_LENGTH / 2);
		fullText = `${fullText.slice(0, half)}\n\n[... transcript truncated ...]\n\n${fullText.slice(-half)}`;
	}

	return {
		segments,
		fullText,
		language: track.languageCode,
	};
}
