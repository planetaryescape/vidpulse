import DOMPurify from "dompurify";
import { Marked } from "marked";
import { seekToTime } from "./video";

// Parse timestamp string to seconds (e.g., "2:30" -> 150, "1:02:34" -> 3754)
function parseTimestamp(ts: string): number {
	const parts = ts.split(":").map(Number);
	if (parts.length === 2) {
		return parts[0] * 60 + parts[1];
	}
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	}
	return 0;
}

// Custom extension for clickable timestamps [0:45], [2:30], [1:02:34]
const timestampExtension = {
	name: "timestamp",
	level: "inline" as const,
	start(src: string) {
		return src.match(/\[/)?.index;
	},
	tokenizer(src: string) {
		const match = src.match(/^\[(\d{1,2}(?::\d{2}){1,2})\]/);
		if (match) {
			return {
				type: "timestamp",
				raw: match[0],
				timestamp: match[1],
			};
		}
		return undefined;
	},
	renderer(token: { timestamp: string }) {
		const seconds = parseTimestamp(token.timestamp);
		return `<button type="button" class="vp-chat-timestamp" data-seconds="${seconds}">[${token.timestamp}]</button>`;
	},
};

const marked = new Marked({ extensions: [timestampExtension] });

// Configure DOMPurify to allow our timestamp buttons
DOMPurify.addHook("uponSanitizeElement", (node, data) => {
	if (data.tagName === "button" && node instanceof HTMLElement) {
		// Allow our timestamp buttons
		if (node.classList.contains("vp-chat-timestamp")) {
			return;
		}
	}
});

// Render markdown content to container with XSS protection via DOMPurify
export function renderMarkdown(container: HTMLElement, text: string): void {
	const rawHtml = marked.parse(text, { async: false }) as string;
	const sanitized = DOMPurify.sanitize(rawHtml, {
		ALLOWED_TAGS: [
			"p",
			"br",
			"strong",
			"em",
			"code",
			"pre",
			"ul",
			"ol",
			"li",
			"a",
			"button",
			"span",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"blockquote",
		],
		ALLOWED_ATTR: ["href", "target", "rel", "class", "type", "data-seconds"],
	});
	container.innerHTML = sanitized;

	// Attach click handlers to timestamps
	const buttons =
		container.querySelectorAll<HTMLButtonElement>(".vp-chat-timestamp");
	for (const btn of buttons) {
		const seconds = Number.parseInt(btn.dataset.seconds || "0", 10);
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			seekToTime(seconds);
		});
	}
}
