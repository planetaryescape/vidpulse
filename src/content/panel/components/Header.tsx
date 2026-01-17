import { useCallback, useEffect, useState } from "preact/hooks";
import type { RegenerateVideoResponse } from "../../../shared/messages";
import { MessageType, sendMessage } from "../../../shared/messages";
import type { PanelState, SessionData, Settings } from "../../../shared/types";
import { isFocusModeActive } from "../../guardian";
import { areMarkersVisible, setMarkersVisible } from "../../markers";
import { getSession, getSettings, pauseFocusMode } from "../../storage-proxy";
import {
	FONT_SIZE_STEP,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
	PANEL_ID,
} from "../constants";
import { applyFontSize, saveFontSize } from "../font-size";
import { getSessionStats } from "../session";

interface HeaderProps {
	state: PanelState;
	fontSize: number;
	onStateChange: (newState: PanelState) => void;
}

export function Header({ state, fontSize, onStateChange }: HeaderProps) {
	const [session, setSession] = useState<SessionData | null>(null);
	const [settings, setSettings] = useState<Settings | null>(null);
	const [focusActive, setFocusActive] = useState(false);
	const [currentFontSize, setCurrentFontSize] = useState(fontSize);
	const [markersVisible, setMarkersVisibleState] = useState(
		areMarkersVisible(),
	);
	const [isRegenerating, setIsRegenerating] = useState(false);

	useEffect(() => {
		Promise.all([getSession(), getSettings(), isFocusModeActive()]).then(
			([sess, sett, focus]) => {
				setSession(sess);
				setSettings(sett);
				setFocusActive(focus);
			},
		);
	}, []);

	const handleFontDecrease = useCallback(() => {
		const panel = document.getElementById(PANEL_ID);
		if (!panel) return;
		const newSize = Math.max(
			MIN_FONT_SIZE,
			Math.round((currentFontSize - FONT_SIZE_STEP) * 10) / 10,
		);
		saveFontSize(newSize);
		applyFontSize(panel, newSize);
		setCurrentFontSize(newSize);
	}, [currentFontSize]);

	const handleFontIncrease = useCallback(() => {
		const panel = document.getElementById(PANEL_ID);
		if (!panel) return;
		const newSize = Math.min(
			MAX_FONT_SIZE,
			Math.round((currentFontSize + FONT_SIZE_STEP) * 10) / 10,
		);
		saveFontSize(newSize);
		applyFontSize(panel, newSize);
		setCurrentFontSize(newSize);
	}, [currentFontSize]);

	const handleMarkersToggle = useCallback(() => {
		const newVisible = !markersVisible;
		setMarkersVisible(newVisible);
		setMarkersVisibleState(newVisible);
	}, [markersVisible]);

	const handleRegenerate = useCallback(async () => {
		if (isRegenerating) return;
		setIsRegenerating(true);

		onStateChange({ status: "loading", videoId: state.videoId });

		try {
			const response = await sendMessage<RegenerateVideoResponse>({
				type: MessageType.REGENERATE_VIDEO,
				videoId: state.videoId,
				videoUrl: `https://www.youtube.com/watch?v=${state.videoId}`,
			});

			if (response.success && response.analysis) {
				onStateChange({
					status: "ready",
					videoId: state.videoId,
					analysis: response.analysis,
				});
			} else {
				onStateChange({
					status: "error",
					videoId: state.videoId,
					error: response.error || "Failed to regenerate",
				});
			}
		} catch (err) {
			onStateChange({
				status: "error",
				videoId: state.videoId,
				error: err instanceof Error ? err.message : "Failed to regenerate",
			});
		}
		setIsRegenerating(false);
	}, [state.videoId, onStateChange, isRegenerating]);

	const handlePauseFocus = useCallback(async () => {
		await pauseFocusMode(1);
		setFocusActive(false);
	}, []);

	const handleOpenSettings = useCallback(() => {
		sendMessage({ type: MessageType.OPEN_OPTIONS });
	}, []);

	const sessionStats = session ? getSessionStats(session) : null;
	const showMarkersToggle =
		settings?.showTimelineMarkers &&
		(state.status === "ready" || state.status === "partial");
	const showRegenerate = state.status === "ready";

	return (
		<div className="vp-header">
			<div className="vp-logo-row">
				<span className="vp-logo">VIDPULSE</span>
				{sessionStats && (
					<span className="vp-session-timer">
						{sessionStats.duration} {"\u00B7"} {sessionStats.videoCount} video
						{sessionStats.videoCount !== 1 ? "s" : ""}
					</span>
				)}
				{focusActive && (
					<button
						type="button"
						className="vp-focus-badge"
						title="Focus mode active - click to pause for 1 hour"
						onClick={handlePauseFocus}
					>
						Focus
					</button>
				)}
			</div>
			<div className="vp-controls">
				<div className="vp-font-controls">
					<button
						type="button"
						className="vp-font-btn"
						title="Decrease text size"
						disabled={currentFontSize <= MIN_FONT_SIZE}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleFontDecrease();
						}}
					>
						A{"\u2212"}
					</button>
					<button
						type="button"
						className="vp-font-btn"
						title="Increase text size"
						disabled={currentFontSize >= MAX_FONT_SIZE}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleFontIncrease();
						}}
					>
						A+
					</button>
				</div>
				{showMarkersToggle && (
					<button
						type="button"
						className="vp-markers-btn"
						title={
							markersVisible ? "Hide timeline markers" : "Show timeline markers"
						}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleMarkersToggle();
						}}
					>
						{markersVisible ? "\u25CF" : "\u25CB"}
					</button>
				)}
				{showRegenerate && (
					<button
						type="button"
						className="vp-regenerate-btn"
						title="Regenerate analysis"
						disabled={isRegenerating}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleRegenerate();
						}}
					>
						{"\u21BB"}
					</button>
				)}
				<button
					type="button"
					className="vp-settings-btn"
					title="Settings"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleOpenSettings();
					}}
				>
					{"\u2699"}
				</button>
			</div>
		</div>
	);
}
