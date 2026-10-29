/**
 * Blue-noise mask generation via Ulichney's void-and-cluster algorithm.
 *
 * A blue-noise mask is a threshold map whose "on" pixels are evenly spread
 * with no low-frequency clumping. Dithering with one gives a fine, unstructured
 * grain instead of Bayer's cross-hatch, at the cost of not tiling as neatly.
 *
 * The algorithm has three stages:
 *
 *  0. Start from a random binary pattern, then repeatedly move a 1 from the
 *     tightest cluster to the largest void until the two coincide.
 *  1. Removing one pixel at a time from that pattern, tightest cluster first,
 *     assign ranks `M-1 … 0`.
 *  2. Adding one pixel at a time, largest void first, assign ranks `M … N-1`.
 *
 * The filter is a wrapped (toroidal) Gaussian, so the resulting mask tiles
 * seamlessly — which is exactly what we want when the shader repeats it.
 *
 * This is O(N²) in the number of cells, so 64×64 is comfortable and 128×128
 * takes a noticeable moment. Results are memoised per parameter set.
 */

export type BlueNoiseOptions = {
	/** Gaussian filter width. Ulichney's original used 1.5. */
	sigma?: number;
	/** Seed for the initial random pattern. Same seed ⇒ same mask. */
	seed?: number;
};

/** Deterministic PRNG so a given seed always yields the same mask. */
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

type Kernel = { weights: Float32Array; radius: number; side: number };

function gaussianKernel(sigma: number): Kernel {
	const radius = Math.max(1, Math.ceil(sigma * 3));
	const side = radius * 2 + 1;
	const weights = new Float32Array(side * side);
	const denom = 2 * sigma * sigma;

	let sum = 0;
	for (let y = -radius; y <= radius; y++) {
		for (let x = -radius; x <= radius; x++) {
			const w = Math.exp(-(x * x + y * y) / denom);
			weights[(y + radius) * side + (x + radius)] = w;
			sum += w;
		}
	}

	// Normalising keeps energy values comparable across sigma choices.
	for (let i = 0; i < weights.length; i++) weights[i] /= sum;

	return { weights, radius, side };
}

const cache = new Map<string, Uint8Array>();

/**
 * Generate a `size`×`size` blue-noise rank map.
 *
 * Returns a row-major `Uint8Array` of `size * size` bytes. Values are the
 * pixel's rank in the mask scaled to 0–255, which is what both the CPU dither
 * and the GLSL threshold lookup want.
 */
export function generateBlueNoise(size: number, options: BlueNoiseOptions = {}): Uint8Array {
	const sigma = options.sigma ?? 1.5;
	const seed = options.seed ?? 1;
	const key = `${size}:${sigma}:${seed}`;

	const cached = cache.get(key);
	if (cached) return cached;

	const total = size * size;
	const { weights, radius, side } = gaussianKernel(sigma);
	const random = mulberry32(seed);

	// --- energy bookkeeping -------------------------------------------------
	// `energy[i]` is the convolution of the current binary pattern with the
	// Gaussian. Toggling a cell updates it incrementally in O(radius²) rather
	// than recomputing the whole field in O(N · radius²).
	const energy = new Float32Array(total);

	function splat(x: number, y: number, sign: number): void {
		for (let dy = -radius; dy <= radius; dy++) {
			const yy = (y + dy + size) % size;
			const rowEnergy = yy * size;
			const rowKernel = (dy + radius) * side;
			for (let dx = -radius; dx <= radius; dx++) {
				const xx = (x + dx + size) % size;
				energy[rowEnergy + xx] += sign * weights[rowKernel + dx + radius];
			}
		}
	}

	function rebuildEnergy(pattern: Uint8Array): void {
		energy.fill(0);
		for (let i = 0; i < total; i++) {
			if (pattern[i]) splat(i % size, (i / size) | 0, 1);
		}
	}

	// --- stage 0: settle on an initial binary pattern ------------------------
	const pattern = new Uint8Array(total);
	let ones = 0;
	for (let i = 0; i < total; i++) {
		if (random() < 0.5) {
			pattern[i] = 1;
			ones++;
		}
	}
	rebuildEnergy(pattern);

	function tightestCluster(): number {
		let best = -Infinity;
		let index = -1;
		for (let i = 0; i < total; i++) {
			if (pattern[i] === 1 && energy[i] > best) {
				best = energy[i];
				index = i;
			}
		}
		return index;
	}

	function largestVoid(): number {
		let best = Infinity;
		let index = -1;
		for (let i = 0; i < total; i++) {
			if (pattern[i] === 0 && energy[i] < best) {
				best = energy[i];
				index = i;
			}
		}
		return index;
	}

	// Swapping stops when the tightest cluster *is* the largest void: moving it
	// would undo itself, so the pattern is as even as this filter can make it.
	const maxSwaps = total * 10;
	for (let swap = 0; swap < maxSwaps; swap++) {
		const cluster = tightestCluster();
		pattern[cluster] = 0;
		splat(cluster % size, (cluster / size) | 0, -1);

		const void_ = largestVoid();
		if (void_ === cluster) {
			// Stable — put it back and stop.
			pattern[cluster] = 1;
			splat(cluster % size, (cluster / size) | 0, 1);
			break;
		}

		pattern[void_] = 1;
		splat(void_ % size, (void_ / size) | 0, 1);
	}

	const ranks = new Int32Array(total).fill(-1);
	const initial = pattern.slice();

	// --- stage 1: strip the pattern down, ranking from the top ---------------
	for (let rank = ones - 1; rank >= 0; rank--) {
		const cluster = tightestCluster();
		ranks[cluster] = rank;
		pattern[cluster] = 0;
		splat(cluster % size, (cluster / size) | 0, -1);
	}

	// --- stage 2: build it back up, ranking from the bottom ------------------
	pattern.set(initial);
	rebuildEnergy(pattern);

	for (let rank = ones; rank < total; rank++) {
		const void_ = largestVoid();
		ranks[void_] = rank;
		pattern[void_] = 1;
		splat(void_ % size, (void_ / size) | 0, 1);
	}

	// --- normalise to bytes --------------------------------------------------
	const out = new Uint8Array(total);
	const scale = 255 / (total - 1);
	for (let i = 0; i < total; i++) {
		out[i] = Math.round(ranks[i] * scale);
	}

	cache.set(key, out);
	return out;
}

/**
 * The same mask expanded to RGBA, for uploading as a `DataTexture` with the
 * default RGBA format. Alpha is opaque so the texture reads predictably
 * regardless of how sampling is configured.
 */
export function blueNoiseRGBA(size: number, options: BlueNoiseOptions = {}): Uint8Array {
	const mask = generateBlueNoise(size, options);
	const out = new Uint8Array(mask.length * 4);

	for (let i = 0; i < mask.length; i++) {
		const v = mask[i];
		out[i * 4 + 0] = v;
		out[i * 4 + 1] = v;
		out[i * 4 + 2] = v;
		out[i * 4 + 3] = 255;
	}

	return out;
}
