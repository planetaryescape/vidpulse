import { FONT_SIZE_KEY } from "./constants";

export async function getFontSize(): Promise<number> {
	const result = await chrome.storage.sync.get(FONT_SIZE_KEY);
	return (result[FONT_SIZE_KEY] as number | undefined) || 1;
}

export async function saveFontSize(size: number): Promise<void> {
	await chrome.storage.sync.set({ [FONT_SIZE_KEY]: size });
}

export function applyFontSize(panel: HTMLElement, size: number): void {
	panel.style.setProperty("--vp-font-scale", String(size));
}
