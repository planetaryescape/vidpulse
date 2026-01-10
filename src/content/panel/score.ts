import { getScoreColor } from "../../shared/utils";

export function createScoreBar(label: string, score: number): HTMLElement {
	const row = document.createElement("div");
	row.className = "vp-score-row";

	const labelEl = document.createElement("span");
	labelEl.className = "vp-score-label";
	labelEl.textContent = label;

	const barContainer = document.createElement("div");
	barContainer.className = "vp-score-bar";

	const barFill = document.createElement("div");
	barFill.className = "vp-score-fill";
	barFill.style.width = `${score}%`;
	barFill.style.backgroundColor = getScoreColor(score);

	const valueEl = document.createElement("span");
	valueEl.className = "vp-score-value";
	valueEl.textContent = String(score);

	barContainer.appendChild(barFill);
	row.appendChild(labelEl);
	row.appendChild(barContainer);
	row.appendChild(valueEl);

	return row;
}
