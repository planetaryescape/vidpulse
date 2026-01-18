import type { VideoAnalysis } from "../../../shared/types";
import { getScoreColor } from "../../../shared/utils";

interface HeroVerdictProps {
	verdict: VideoAnalysis["verdict"];
	relevance?: number;
	intentMessage?: { aligned: boolean; message: string } | null;
}

const VERDICT_CONFIG: Record<
	VideoAnalysis["verdict"],
	{ text: string; icon: string; className: string }
> = {
	worth_it: { text: "WORTH YOUR TIME", icon: "\u2714", className: "worth" },
	maybe: { text: "MAYBE", icon: "\u2022", className: "maybe" },
	skip: { text: "PROBABLY SKIP", icon: "\u2717", className: "skip" },
};

export function HeroVerdict({
	verdict,
	relevance,
	intentMessage,
}: HeroVerdictProps) {
	const config = VERDICT_CONFIG[verdict];

	// Use intent icon if available, otherwise use verdict icon
	const icon =
		intentMessage !== undefined && intentMessage !== null
			? intentMessage.aligned
				? "\u2714"
				: "\u26A0"
			: config.icon;

	return (
		<div className={`vp-hero-verdict vp-hero-${config.className}`}>
			<div className="vp-hero-main">
				<span className="vp-hero-icon">{icon}</span>
				<span className="vp-hero-text">{config.text}</span>
			</div>
			{relevance !== undefined && (
				<span
					className="vp-hero-match"
					style={{ color: getScoreColor(relevance) }}
				>
					{relevance}% match
				</span>
			)}
		</div>
	);
}
