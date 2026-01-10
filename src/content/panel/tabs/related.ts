import type { SearchRelatedContentResponse } from "../../../shared/messages";
import { MessageType, sendMessage } from "../../../shared/messages";
import type {
	PanelState,
	RelatedResource,
	VideoAnalysis,
} from "../../../shared/types";

function renderRelatedList(
	panel: HTMLElement,
	resources: RelatedResource[],
): void {
	while (panel.firstChild) {
		panel.removeChild(panel.firstChild);
	}

	if (resources.length === 0) {
		const empty = document.createElement("div");
		empty.className = "vp-related-empty";
		empty.textContent = "No related resources found";
		panel.appendChild(empty);
		return;
	}

	const list = document.createElement("div");
	list.className = "vp-related-list";

	for (const resource of resources) {
		const item = document.createElement("a");
		item.className = "vp-related-item";
		item.href = resource.url;
		item.target = "_blank";
		item.rel = "noopener";

		const favicon = document.createElement("img");
		favicon.className = "vp-related-favicon";
		favicon.src = resource.favicon || "";
		favicon.alt = "";
		favicon.onerror = () => {
			favicon.style.display = "none";
		};

		const content = document.createElement("div");
		content.className = "vp-related-content";

		const title = document.createElement("div");
		title.className = "vp-related-title";
		title.textContent = resource.title;

		const desc = document.createElement("div");
		desc.className = "vp-related-desc";
		const description = resource.description || "";
		desc.textContent =
			description.length > 120
				? `${description.slice(0, 120)}...`
				: description;

		const source = document.createElement("div");
		source.className = "vp-related-source";
		source.textContent = resource.source;

		content.appendChild(title);
		content.appendChild(desc);
		content.appendChild(source);

		item.appendChild(favicon);
		item.appendChild(content);
		list.appendChild(item);
	}

	panel.appendChild(list);
}

async function loadRelatedContent(
	panel: HTMLElement,
	videoId: string,
	analysis: VideoAnalysis,
): Promise<void> {
	try {
		const response = await sendMessage<SearchRelatedContentResponse>({
			type: MessageType.SEARCH_RELATED_CONTENT,
			videoId,
			summary: analysis.summary,
			tags: analysis.tags,
		});

		while (panel.firstChild) {
			panel.removeChild(panel.firstChild);
		}

		if (!response.success) {
			const errorEl = document.createElement("div");
			errorEl.className = "vp-related-empty";

			if (response.error?.includes("not configured")) {
				errorEl.textContent = "Brave API key not configured. ";
				const link = document.createElement("a");
				link.href = "#";
				link.textContent = "Open settings";
				link.addEventListener("click", (e) => {
					e.preventDefault();
					sendMessage({ type: MessageType.OPEN_OPTIONS });
				});
				errorEl.appendChild(link);
			} else {
				errorEl.textContent =
					response.error || "Failed to find related content";
			}

			panel.appendChild(errorEl);
			return;
		}

		renderRelatedList(panel, response.resources || []);
	} catch (_error) {
		while (panel.firstChild) {
			panel.removeChild(panel.firstChild);
		}

		const errorEl = document.createElement("div");
		errorEl.className = "vp-related-empty";
		errorEl.textContent = "Error loading related content";
		panel.appendChild(errorEl);
	}
}

export function buildRelatedPanel(state: PanelState): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel vp-related-panel";
	panel.style.display = "none";

	const loadingEl = document.createElement("div");
	loadingEl.className = "vp-related-loading";
	loadingEl.textContent = "Finding related resources...";
	panel.appendChild(loadingEl);

	if (state.analysis) {
		const analysis = state.analysis;
		setTimeout(() => loadRelatedContent(panel, state.videoId, analysis), 100);
	}

	return panel;
}
