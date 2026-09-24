import { afterEach, describe, expect, it, vi } from "vitest";
import { validateApiKey } from "./openrouter-api";

describe("validateApiKey", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("accepts a key when the auth endpoint succeeds", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }))),
		);

		await expect(validateApiKey("sk-test")).resolves.toEqual({ valid: true });
	});

	it("marks 401 responses as auth errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(validateApiKey("sk-test")).resolves.toEqual({
			valid: false,
			authError: true,
			error: "Invalid OpenRouter API key",
		});
	});

	it("returns the upstream API error for non-auth failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
					status: 429,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(validateApiKey("sk-test")).resolves.toEqual({
			valid: false,
			error: "Rate limited",
		});
	});
});
