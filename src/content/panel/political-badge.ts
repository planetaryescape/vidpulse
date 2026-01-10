// Political compass badge component
// Maps political coordinates to quadrant labels and colors (deterministic)

interface PoliticalBadgeData {
	label: string;
	shortLabel: string;
	color: string;
	quadrant: string;
}

// Deterministic mapping of coordinates to quadrant data
export function getPoliticalQuadrant(x: number, y: number): PoliticalBadgeData {
	// Center threshold: within -15 to 15 on both axes
	const isNearCenter = Math.abs(x) <= 15 && Math.abs(y) <= 15;
	if (isNearCenter) {
		return {
			label: "Centrist",
			shortLabel: "C",
			color: "#6b7280", // gray
			quadrant: "center",
		};
	}

	// Determine quadrant based on coordinates
	// X: negative = left, positive = right
	// Y: negative = libertarian, positive = authoritarian
	if (x < 0 && y > 0) {
		return {
			label: "Auth-Left",
			shortLabel: "AL",
			color: "#a855f7", // purple
			quadrant: "auth-left",
		};
	}
	if (x >= 0 && y > 0) {
		return {
			label: "Auth-Right",
			shortLabel: "AR",
			color: "#3b82f6", // blue
			quadrant: "auth-right",
		};
	}
	if (x < 0 && y <= 0) {
		return {
			label: "Lib-Left",
			shortLabel: "LL",
			color: "#22c55e", // green
			quadrant: "lib-left",
		};
	}
	// x >= 0 && y <= 0
	return {
		label: "Lib-Right",
		shortLabel: "LR",
		color: "#f59e0b", // yellow/amber
		quadrant: "lib-right",
	};
}

// Create political badge element for panel header
export function createPoliticalBadge(
	politicalX: number | undefined,
	politicalY: number | undefined,
	hasPoliticalContent: boolean | undefined,
	perspective?: string,
): HTMLElement {
	const badge = document.createElement("span");
	badge.className = "vp-political-badge";

	if (
		!hasPoliticalContent ||
		politicalX === undefined ||
		politicalY === undefined
	) {
		// Apolitical content
		badge.className += " vp-political-apolitical";
		badge.textContent = "Apolitical";
		badge.title = "This video does not contain political content";
		return badge;
	}

	const quadrant = getPoliticalQuadrant(politicalX, politicalY);
	badge.className += ` vp-political-${quadrant.quadrant}`;
	badge.textContent = quadrant.shortLabel;
	badge.style.backgroundColor = quadrant.color;
	badge.title = `${quadrant.label}${perspective ? ` - ${perspective}` : ""}\nPosition: (${politicalX}, ${politicalY})`;

	return badge;
}

// Create mini compass SVG for detailed view using safe DOM methods
export function createMiniCompass(
	politicalX: number | undefined,
	politicalY: number | undefined,
	hasPoliticalContent: boolean | undefined,
	size: number = 120,
): HTMLElement {
	const container = document.createElement("div");
	container.className = "vp-mini-compass";

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));

	if (
		!hasPoliticalContent ||
		politicalX === undefined ||
		politicalY === undefined
	) {
		// No political content - show placeholder
		const rect = document.createElementNS(svgNS, "rect");
		rect.setAttribute("x", "0");
		rect.setAttribute("y", "0");
		rect.setAttribute("width", String(size));
		rect.setAttribute("height", String(size));
		rect.setAttribute("fill", "#1f1f1f");
		rect.setAttribute("rx", "4");
		svg.appendChild(rect);

		const text = document.createElementNS(svgNS, "text");
		text.setAttribute("x", String(size / 2));
		text.setAttribute("y", String(size / 2));
		text.setAttribute("fill", "#666");
		text.setAttribute("font-size", "10");
		text.setAttribute("text-anchor", "middle");
		text.setAttribute("dy", "3");
		text.textContent = "No political content";
		svg.appendChild(text);

		container.appendChild(svg);
		return container;
	}

	// Map -100..100 to 10..size-10 (with 10px padding)
	const padding = 10;
	const range = size - 2 * padding;
	const dotX = padding + ((politicalX + 100) / 200) * range;
	const dotY = padding + ((100 - politicalY) / 200) * range; // Flip Y for SVG
	const center = size / 2;

	// Background quadrants
	const quadrantColors = [
		{ x: padding, y: padding, color: "rgba(168, 85, 247, 0.2)" }, // Auth-Left (purple)
		{ x: center, y: padding, color: "rgba(59, 130, 246, 0.2)" }, // Auth-Right (blue)
		{ x: padding, y: center, color: "rgba(34, 197, 94, 0.2)" }, // Lib-Left (green)
		{ x: center, y: center, color: "rgba(245, 158, 11, 0.2)" }, // Lib-Right (yellow)
	];

	for (const q of quadrantColors) {
		const rect = document.createElementNS(svgNS, "rect");
		rect.setAttribute("x", String(q.x));
		rect.setAttribute("y", String(q.y));
		rect.setAttribute("width", String(range / 2));
		rect.setAttribute("height", String(range / 2));
		rect.setAttribute("fill", q.color);
		svg.appendChild(rect);
	}

	// Vertical axis
	const vLine = document.createElementNS(svgNS, "line");
	vLine.setAttribute("x1", String(center));
	vLine.setAttribute("y1", String(padding));
	vLine.setAttribute("x2", String(center));
	vLine.setAttribute("y2", String(size - padding));
	vLine.setAttribute("stroke", "#3f3f3f");
	vLine.setAttribute("stroke-width", "1");
	svg.appendChild(vLine);

	// Horizontal axis
	const hLine = document.createElementNS(svgNS, "line");
	hLine.setAttribute("x1", String(padding));
	hLine.setAttribute("y1", String(center));
	hLine.setAttribute("x2", String(size - padding));
	hLine.setAttribute("y2", String(center));
	hLine.setAttribute("stroke", "#3f3f3f");
	hLine.setAttribute("stroke-width", "1");
	svg.appendChild(hLine);

	// Labels
	const labels = [
		{ x: padding + 2, y: center - 2, text: "L" },
		{ x: size - padding - 8, y: center - 2, text: "R" },
		{ x: center + 2, y: padding + 8, text: "A" },
		{ x: center + 2, y: size - padding - 2, text: "L" },
	];

	for (const lbl of labels) {
		const text = document.createElementNS(svgNS, "text");
		text.setAttribute("x", String(lbl.x));
		text.setAttribute("y", String(lbl.y));
		text.setAttribute("fill", "#888");
		text.setAttribute("font-size", "8");
		text.textContent = lbl.text;
		svg.appendChild(text);
	}

	// User position dot
	const dot = document.createElementNS(svgNS, "circle");
	dot.setAttribute("cx", String(dotX));
	dot.setAttribute("cy", String(dotY));
	dot.setAttribute("r", "5");
	dot.setAttribute("fill", "#3ea6ff");
	dot.setAttribute("stroke", "#fff");
	dot.setAttribute("stroke-width", "1.5");
	svg.appendChild(dot);

	container.appendChild(svg);
	return container;
}
