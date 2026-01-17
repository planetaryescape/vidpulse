import type { VideoAnalysis } from "../../../shared/types";

interface VerdictBadgeProps {
	verdict: VideoAnalysis["verdict"];
}

const VERDICT_DISPLAY: Record<
	VideoAnalysis["verdict"],
	{ text: string; className: string }
> = {
	worth_it: { text: "WORTH YOUR TIME", className: "verdict-worth" },
	maybe: { text: "MAYBE", className: "verdict-maybe" },
	skip: { text: "PROBABLY SKIP", className: "verdict-skip" },
};

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
	const { text, className } = VERDICT_DISPLAY[verdict];
	return <span className={`vp-verdict-badge ${className}`}>{text}</span>;
}
