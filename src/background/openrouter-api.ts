// OpenRouter API wrapper
// - Video: Native @openrouter/sdk (for video_url support)
// - Text: Vercel AI SDK (cleaner API)

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OpenRouter } from "@openrouter/sdk";
import { generateText as aiGenerateText } from "ai";

// Native SDK client for video operations
function createNativeClient(apiKey: string): OpenRouter {
	return new OpenRouter({ apiKey });
}

// Video analysis - uses native SDK for video_url support
export async function generateFromVideo(
	apiKey: string,
	model: string,
	videoUrl: string,
	prompt: string,
): Promise<string> {
	const client = createNativeClient(apiKey);
	const response = await client.chat.send({
		model,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: prompt },
					{ type: "video_url", videoUrl: { url: videoUrl } },
				],
			},
		],
	});
	const content = response.choices?.[0]?.message?.content;
	// Content can be string or array of content items
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((item) => item.type === "text")
			.map((item) => ("text" in item ? item.text : ""))
			.join("");
	}
	return "";
}

// Text operations - uses Vercel AI SDK for cleaner API
export async function generateText(
	apiKey: string,
	model: string,
	prompt: string,
): Promise<string> {
	const openrouter = createOpenRouter({ apiKey });
	const result = await aiGenerateText({
		model: openrouter(model),
		prompt,
	});
	return result.text;
}
