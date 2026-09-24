import { afterEach, describe, expect, it, vi } from "vitest";

type StorageAreaName = "local" | "sync" | "session";
type StorageChanges = Record<
	string,
	{
		oldValue?: unknown;
		newValue?: unknown;
	}
>;
type StorageChangeListener = (
	changes: StorageChanges,
	areaName: StorageAreaName,
) => void;

function cloneValue<T>(value: T): T {
	return value === undefined ? value : structuredClone(value);
}

function createStorageArea(
	store: Record<string, unknown>,
	areaName: StorageAreaName,
	listeners: StorageChangeListener[],
) {
	return {
		get: vi.fn(
			async (
				keys?: string | string[] | Record<string, unknown> | null,
			): Promise<Record<string, unknown>> => {
				if (keys == null) {
					return cloneValue(store);
				}

				if (typeof keys === "string") {
					return keys in store ? { [keys]: cloneValue(store[keys]) } : {};
				}

				if (Array.isArray(keys)) {
					const result: Record<string, unknown> = {};
					for (const key of keys) {
						if (key in store) {
							result[key] = cloneValue(store[key]);
						}
					}
					return result;
				}

				const result: Record<string, unknown> = {};
				for (const [key, defaultValue] of Object.entries(keys)) {
					result[key] = key in store ? cloneValue(store[key]) : defaultValue;
				}
				return result;
			},
		),
		set: vi.fn(async (items: Record<string, unknown>): Promise<void> => {
			const changes: StorageChanges = {};

			for (const [key, value] of Object.entries(items)) {
				const newValue = cloneValue(value);
				changes[key] = {
					oldValue: cloneValue(store[key]),
					newValue,
				};
				store[key] = newValue;
			}

			if (Object.keys(changes).length > 0) {
				for (const listener of listeners) {
					listener(changes, areaName);
				}
			}
		}),
		remove: vi.fn(async (keys: string | string[]): Promise<void> => {
			const keyList = Array.isArray(keys) ? keys : [keys];
			const changes: StorageChanges = {};

			for (const key of keyList) {
				if (!(key in store)) continue;
				changes[key] = {
					oldValue: cloneValue(store[key]),
					newValue: undefined,
				};
				delete store[key];
			}

			if (Object.keys(changes).length > 0) {
				for (const listener of listeners) {
					listener(changes, areaName);
				}
			}
		}),
		clear: vi.fn(async (): Promise<void> => {
			const changes: StorageChanges = {};

			for (const [key, value] of Object.entries(store)) {
				changes[key] = { oldValue: cloneValue(value), newValue: undefined };
				delete store[key];
			}

			if (Object.keys(changes).length > 0) {
				for (const listener of listeners) {
					listener(changes, areaName);
				}
			}
		}),
	};
}

function createChromeMock(): typeof chrome {
	const listeners: StorageChangeListener[] = [];
	const syncStore: Record<string, unknown> = {};
	const localStore: Record<string, unknown> = {};
	const sessionStore: Record<string, unknown> = {};

	return {
		storage: {
			onChanged: {
				addListener: vi.fn((listener: StorageChangeListener) => {
					listeners.push(listener);
				}),
			},
			sync: createStorageArea(syncStore, "sync", listeners),
			local: createStorageArea(localStore, "local", listeners),
			session: createStorageArea(sessionStore, "session", listeners),
		},
	} as unknown as typeof chrome;
}

describe("getSettings cache invalidation", () => {
	afterEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
	});

	it("refreshes cached API keys after local storage changes", async () => {
		const chromeMock = createChromeMock();
		vi.stubGlobal("chrome", chromeMock);

		const { getSettings } = await import("./storage");

		await chromeMock.storage.local.set({
			vidpulse_openrouter_keys: { apiKey: "old-key" },
		});
		expect((await getSettings()).apiKey).toBe("old-key");

		await chromeMock.storage.local.set({
			vidpulse_openrouter_keys: { apiKey: "new-key" },
		});
		expect((await getSettings()).apiKey).toBe("new-key");
	});

	it("refreshes cached synced settings after sync storage changes", async () => {
		const chromeMock = createChromeMock();
		vi.stubGlobal("chrome", chromeMock);

		const { getSettings } = await import("./storage");

		await chromeMock.storage.sync.set({
			settings: { cacheExpiry: 30 },
		});
		expect((await getSettings()).cacheExpiry).toBe(30);

		await chromeMock.storage.sync.set({
			settings: { cacheExpiry: 7 },
		});
		expect((await getSettings()).cacheExpiry).toBe(7);
	});
});
