import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { getCacheEntry } from "../../../../shared/storage";
import type { ChatHistory, VideoAnalysis } from "../../../../shared/types";
import { renderMarkdown } from "../../markdown";
import { getVideoTitle } from "../../video";

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

interface ChatStreamPart {
	type: "text" | "error" | "done" | "ping";
	text?: string;
	error?: string;
}

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

// Renders markdown for assistant messages
function MessageContent({
	content,
	isAssistant,
}: {
	content: string;
	isAssistant: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current && isAssistant) {
			renderMarkdown(ref.current, content);
		}
	}, [content, isAssistant]);

	if (!isAssistant) {
		return <>{content}</>;
	}

	return <div ref={ref} />;
}

interface ChatPanelProps {
	videoId: string;
	analysis?: VideoAnalysis;
}

export function ChatPanel({ videoId, analysis }: ChatPanelProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streamingText, setStreamingText] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [isDisabled, setIsDisabled] = useState(false);

	const messagesRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const portRef = useRef<chrome.runtime.Port | null>(null);

	const scrollToBottom = useCallback(() => {
		if (messagesRef.current) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, []);

	// Load chat history
	useEffect(() => {
		getChatHistoryProxy(videoId).then((history) => {
			if (history?.messages) {
				setMessages(
					history.messages.map((m) => ({ role: m.role, content: m.content })),
				);
			}
		});
	}, [videoId]);

	// Scroll on new messages
	useEffect(() => {
		scrollToBottom();
	}, [messages, streamingText, scrollToBottom]);

	const autoResize = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
		}
	}, []);

	const send = async () => {
		const message = inputValue.trim();
		if (!message || isDisabled) return;

		setIsDisabled(true);
		setInputValue("");
		setError(null);
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		// Add user message
		setMessages((prev) => [...prev, { role: "user", content: message }]);

		// Get video content from cache
		const cache = await getCacheEntry(videoId);

		// Connect port
		const port = chrome.runtime.connect({ name: "vidpulse-chat" });
		portRef.current = port;

		setIsStreaming(true);
		setStreamingText("");

		let currentText = "";

		port.onMessage.addListener((part: ChatStreamPart) => {
			switch (part.type) {
				case "text":
					currentText += part.text || "";
					setStreamingText(currentText);
					break;
				case "error":
					setError(part.error || "Unknown error");
					setIsStreaming(false);
					setIsDisabled(false);
					break;
				case "done":
					setMessages((prev) => [
						...prev,
						{ role: "assistant", content: currentText },
					]);
					setStreamingText("");
					setIsStreaming(false);
					setIsDisabled(false);
					port.disconnect();
					portRef.current = null;
					break;
				case "ping":
					break;
			}
		});

		port.onDisconnect.addListener(() => {
			if (chrome.runtime.lastError && isStreaming) {
				setError("Connection lost");
				setIsStreaming(false);
			}
			setIsDisabled(false);
		});

		// Send request
		port.postMessage({
			type: "CHAT_START",
			videoId,
			message,
			videoContent: cache?.videoContent || "",
			analysis,
			videoTitle: getVideoTitle(),
		});
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	const showEmptyState = messages.length === 0 && !isStreaming;

	return (
		<div className="vp-tab-panel vp-chat-panel">
			<div className="vp-chat-messages" ref={messagesRef}>
				{showEmptyState && (
					<div className="vp-chat-empty">
						<p>Ask anything about this video</p>
						<p className="vp-chat-hint">
							I can answer questions, explain concepts, or search the web for
							more info.
						</p>
					</div>
				)}
				{messages.map((msg, index) => (
					<div key={index} className={`vp-chat-message vp-chat-${msg.role}`}>
						<div className="vp-chat-content">
							<MessageContent
								content={msg.content}
								isAssistant={msg.role === "assistant"}
							/>
						</div>
					</div>
				))}
				{isStreaming && (
					<div className="vp-chat-message vp-chat-assistant vp-chat-streaming">
						<div className="vp-chat-content">
							<MessageContent content={streamingText} isAssistant />
							<span className="vp-chat-cursor" />
						</div>
					</div>
				)}
				{error && !isStreaming && (
					<div className="vp-chat-message vp-chat-assistant">
						<div className="vp-chat-content">
							<span className="vp-chat-error">Error: {error}</span>
						</div>
					</div>
				)}
			</div>
			<div className="vp-chat-input-area">
				<textarea
					ref={textareaRef}
					className="vp-chat-input"
					placeholder="Ask about this video..."
					rows={1}
					value={inputValue}
					disabled={isDisabled}
					onInput={(e) => {
						setInputValue((e.target as HTMLTextAreaElement).value);
						autoResize();
					}}
					onKeyDown={handleKeyDown}
				/>
				<button
					type="button"
					className="vp-chat-send"
					disabled={isDisabled}
					onClick={send}
				>
					Send
				</button>
			</div>
		</div>
	);
}
