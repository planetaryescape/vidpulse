// OpenRouter API wrapper — Vercel AI SDK

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
	generateText as aiGenerateText,
	streamText as aiStreamText,
	type CoreMessage,
} from "ai";

const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";

interface OpenRouterErrorBody {
	error?: { message?: string } | string;
	message?: string;
}

export interface ApiKeyValidationResult {
	valid: boolean;
	authError?: boolean;
	error?: string;
}

async function getOpenRouterErrorMessage(
	response: Response,
	fallback: string,
): Promise<string> {
	try {
		const body = (await response.json()) as OpenRouterErrorBody;
		if (typeof body.error === "string") {
			return body.error;
		}
		return body.error?.message || body.message || fallback;
	} catch {
		return fallback;
	}
}

export async function validateApiKey(
	apiKey: string,
): Promise<ApiKeyValidationResult> {
	try {
		const response = await fetch(OPENROUTER_KEY_URL, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (response.ok) {
			return { valid: true };
		}

		if (response.status === 401 || response.status === 403) {
			return {
				valid: false,
				authError: true,
				error: "Invalid OpenRouter API key",
			};
		}

		return {
			valid: false,
			error: await getOpenRouterErrorMessage(
				response,
				`OpenRouter API error: ${response.status}`,
			),
		};
	} catch {
		return {
			valid: false,
			error: "Network error - check connection",
		};
	}
}

// Text operations
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
