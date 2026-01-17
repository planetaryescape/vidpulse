import { getCacheEntry } from "../../../shared/storage";
import type { ChatHistory, PanelState } from "../../../shared/types";
import { renderMarkdown } from "../markdown";
import { getVideoTitle } from "../video";

// Simplified stream part type (no tool calling for now)
interface ChatStreamPart {
	type: "text" | "error" | "done" | "ping";
	text?: string;
	error?: string;
}

// Storage proxy for content scripts - get chat history via background
async function getChatHistoryProxy(
	videoId: string,
): Promise<ChatHistory | null> {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage(
			{ type: "GET_CHAT_HISTORY", videoId },
			(response) => {
				if (chrome.runtime.lastError) {
					resolve(null);
					return;
				}
				resolve(response?.history || null);
			},
		);
	});
}

function addMessageToUI(
	container: HTMLElement,
	msg: { role: string; content: string },
): void {
	const el = document.createElement("div");
	el.className = `vp-chat-message vp-chat-${msg.role}`;

	const content = document.createElement("div");
	content.className = "vp-chat-content";

	// User messages use textContent, assistant messages use markdown renderer
	if (msg.role === "assistant") {
		renderMarkdown(content, msg.content);
	} else {
		content.textContent = msg.content;
	}
	el.appendChild(content);

	container.appendChild(el);
	scrollToBottom(container);
}

function createStreamingMessage(container: HTMLElement): HTMLElement {
	const el = document.createElement("div");
	el.className = "vp-chat-message vp-chat-assistant vp-chat-streaming";

	const content = document.createElement("div");
	content.className = "vp-chat-content";

	const cursor = document.createElement("span");
	cursor.className = "vp-chat-cursor";
	content.appendChild(cursor);

	el.appendChild(content);
	container.appendChild(el);
	return el;
}

function updateStreamingContent(messageEl: HTMLElement, text: string): void {
	const content = messageEl.querySelector(".vp-chat-content");
	if (content) {
		// Clear and re-render with markdown (XSS-safe via DOM methods)
		renderMarkdown(content as HTMLElement, text);

		const cursor = document.createElement("span");
		cursor.className = "vp-chat-cursor";
		content.appendChild(cursor);
	}
}

function showError(messageEl: HTMLElement, error: string): void {
	const content = messageEl.querySelector(".vp-chat-content");
	if (content) {
		content.textContent = "";
		const errorSpan = document.createElement("span");
		errorSpan.className = "vp-chat-error";
		errorSpan.textContent = `Error: ${error}`;
		content.appendChild(errorSpan);
	}
	messageEl.classList.remove("vp-chat-streaming");
}

function finalizeMessage(messageEl: HTMLElement, text: string): void {
	const content = messageEl.querySelector(".vp-chat-content");
	if (content) {
		renderMarkdown(content as HTMLElement, text);
	}
	messageEl.classList.remove("vp-chat-streaming");
}

function scrollToBottom(container: HTMLElement): void {
	container.scrollTop = container.scrollHeight;
}

async function loadChatHistory(
	videoId: string,
	container: HTMLElement,
): Promise<void> {
	const history = await getChatHistoryProxy(videoId);
	if (history?.messages) {
		for (const msg of history.messages) {
			addMessageToUI(container, msg);
		}
	}
}

export function buildChatPanel(state: PanelState): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "vp-tab-panel vp-chat-panel";
	panel.style.display = "none";

	// Messages container
	const messagesContainer = document.createElement("div");
	messagesContainer.className = "vp-chat-messages";

	// Empty state (built with DOM methods)
	const emptyState = document.createElement("div");
	emptyState.className = "vp-chat-empty";

	const emptyTitle = document.createElement("p");
	emptyTitle.textContent = "Ask anything about this video";
	emptyState.appendChild(emptyTitle);

	const emptyHint = document.createElement("p");
	emptyHint.className = "vp-chat-hint";
	emptyHint.textContent =
		"I can answer questions, explain concepts, or search the web for more info.";
	emptyState.appendChild(emptyHint);

	messagesContainer.appendChild(emptyState);

	// Input area
	const inputArea = document.createElement("div");
	inputArea.className = "vp-chat-input-area";

	const textarea = document.createElement("textarea");
	textarea.className = "vp-chat-input";
	textarea.placeholder = "Ask about this video...";
	textarea.rows = 1;

	const sendBtn = document.createElement("button");
	sendBtn.className = "vp-chat-send";
	sendBtn.textContent = "Send";
	sendBtn.type = "button";

	inputArea.appendChild(textarea);
	inputArea.appendChild(sendBtn);
	panel.appendChild(messagesContainer);
	panel.appendChild(inputArea);

	// Load history
	loadChatHistory(state.videoId, messagesContainer).then(() => {
		// Hide empty state if there are messages
		const messages = messagesContainer.querySelectorAll(".vp-chat-message");
		if (messages.length > 0) {
			emptyState.style.display = "none";
			scrollToBottom(messagesContainer);
		}
	});

	// Setup handlers
	setupChatHandlers(panel, state, messagesContainer, textarea, sendBtn);

	return panel;
}

function setupChatHandlers(
	_panel: HTMLElement,
	state: PanelState,
	messagesContainer: HTMLElement,
	textarea: HTMLTextAreaElement,
	sendBtn: HTMLButtonElement,
): void {
	let port: chrome.runtime.Port | null = null;
	let currentStreamEl: HTMLElement | null = null;
	let currentText = "";

	const enableInput = () => {
		textarea.disabled = false;
		sendBtn.disabled = false;
		textarea.focus();
	};

	const send = async () => {
		const message = textarea.value.trim();
		if (!message) return;

		// Disable input
		textarea.disabled = true;
		sendBtn.disabled = true;
		textarea.value = "";
		textarea.style.height = "auto";

		// Hide empty state
		const emptyState = messagesContainer.querySelector(".vp-chat-empty");
		if (emptyState) {
			(emptyState as HTMLElement).style.display = "none";
		}

		// Add user message to UI (safe: uses textContent)
		addMessageToUI(messagesContainer, { role: "user", content: message });

		// Get video content from cache
		const cache = await getCacheEntry(state.videoId);

		// Connect port
		port = chrome.runtime.connect({ name: "vidpulse-chat" });

		// Create streaming message element
		currentStreamEl = createStreamingMessage(messagesContainer);
		currentText = "";

		port.onMessage.addListener((part: ChatStreamPart) => {
			switch (part.type) {
				case "text":
					currentText += part.text || "";
					if (currentStreamEl) {
						updateStreamingContent(currentStreamEl, currentText);
					}
					scrollToBottom(messagesContainer);
					break;
				case "error":
					if (currentStreamEl) {
						showError(currentStreamEl, part.error || "Unknown error");
					}
					enableInput();
					break;
				case "done":
					if (currentStreamEl) {
						finalizeMessage(currentStreamEl, currentText);
					}
					enableInput();
					port?.disconnect();
					port = null;
					break;
				case "ping":
					// Keep-alive, ignore
					break;
			}
		});

		port.onDisconnect.addListener(() => {
			if (chrome.runtime.lastError && currentStreamEl) {
				showError(currentStreamEl, "Connection lost");
			}
			enableInput();
		});

		// Send request
		port.postMessage({
			type: "CHAT_START",
			videoId: state.videoId,
			message,
			videoContent: cache?.videoContent || "",
			analysis: state.analysis,
			videoTitle: getVideoTitle(),
		});
	};

	// Send on click
	sendBtn.addEventListener("click", send);

	// Send on Enter (Shift+Enter for newline)
	textarea.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	});

	// Auto-resize textarea
	textarea.addEventListener("input", () => {
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
	});
}
