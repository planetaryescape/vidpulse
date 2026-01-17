import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import type {
	PanelState,
	Settings,
	VideoAnalysis,
} from "../../../shared/types";
import { getScoreColor } from "../../../shared/utils";
import { getIntentAlignment } from "../../intent";
import { getSession, getSettings } from "../../storage-proxy";
import { buildChannelBadge } from "../channel";
import { FeedbackButtons } from "./FeedbackButtons";
import { Header } from "./Header";
import { PoliticalBadge } from "./PoliticalBadge";
import { ErrorContent, LoadingContent, NoKeyContent } from "./StatusContent";
import { TabBar } from "./TabBar";
import { AnalysisPanel } from "./tabs/AnalysisPanel";
import { ChaptersPanel } from "./tabs/ChaptersPanel";
import { ChatPanel } from "./tabs/ChatPanel";
import { ForYouPanel } from "./tabs/ForYouPanel";
import { NotesPanel } from "./tabs/NotesPanel";
import { RelatedPanel } from "./tabs/RelatedPanel";
import { SummaryPanel } from "./tabs/SummaryPanel";
import { VerdictBadge } from "./VerdictBadge";

interface PanelProps {
	initialState: PanelState;
	fontSize: number;
	isFloating: boolean;
	onClose?: () => void;
}

// Keep track of active tab across re-renders
let persistedActiveTab: string | null = null;

export function Panel({
	initialState,
	fontSize,
	isFloating,
	onClose,
}: PanelProps) {
	const [state, setState] = useState<PanelState>(initialState);
	const [settings, setSettings] = useState<Settings | null>(null);
	const [activeTab, setActiveTab] = useState<string>(
		persistedActiveTab || "foryou",
	);
	const [intentMessage, setIntentMessage] = useState<{
		aligned: boolean;
		message: string;
	} | null>(null);
	const [channelBadgeEl, setChannelBadgeEl] = useState<HTMLElement | null>(
		null,
	);

	// Load settings and intent
	useEffect(() => {
		Promise.all([getSettings(), getSession()]).then(([sett, session]) => {
			setSettings(sett);
			if (
				session?.intent &&
				state.analysis &&
				(state.status === "ready" || state.status === "partial")
			) {
				const alignment = getIntentAlignment(
					session.intent,
					state.analysis.scores,
				);
				setIntentMessage(alignment);
			}
		});

		// Build channel badge asynchronously
		buildChannelBadge().then((el) => setChannelBadgeEl(el));
	}, [state.analysis, state.status]);

	// Persist active tab
	useEffect(() => {
		persistedActiveTab = activeTab;
	}, [activeTab]);

	const handleStateChange = useCallback((newState: PanelState) => {
		setState(newState);
	}, []);

	const handleRetrySuccess = useCallback(
		(analysis: unknown) => {
			setState({
				status: "ready",
				videoId: state.videoId,
				analysis: analysis as VideoAnalysis,
			});
		},
		[state.videoId],
	);

	const handleRetryError = useCallback(
		(error: string) => {
			setState({ status: "error", videoId: state.videoId, error });
		},
		[state.videoId],
	);

	// Build tabs based on settings and analysis
	const tabs = useMemo(() => {
		if (state.status !== "ready" && state.status !== "partial") return [];
		if (!state.analysis || !settings) return [];

		const chaptersDisabled =
			state.analysis.keyPoints !== undefined &&
			state.analysis.keyPoints.length === 0;

		const tabDefs: Array<{ id: string; label: string; disabled?: boolean }> = [
			{ id: "foryou", label: "For You" },
			{ id: "summary", label: "Summary" },
		];

		if (settings.showChapters !== false) {
			tabDefs.push({
				id: "chapters",
				label: "Chapters",
				disabled: chaptersDisabled,
			});
		}

		tabDefs.push({ id: "notes", label: "Notes" });
		tabDefs.push({ id: "chat", label: "Chat" });

		if (settings.showRelatedContent !== false) {
			tabDefs.push({ id: "related", label: "Related" });
		}

		if (settings.showPoliticalAnalysis !== false) {
			tabDefs.push({ id: "analysis", label: "Analysis" });
		}

		return tabDefs;
	}, [state.status, state.analysis, settings]);

	// Ensure activeTab is valid
	useEffect(() => {
		if (tabs.length > 0) {
			const validIds = tabs.filter((t) => !t.disabled).map((t) => t.id);
			if (!validIds.includes(activeTab)) {
				setActiveTab(validIds[0] || "foryou");
			}
		}
	}, [tabs, activeTab]);

	const renderContent = () => {
		if (state.status === "loading") {
			return <LoadingContent />;
		}

		if (state.status === "no_key") {
			return (
				<NoKeyContent
					videoId={state.videoId}
					onSuccess={handleRetrySuccess}
					onError={handleRetryError}
				/>
			);
		}

		if (state.status === "error") {
			return (
				<ErrorContent
					error={state.error}
					videoId={state.videoId}
					onSuccess={handleRetrySuccess}
					onError={handleRetryError}
				/>
			);
		}

		if (
			(state.status === "ready" || state.status === "partial") &&
			state.analysis
		) {
			return (
				<AnalysisContent
					state={state}
					settings={settings}
					tabs={tabs}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					intentMessage={intentMessage}
					channelBadgeEl={channelBadgeEl}
				/>
			);
		}

		return null;
	};

	return (
		<>
			{isFloating && onClose && (
				<button
					type="button"
					className="vp-floating-close"
					title="Close panel"
					style={{
						position: "absolute",
						top: "8px",
						right: "8px",
						background: "transparent",
						border: "none",
						fontSize: "16px",
						cursor: "pointer",
						color: "var(--vp-text-muted, #aaa)",
						zIndex: 1,
					}}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onClose();
					}}
				>
					{"\u2715"}
				</button>
			)}
			<Header
				state={state}
				fontSize={fontSize}
				onStateChange={handleStateChange}
			/>
			<div className="vp-content">{renderContent()}</div>
		</>
	);
}

interface ChannelBadgeContainerProps {
	badgeEl: HTMLElement | null;
}

function ChannelBadgeContainer({ badgeEl }: ChannelBadgeContainerProps) {
	const containerRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (containerRef.current && badgeEl) {
			// Clear any existing children and append the badge element
			while (containerRef.current.firstChild) {
				containerRef.current.removeChild(containerRef.current.firstChild);
			}
			containerRef.current.appendChild(badgeEl);
		}
	}, [badgeEl]);

	if (!badgeEl) return null;

	return <span ref={containerRef} />;
}

interface AnalysisContentProps {
	state: PanelState;
	settings: Settings | null;
	tabs: Array<{ id: string; label: string; disabled?: boolean }>;
	activeTab: string;
	onTabChange: (tabId: string) => void;
	intentMessage: { aligned: boolean; message: string } | null;
	channelBadgeEl: HTMLElement | null;
}

function AnalysisContent({
	state,
	settings,
	tabs,
	activeTab,
	onTabChange,
	intentMessage,
	channelBadgeEl,
}: AnalysisContentProps) {
	const analysis = state.analysis;
	if (!analysis) return null;

	const renderTabContent = () => {
		switch (activeTab) {
			case "foryou":
				return <ForYouPanel analysis={analysis} />;
			case "summary":
				return <SummaryPanel analysis={analysis} />;
			case "chapters":
				return <ChaptersPanel analysis={analysis} />;
			case "notes":
				return <NotesPanel videoId={state.videoId} />;
			case "chat":
				return <ChatPanel videoId={state.videoId} analysis={analysis} />;
			case "related":
				return <RelatedPanel videoId={state.videoId} analysis={analysis} />;
			case "analysis":
				return <AnalysisPanel analysis={analysis} />;
			default:
				return null;
		}
	};

	return (
		<>
			{intentMessage && (
				<div
					className={`vp-intent-badge ${intentMessage.aligned ? "aligned" : "misaligned"}`}
				>
					<span className="vp-intent-badge-icon">
						{intentMessage.aligned ? "\u2714" : "\u26A0"}
					</span>
					<span className="vp-intent-badge-text">{intentMessage.message}</span>
				</div>
			)}

			<div className="vp-compact-header">
				<ChannelBadgeContainer badgeEl={channelBadgeEl} />
				{analysis.scores.relevance !== undefined && (
					<span
						className="vp-relevance-badge"
						style={{ color: getScoreColor(analysis.scores.relevance) }}
					>
						{analysis.scores.relevance}% match
					</span>
				)}
				<VerdictBadge verdict={analysis.verdict} />
				{settings?.showPoliticalAnalysis !== false && (
					<PoliticalBadge
						politicalX={analysis.scores.politicalX}
						politicalY={analysis.scores.politicalY}
						hasPoliticalContent={analysis.scores.hasPoliticalContent}
						perspective={analysis.perspective}
					/>
				)}
			</div>

			<div className="vp-tags-compact">
				{analysis.tags.slice(0, 4).map((tag, index) => (
					<span key={index} className="vp-tag">
						{tag}
					</span>
				))}
			</div>

			<TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

			<div className="vp-tab-content">{renderTabContent()}</div>

			<FeedbackButtons
				videoId={state.videoId}
				analysis={analysis}
				userFeedback={state.userFeedback}
			/>
		</>
	);
}
