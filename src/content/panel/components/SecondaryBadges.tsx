import { useEffect, useRef } from "preact/hooks";
import { getPoliticalQuadrant } from "./PoliticalBadge";

interface SecondaryBadgesProps {
	channelBadgeEl: HTMLElement | null;
	politicalX?: number;
	politicalY?: number;
	hasPoliticalContent?: boolean;
	showPolitical: boolean;
}

function ChannelBadgeSlot({ badgeEl }: { badgeEl: HTMLElement | null }) {
	const containerRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (containerRef.current && badgeEl) {
			while (containerRef.current.firstChild) {
				containerRef.current.removeChild(containerRef.current.firstChild);
			}
			containerRef.current.appendChild(badgeEl);
		}
	}, [badgeEl]);

	if (!badgeEl) return null;
	return <span ref={containerRef} className="vp-secondary-channel" />;
}

function PoliticalLabel({
	politicalX,
	politicalY,
	hasPoliticalContent,
}: {
	politicalX?: number;
	politicalY?: number;
	hasPoliticalContent?: boolean;
}) {
	if (
		!hasPoliticalContent ||
		politicalX === undefined ||
		politicalY === undefined
	) {
		return <span className="vp-secondary-political neutral">Neutral</span>;
	}

	const quadrant = getPoliticalQuadrant(politicalX, politicalY);
	return (
		<span
			className="vp-secondary-political"
			style={{ color: quadrant.color }}
			title={`${quadrant.label} (${politicalX}, ${politicalY})`}
		>
			{quadrant.label}
		</span>
	);
}

export function SecondaryBadges({
	channelBadgeEl,
	politicalX,
	politicalY,
	hasPoliticalContent,
	showPolitical,
}: SecondaryBadgesProps) {
	const hasChannel = channelBadgeEl !== null;
	const hasBoth = hasChannel && showPolitical;

	return (
		<div className="vp-secondary-badges">
			<ChannelBadgeSlot badgeEl={channelBadgeEl} />
			{hasBoth && <span className="vp-secondary-dot">{"\u00B7"}</span>}
			{showPolitical && (
				<PoliticalLabel
					politicalX={politicalX}
					politicalY={politicalY}
					hasPoliticalContent={hasPoliticalContent}
				/>
			)}
		</div>
	);
}
