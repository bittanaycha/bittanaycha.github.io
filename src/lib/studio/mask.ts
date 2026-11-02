/**
 * Sheet shapes and binary mask operations.
 *
 * The reference covers never print edge to edge: each motif is cut into a
 * pebble-shaped patch of paper, and the patches are tied together with thin
 * lines. A single-photo print can borrow the first half of that idea — an
 * irregular patch with a one- or two-pixel ink outline — without pretending to
 * be a network diagram.
 *
 * Everything here works on row-major `Uint8Array` masks (1 = keep, 0 = drop),
 * which keeps the geometry testable without a canvas.
 */

export type BlobOptions = {
	/** Margin from the edge, as a fraction of the half-width/half-height. */
	inset: number;
	/** 0 = ellipse, 1 = heavily torn. */
	roughness: number;
	seed: number;
};

/** Deterministic 2D hash, 0–1. */
export function hash2(x: number, y: number, seed: number): number {
	let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Smoothed value noise, 0–1.
 *
 * Bilinear interpolation of a hashed lattice with a smoothstep fade. Cheap
 * enough to call a few times per pixel, which is all the paper grain and the
 * pebble bumps need.
 */
export function valueNoise(x: number, y: number, seed: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const tx = x - x0;
	const ty = y - y0;
	const sx = tx * tx * (3 - 2 * tx);
	const sy = ty * ty * (3 - 2 * ty);

	const a = hash2(x0, y0, seed);
	const b = hash2(x0 + 1, y0, seed);
	const c = hash2(x0, y0 + 1, seed);
	const d = hash2(x0 + 1, y0 + 1, seed);

	return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/**
 * A closed outline as a radius per angular bin: a sum of low harmonics for the
 * pebble silhouette, plus a little jitter for a torn edge. Shared by the sheet
 * shape and the sample pebbles so both sit in the same visual world.
 */
export function outlineRadius(seed: number, roughness: number, bins = 1024): Float32Array {
	const radius = new Float32Array(bins);
	const harmonics = [
		{ k: 2, weight: 0.55, phase: hash2(1, 0, seed) * Math.PI * 2 },
		{ k: 3, weight: 0.3, phase: hash2(2, 0, seed) * Math.PI * 2 },
		{ k: 5, weight: 0.16, phase: hash2(3, 0, seed) * Math.PI * 2 },
		{ k: 7, weight: 0.09, phase: hash2(4, 0, seed) * Math.PI * 2 }
	];

	for (let bin = 0; bin < bins; bin++) {
		const theta = (bin / bins) * Math.PI * 2;
		let r = 1;

		for (const { k, weight, phase } of harmonics) {
			r += roughness * weight * Math.sin(k * theta + phase);
		}

		radius[bin] = r;
	}

	// The torn edge. White noise per bin would produce a 60-tooth comb once it
	// is laid out around the circumference, so the noise is smoothed around the
	// ring first: what is left is a slow, hand-cut wobble.
	let tear = new Float32Array(bins);
	for (let bin = 0; bin < bins; bin++) tear[bin] = hash2(bin, 7, seed) - 0.5;

	const spread = Math.max(2, Math.round(bins / 40));

	for (let pass = 0; pass < 3; pass++) {
		const previous = tear;
		tear = new Float32Array(bins);

		for (let bin = 0; bin < bins; bin++) {
			let sum = 0;
			for (let k = -spread; k <= spread; k++) {
				sum += previous[(bin + k + bins) % bins];
			}
			tear[bin] = sum / (spread * 2 + 1);
		}
	}

	for (let bin = 0; bin < bins; bin++) {
		radius[bin] = Math.max(0.2, radius[bin] + roughness * 1.6 * tear[bin]);
	}

	return radius;
}

/**
 * An irregular closed patch filling most of the frame.
 *
 * The radius table is evaluated once and then looked up per pixel, which costs
 * one `atan2` per pixel and no trigonometry in the loop.
 */
export function blobMask(width: number, height: number, options: BlobOptions): Uint8Array {
	const { inset, roughness, seed } = options;
	const mask = new Uint8Array(width * height);

	const cx = width / 2;
	const cy = height / 2;
	const rx = Math.max(1, (0.5 - inset) * width);
	const ry = Math.max(1, (0.5 - inset) * height);

	const BINS = 1024;
	const radius = outlineRadius(seed, roughness, BINS);

	for (let y = 0; y < height; y++) {
		const dy = (y + 0.5 - cy) / ry;

		for (let x = 0; x < width; x++) {
			const dx = (x + 0.5 - cx) / rx;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance > 1.6) continue;

			let theta = Math.atan2(dy, dx);
			if (theta < 0) theta += Math.PI * 2;

			const bin = Math.min(BINS - 1, ((theta / (Math.PI * 2)) * BINS) | 0);
			if (distance <= radius[bin]) mask[y * width + x] = 1;
		}
	}

	return mask;
}

/**
 * Separable square-kernel dilation: for each pixel, the maximum of its
 * `(2r+1)²` neighbourhood. Squares rather than discs, because the difference
 * is invisible at these radii and the separable passes are ~5× faster.
 */
export function dilateMask(
	mask: Uint8Array,
	width: number,
	height: number,
	radius: number
): Uint8Array {
	const r = Math.round(radius);
	if (r <= 0) return mask.slice();

	const horizontal = new Uint8Array(mask.length);

	for (let y = 0; y < height; y++) {
		const row = y * width;
		for (let x = 0; x < width; x++) {
			let value = 0;
			const from = Math.max(0, x - r);
			const to = Math.min(width - 1, x + r);
			for (let i = from; i <= to; i++) {
				if (mask[row + i]) {
					value = 1;
					break;
				}
			}
			horizontal[row + x] = value;
		}
	}

	const out = new Uint8Array(mask.length);

	for (let y = 0; y < height; y++) {
		const from = Math.max(0, y - r);
		const to = Math.min(height - 1, y + r);
		for (let x = 0; x < width; x++) {
			let value = 0;
			for (let i = from; i <= to; i++) {
				if (horizontal[i * width + x]) {
					value = 1;
					break;
				}
			}
			out[y * width + x] = value;
		}
	}

	return out;
}

/** Dilation of the complement — shrinks the ones. */
export function erodeMask(
	mask: Uint8Array,
	width: number,
	height: number,
	radius: number
): Uint8Array {
	const r = Math.round(radius);
	if (r <= 0) return mask.slice();

	const inverted = new Uint8Array(mask.length);
	for (let i = 0; i < mask.length; i++) inverted[i] = mask[i] ? 0 : 1;

	const dilated = dilateMask(inverted, width, height, r);
	for (let i = 0; i < dilated.length; i++) dilated[i] = dilated[i] ? 0 : 1;

	return dilated;
}
