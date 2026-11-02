/**
 * Two sample sources, drawn rather than shipped.
 *
 * The reference covers are built out of pebbles, so the demo subject is the
 * same: three stones on cloth. One version is a photograph — soft gradients,
 * a warm key light, surface bumps, grain — because that is what the tone
 * pipeline is for. The other is a pen drawing of the same stones, because line
 * art is the case that breaks naive dithering: thin dark lines on white paper
 * need the light base stack, and the levels have to keep the white open.
 *
 * Keeping them procedural means the lab works in a fresh checkout with no
 * assets, and it keeps the sample honest: no stock photo, no licensing.
 */

import { outlineRadius, valueNoise } from './mask';

const TAU = Math.PI * 2;

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Pebble = {
	x: number;
	y: number;
	r: number;
	squash: number;
	tilt: number;
	tint: [number, number, number];
	/** Silhouette radius per angular bin. */
	edge: Float32Array;
};

/** Positions in 0–1 space so the sample scales to any canvas. */
const pebbleLayout: Omit<Pebble, 'edge'>[] = [
	{ x: 0.35, y: 0.58, r: 0.26, squash: 0.78, tilt: -0.13, tint: [0.95, 0.9, 0.8] },
	{ x: 0.72, y: 0.42, r: 0.15, squash: 0.92, tilt: 0.22, tint: [0.86, 0.84, 0.79] },
	{ x: 0.52, y: 0.82, r: 0.09, squash: 0.7, tilt: -0.32, tint: [0.72, 0.66, 0.58] }
];

function pebbles(roughness = 0.05): Pebble[] {
	return pebbleLayout.map((stone, i) => ({
		...stone,
		edge: outlineRadius(17 + i * 13, roughness, 512)
	}));
}

/** One entry of the silhouette table for an (x, y) offset in pebble space. */
function edgeAt(stone: Pebble, x: number, y: number): number {
	let theta = Math.atan2(y, x);
	if (theta < 0) theta += TAU;
	const bin = Math.min(511, ((theta / TAU) * 512) | 0);
	return stone.edge[bin];
}

export function createStonesPhoto(width = 1400, height = 1000): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) return canvas;

	const image = ctx.createImageData(width, height);
	const data = image.data;
	const random = mulberry32(0x5701e5);
	const stones = pebbles();

	// Key light from the upper left, a little in front of the cloth.
	const light = { x: -0.45, y: -0.52, z: 0.72 };

	function clothAt(u: number, v: number): [number, number, number] {
		// A drape: two crossed folds over a slow mottle, lit by one soft pool.
		const rise = valueNoise(u * 2.6, v * 2.1, 11);
		const ripple = valueNoise(u * 5.4, v * 4.3, 23);
		const folds = 0.5 + 0.5 * Math.sin(6.6 * u + rise * 5.4 + Math.sin(3.4 * v + ripple * 4) * 0.9);
		const pool = Math.exp(-(((u - 0.31) ** 2 + (v - 0.17) ** 2) / 0.16));
		const tooth = 0.94 + 0.06 * valueNoise(u * 190, v * 150, 5);
		const tone = (0.34 + 0.52 * pool) * (0.7 + 0.42 * folds) * tooth;

		return [30 + 110 * tone, 27 + 100 * tone, 23 + 86 * tone];
	}

	for (let y = 0; y < height; y++) {
		const v = y / (height - 1);

		for (let x = 0; x < width; x++) {
			const u = x / (width - 1);

			let [r, g, b] = clothAt(u, v);

			// Cast shadows, drawn before the stones so the stones cover the
			// part of the shadow they stand in.
			for (const stone of stones) {
				const sx = (u - stone.x - stone.r * 0.3) / (stone.r * 1.25);
				const sy = (v - stone.y - stone.r * 0.5) / (stone.r * 0.8);
				const shadow = Math.exp(-(sx * sx + sy * sy) * 1.7);
				const contact = 1 - 0.66 * shadow;

				r *= contact;
				g *= contact;
				b *= contact;
			}

			for (const stone of stones) {
				const dx = (u - stone.x) / stone.r;
				const dy = (v - stone.y) / (stone.r * stone.squash);
				const cos = Math.cos(stone.tilt);
				const sin = Math.sin(stone.tilt);
				const px = dx * cos - dy * sin;
				const py = dx * sin + dy * cos;

				const distance = Math.sqrt(px * px + py * py) / edgeAt(stone, px, py);
				if (distance >= 1) continue;

				const nz = Math.sqrt(Math.max(0, 1 - distance * distance));

				// Surface bumps. A smooth sphere reads as a 3D render; a little
				// normal perturbation is what makes it read as stone.
				const e = 0.015;
				const heightAt = (a: number, b2: number) =>
					valueNoise(a * 7.5, b2 * 7.5, 31) + 0.5 * valueNoise(a * 19, b2 * 19, 41);
				const dhx = (heightAt(px + e, py) - heightAt(px - e, py)) / (2 * e);
				const dhy = (heightAt(px, py + e) - heightAt(px, py - e)) / (2 * e);

				let nx = px + dhx * 0.045;
				let ny = py + dhy * 0.045;
				const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
				nx /= length;
				ny /= length;
				const nzn = nz / length;

				const lambert = Math.max(0, nx * light.x + ny * light.y + nzn * light.z);
				const shade = 0.1 + 0.9 * Math.pow(lambert, 0.8);
				// Broad sheen rather than a hotspot, plus a pale rim where the
				// stone turns away from the light.
				const sheen = Math.pow(lambert, 9) * 0.16;
				const rim = Math.pow(1 - Math.abs(nzn), 3) * Math.max(0, lambert) * 0.12;
				const fleck = random() > 0.988 ? 0.2 : 0;

				const stoneR = 255 * stone.tint[0] * shade + 255 * (sheen + rim + fleck);
				const stoneG = 248 * stone.tint[1] * shade + 248 * (sheen + rim + fleck);
				const stoneB = 236 * stone.tint[2] * shade + 240 * (sheen + rim + fleck);

				// Feather the silhouette so the dithered edge does not stair-step
				// before the screen even sees it.
				const feather = Math.min(1, (1 - distance) * 30);

				r = stoneR * feather + r * (1 - feather);
				g = stoneG * feather + g * (1 - feather);
				b = stoneB * feather + b * (1 - feather);
			}

			const grain = (random() - 0.5) * 9;
			const i = (y * width + x) * 4;

			data[i] = Math.max(0, Math.min(255, r + grain));
			data[i + 1] = Math.max(0, Math.min(255, g + grain));
			data[i + 2] = Math.max(0, Math.min(255, b + grain));
			data[i + 3] = 255;
		}
	}

	ctx.putImageData(image, 0, 0);
	return canvas;
}

/** One wobbly closed contour, sampled as a polygon and stroked. */
function contour(
	ctx: CanvasRenderingContext2D,
	stone: Pebble,
	width: number,
	height: number,
	pass: number,
	random: () => number
) {
	const cx = stone.x * width;
	const cy = stone.y * height;
	const rx = stone.r * width;
	const ry = stone.r * height * stone.squash;
	const points = 128;

	ctx.beginPath();

	for (let i = 0; i <= points; i++) {
		const theta = (i / points) * TAU;
		const edge = edgeAt(stone, Math.cos(theta) * 4, Math.sin(theta) * 4);
		// A hand cannot draw the same line twice: two harmonics plus jitter.
		const wobble = 1 + 0.02 * Math.sin(theta * 2 + pass * 1.7) + 0.008 * (random() - 0.5);

		const dx = Math.cos(theta) * rx * edge * wobble;
		const dy = Math.sin(theta) * ry * edge * wobble;
		const cos = Math.cos(stone.tilt);
		const sin = Math.sin(stone.tilt);
		const px = cx + dx * cos - dy * sin;
		const py = cy + dx * sin + dy * cos;

		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}

	ctx.stroke();
}

export function createStonesDrawing(width = 1400, height = 1000): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) return canvas;

	const random = mulberry32(0x1a9c);
	const stones = pebbles();

	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = '#171310';
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// Ground line, drawn first so the stones sit on it.
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(23, 19, 16, 0.8)';
	ctx.beginPath();
	for (let x = width * 0.12; x <= width * 0.9; x += 8) {
		const t = x / width;
		const y = height * 0.845 + Math.sin(t * 5 + 0.4) * 5 + (random() - 0.5) * 1.4;
		if (x === width * 0.12) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.stroke();

	// Each stone gets a hatched contact shadow, then two drawn passes: the
	// under-drawing, and a darker correction on top of it.
	for (const stone of stones) {
		const cx = (stone.x + stone.r * 0.05) * width;
		const cy = (stone.y + stone.r * 0.92) * height;
		const rx = stone.r * width * 0.62;
		const ry = Math.max(4, stone.r * height * 0.1);
		const spacing = Math.max(3, stone.r * width * 0.055);

		ctx.save();
		ctx.beginPath();
		ctx.ellipse(cx, cy, rx, ry, -0.05, 0, TAU);
		ctx.clip();

		const shade = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
		shade.addColorStop(0, 'rgba(23, 19, 16, 0.8)');
		shade.addColorStop(1, 'rgba(23, 19, 16, 0)');
		ctx.strokeStyle = shade;
		ctx.lineWidth = 1.4;

		for (let x = cx - rx - ry; x <= cx + rx + ry; x += spacing) {
			ctx.beginPath();
			ctx.moveTo(x, cy - ry - 2);
			ctx.lineTo(x + ry * 2 + 4, cy + ry + 2);
			ctx.stroke();
		}

		ctx.restore();

		ctx.lineWidth = 1.5;
		ctx.strokeStyle = 'rgba(23, 19, 16, 0.5)';
		contour(ctx, stone, width, height, 0, random);

		ctx.lineWidth = 2.3;
		ctx.strokeStyle = '#171310';
		contour(ctx, stone, width, height, 1, random);
	}

	return canvas;
}
