interface PoliticalBadgeData {
	label: string;
	shortLabel: string;
	color: string;
	quadrant: string;
}

export function getPoliticalQuadrant(x: number, y: number): PoliticalBadgeData {
	const isNearCenter = Math.abs(x) <= 15 && Math.abs(y) <= 15;
	if (isNearCenter) {
		return {
			label: "Centrist",
			shortLabel: "C",
			color: "#6b7280",
			quadrant: "center",
		};
	}

	if (x < 0 && y > 0) {
		return {
			label: "Auth-Left",
			shortLabel: "AL",
			color: "#a855f7",
			quadrant: "auth-left",
		};
	}
	if (x >= 0 && y > 0) {
		return {
			label: "Auth-Right",
			shortLabel: "AR",
			color: "#3b82f6",
			quadrant: "auth-right",
		};
	}
	if (x < 0 && y <= 0) {
		return {
			label: "Lib-Left",
			shortLabel: "LL",
			color: "#22c55e",
			quadrant: "lib-left",
		};
	}
	return {
		label: "Lib-Right",
		shortLabel: "LR",
		color: "#f59e0b",
		quadrant: "lib-right",
	};
}

interface PoliticalBadgeProps {
	politicalX?: number;
	politicalY?: number;
	hasPoliticalContent?: boolean;
	perspective?: string;
}

export function PoliticalBadge({
	politicalX,
	politicalY,
	hasPoliticalContent,
	perspective,
}: PoliticalBadgeProps) {
	if (
		!hasPoliticalContent ||
		politicalX === undefined ||
		politicalY === undefined
	) {
		return (
			<span
				className="vp-political-badge vp-political-apolitical"
				title="This video has neutral perspective"
			>
				Neutral
			</span>
		);
	}

	const quadrant = getPoliticalQuadrant(politicalX, politicalY);
	const title = `${quadrant.label}${perspective ? ` - ${perspective}` : ""}\nPosition: (${politicalX}, ${politicalY})`;

	return (
		<span
			className={`vp-political-badge vp-political-${quadrant.quadrant}`}
			style={{ backgroundColor: quadrant.color }}
			title={title}
		>
			{quadrant.shortLabel}
		</span>
	);
}

interface MiniCompassProps {
	politicalX?: number;
	politicalY?: number;
	hasPoliticalContent?: boolean;
	size?: number;
}

export function MiniCompass({
	politicalX,
	politicalY,
	hasPoliticalContent,
	size = 120,
}: MiniCompassProps) {
	if (
		!hasPoliticalContent ||
		politicalX === undefined ||
		politicalY === undefined
	) {
		return (
			<div className="vp-mini-compass">
				<svg
					viewBox={`0 0 ${size} ${size}`}
					width={size}
					height={size}
					role="img"
					aria-label="Political compass showing neutral position"
				>
					<rect x="0" y="0" width={size} height={size} fill="#1f1f1f" rx="4" />
					<text
						x={size / 2}
						y={size / 2}
						fill="#666"
						fontSize="10"
						textAnchor="middle"
						dy="3"
					>
						Neutral
					</text>
				</svg>
			</div>
		);
	}

	const padding = 10;
	const range = size - 2 * padding;
	const dotX = padding + ((politicalX + 100) / 200) * range;
	const dotY = padding + ((100 - politicalY) / 200) * range;
	const center = size / 2;

	const quadrantColors = [
		{ x: padding, y: padding, color: "rgba(168, 85, 247, 0.2)" },
		{ x: center, y: padding, color: "rgba(59, 130, 246, 0.2)" },
		{ x: padding, y: center, color: "rgba(34, 197, 94, 0.2)" },
		{ x: center, y: center, color: "rgba(245, 158, 11, 0.2)" },
	];

	const labels = [
		{ x: padding + 2, y: center - 2, text: "L" },
		{ x: size - padding - 8, y: center - 2, text: "R" },
		{ x: center + 2, y: padding + 8, text: "A" },
		{ x: center + 2, y: size - padding - 2, text: "L" },
	];

	return (
		<div className="vp-mini-compass">
			<svg
				viewBox={`0 0 ${size} ${size}`}
				width={size}
				height={size}
				role="img"
				aria-label={`Political compass showing position at ${politicalX}, ${politicalY}`}
			>
				{quadrantColors.map((q, i) => (
					<rect
						key={i}
						x={q.x}
						y={q.y}
						width={range / 2}
						height={range / 2}
						fill={q.color}
					/>
				))}
				<line
					x1={center}
					y1={padding}
					x2={center}
					y2={size - padding}
					stroke="#3f3f3f"
					strokeWidth="1"
				/>
				<line
					x1={padding}
					y1={center}
					x2={size - padding}
					y2={center}
					stroke="#3f3f3f"
					strokeWidth="1"
				/>
				{labels.map((lbl, i) => (
					<text key={i} x={lbl.x} y={lbl.y} fill="#888" fontSize="8">
						{lbl.text}
					</text>
				))}
				<circle
					cx={dotX}
					cy={dotY}
					r="5"
					fill="#3ea6ff"
					stroke="#fff"
					strokeWidth="1.5"
				/>
			</svg>
		</div>
	);
}
