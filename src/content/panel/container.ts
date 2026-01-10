import { queryFirst, YT_SELECTORS } from "../selectors";
import { FLOATING_CONTAINER_ID } from "./constants";

function createFloatingContainer(): Element {
	document.getElementById(FLOATING_CONTAINER_ID)?.remove();

	const container = document.createElement("div");
	container.id = FLOATING_CONTAINER_ID;
	container.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    width: 360px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    z-index: 9999;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  `;
	document.body.appendChild(container);
	return container;
}

export async function findOrCreateContainer(): Promise<{
	container: Element;
	isFloating: boolean;
}> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const el = queryFirst(YT_SELECTORS.SIDEBAR);
		if (el) {
			return { container: el, isFloating: false };
		}

		const delay = 500 * (attempt + 1);
		await new Promise((r) => setTimeout(r, delay));
	}

	return { container: createFloatingContainer(), isFloating: true };
}
