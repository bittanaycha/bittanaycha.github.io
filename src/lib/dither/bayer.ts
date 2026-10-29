/**
 * Ordered-dither threshold maps.
 *
 * The Bayer matrix is built by the standard recursive construction:
 *
 *   M₁ = [0]        M₂ₙ = [ 4·Mₙ + 0   4·Mₙ + 2 ]
 *                       [ 4·Mₙ + 3   4·Mₙ + 1 ]
 *
 * Values are then normalised to the half-open range [0, 1) using
 * `(value + 0.5) / n²`, which centres each threshold in its own cell. That
 * centring matters: without it, a flat mid-grey field dithers asymmetrically.
 */

/** Side lengths we support. All are powers of two, as the construction requires. */
export type BayerSize = 2 | 4 | 8 | 16;

/**
 * Build the raw (unnormalised) Bayer matrix of `size`×`size`.
 * Entry `[y][x]` holds an integer in `[0, size²)`.
 */
export function bayerMatrix(size: BayerSize): number[][] {
	let m: number[][] = [[0]];

	for (let n = 1; n < size; n *= 2) {
		const next: number[][] = Array.from({ length: n * 2 }, () => new Array<number>(n * 2));

		for (let y = 0; y < n; y++) {
			for (let x = 0; x < n; x++) {
				const base = 4 * m[y][x];
				next[y][x] = base;
				next[y][x + n] = base + 2;
				next[y + n][x] = base + 3;
				next[y + n][x + n] = base + 1;
			}
		}

		m = next;
	}

	return m;
}

/**
 * Normalised Bayer thresholds in `[0, 1)`, flattened row-major.
 * This is the form both the GLSL and CPU dither paths consume.
 */
export function bayerThresholds(size: BayerSize): Float32Array {
	const m = bayerMatrix(size);
	const total = size * size;
	const out = new Float32Array(total);

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			out[y * size + x] = (m[y][x] + 0.5) / total;
		}
	}

	return out;
}

/**
 * The thresholds as a single-channel texture payload (0–255), ready to hand to
 * `THREE.DataTexture` with `RedFormat`.
 */
export function bayerTextureData(size: BayerSize): Uint8Array {
	const thresholds = bayerThresholds(size);
	const out = new Uint8Array(thresholds.length);

	for (let i = 0; i < thresholds.length; i++) {
		out[i] = Math.round(thresholds[i] * 255);
	}

	return out;
}
