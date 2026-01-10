import { describe, expect, it } from "vitest";
import { getScoreColor, getScoreLevel } from "./utils";

describe("getScoreLevel", () => {
	it("returns high for scores >= 70", () => {
		expect(getScoreLevel(70)).toBe("high");
		expect(getScoreLevel(100)).toBe("high");
	});

	it("returns mid for scores 40-69", () => {
		expect(getScoreLevel(40)).toBe("mid");
		expect(getScoreLevel(69)).toBe("mid");
	});

	it("returns low for scores < 40", () => {
		expect(getScoreLevel(39)).toBe("low");
		expect(getScoreLevel(0)).toBe("low");
	});
});

describe("getScoreColor", () => {
	it("returns CSS var based on level", () => {
		expect(getScoreColor(70)).toBe("var(--vp-score-high)");
		expect(getScoreColor(50)).toBe("var(--vp-score-mid)");
		expect(getScoreColor(30)).toBe("var(--vp-score-low)");
	});
});
