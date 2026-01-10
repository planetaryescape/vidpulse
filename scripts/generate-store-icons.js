import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = join(__dirname, "..", "store-assets");

// Ensure directory exists
mkdirSync(storeAssetsDir, { recursive: true });

function createIcon(size, filename) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext("2d");

	// Background gradient (purple to blue)
	const gradient = ctx.createLinearGradient(0, 0, size, size);
	gradient.addColorStop(0, "#7c3aed");
	gradient.addColorStop(1, "#3b82f6");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);

	// Draw "VP" text
	ctx.fillStyle = "#ffffff";
	ctx.font = `bold ${size * 0.4}px Arial, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("VP", size / 2, size / 2);

	// Save
	const buffer = canvas.toBuffer("image/png");
	writeFileSync(join(storeAssetsDir, filename), buffer);
	console.log(`Created ${filename} (${size}x${size})`);
}

function createTile(width, height, filename) {
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");

	// Background gradient
	const gradient = ctx.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, "#1e1b4b");
	gradient.addColorStop(1, "#0f172a");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	// Logo circle
	const logoSize = Math.min(width, height) * 0.35;
	const logoX = width * 0.3;
	const logoY = height / 2;

	const logoGradient = ctx.createLinearGradient(
		logoX - logoSize / 2,
		logoY - logoSize / 2,
		logoX + logoSize / 2,
		logoY + logoSize / 2,
	);
	logoGradient.addColorStop(0, "#7c3aed");
	logoGradient.addColorStop(1, "#3b82f6");

	ctx.beginPath();
	ctx.arc(logoX, logoY, logoSize / 2, 0, Math.PI * 2);
	ctx.fillStyle = logoGradient;
	ctx.fill();

	// VP text in logo
	ctx.fillStyle = "#ffffff";
	ctx.font = `bold ${logoSize * 0.4}px Arial, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("VP", logoX, logoY);

	// Title text
	ctx.fillStyle = "#ffffff";
	ctx.font = `bold ${height * 0.15}px Arial, sans-serif`;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.fillText("VidPulse", width * 0.5, height * 0.4);

	// Tagline
	ctx.fillStyle = "#94a3b8";
	ctx.font = `${height * 0.08}px Arial, sans-serif`;
	ctx.fillText("AI-Powered YouTube Analysis", width * 0.5, height * 0.6);

	// Save
	const buffer = canvas.toBuffer("image/png");
	writeFileSync(join(storeAssetsDir, filename), buffer);
	console.log(`Created ${filename} (${width}x${height})`);
}

// Generate icons
createIcon(256, "icon256.png");

// Generate promotional tiles
createTile(440, 280, "small-tile-440x280.png");
createTile(920, 680, "large-tile-920x680.png");

console.log("\nStore assets generated successfully!");
