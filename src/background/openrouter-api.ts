// OpenRouter API wrapper
// - Video: Native @openrouter/sdk (for video_url support)
// - Text: Vercel AI SDK (cleaner API)

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OpenRouter } from "@openrouter/sdk";
import {
	generateText as aiGenerateText,
	streamText as aiStreamText,
	type CoreMessage,
} from "ai";

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

// Streaming chat
export interface ChatStreamOptions {
	apiKey: string;
	model: string;
	systemPrompt: string;
	messages: CoreMessage[];
}

export async function* streamChat(options: ChatStreamOptions): AsyncGenerator<{
	type: "text" | "error" | "done";
	text?: string;
	error?: string;
}> {
	const { apiKey, model, systemPrompt, messages } = options;
	const openrouter = createOpenRouter({ apiKey });

	try {
		const result = aiStreamText({
			model: openrouter(model),
			system: systemPrompt,
			messages,
		});

		for await (const part of result.fullStream) {
			switch (part.type) {
				case "text-delta":
					yield { type: "text", text: part.text };
					break;
				case "error":
					yield {
						type: "error",
						error:
							part.error instanceof Error
								? part.error.message
								: "Unknown error",
					};
					break;
				case "finish":
					yield { type: "done" };
					break;
			}
		}
	} catch (error) {
		yield {
			type: "error",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
