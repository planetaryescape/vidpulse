import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isInFocusPeriod } from "./storage";

describe("isInFocusPeriod", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns false when disabled", () => {
		expect(
			isInFocusPeriod({
				enabled: false,
				periods: [],
				focusThreshold: 50,
				blockEntertainment: false,
			}),
		).toBe(false);
	});

	it("returns false when paused", () => {
		vi.setSystemTime(new Date("2026-01-10T10:00:00"));
		expect(
			isInFocusPeriod({
				enabled: true,
				periods: [{ days: [5], startHour: 9, endHour: 17 }],
				focusThreshold: 50,
				blockEntertainment: false,
				pausedUntil: Date.now() + 3600000,
			}),
		).toBe(false);
	});

	it("returns true when in period", () => {
		vi.setSystemTime(new Date("2026-01-10T10:00:00")); // Saturday
		expect(
			isInFocusPeriod({
				enabled: true,
				periods: [{ days: [6], startHour: 9, endHour: 17 }],
				focusThreshold: 50,
				blockEntertainment: false,
			}),
		).toBe(true);
	});

	it("returns false outside period hours", () => {
		vi.setSystemTime(new Date("2026-01-10T18:00:00")); // Saturday 6pm
		expect(
			isInFocusPeriod({
				enabled: true,
				periods: [{ days: [6], startHour: 9, endHour: 17 }],
				focusThreshold: 50,
				blockEntertainment: false,
			}),
		).toBe(false);
	});

	it("returns false on wrong day", () => {
		vi.setSystemTime(new Date("2026-01-11T10:00:00")); // Sunday
		expect(
			isInFocusPeriod({
				enabled: true,
				periods: [{ days: [6], startHour: 9, endHour: 17 }],
				focusThreshold: 50,
				blockEntertainment: false,
			}),
		).toBe(false);
	});

	it("returns true when pause has expired", () => {
		vi.setSystemTime(new Date("2026-01-10T10:00:00")); // Saturday
		expect(
			isInFocusPeriod({
				enabled: true,
				periods: [{ days: [6], startHour: 9, endHour: 17 }],
				focusThreshold: 50,
				blockEntertainment: false,
				pausedUntil: Date.now() - 1000, // pause expired 1 second ago
			}),
		).toBe(true);
	});
});
