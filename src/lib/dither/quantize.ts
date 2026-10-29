/**
 * CPU dithering over `ImageData`.
 *
 * Two families live here:
 *
 *  - **Ordered** dithering compares each pixel against a repeating threshold
 *    map (Bayer, blue noise). It is stateless per pixel, so it parallelises
 *    trivially and never smears; its texture is a fixed pattern that stays
 *    put as the image changes.
 *
 *  - **Error diffusion** pushes each pixel's quantisation error into its
 *    unprocessed neighbours. It reproduces gradients beautifully but the
 *    error is carried left-to-right, which shows up as diagonal "worms" and
 *    makes the result order-dependent.
 *
 * Both write in place into the supplied buffer and return it.
 */

import { bayerThresholds, type BayerSize } from './bayer';
import { generateBlueNoise } from './bluenoise';
import {
	flattenPalette,
	nearestColorIndexFlat,
	nearestSegmentFlat,
	type Palette,
	type RGB,
	type SegmentMatch
} from './palettes';

/**
 * Structural stand-in for the DOM's `ImageData`. `ImageData` satisfies this
 * shape, but so does a plain object — which keeps these algorithms runnable
 * under Node in tests, with no canvas required.
 */
export type DitherImage = {
	width: number;
	height: number;
	data: Uint8ClampedArray;
};

export type ThresholdMap = { kind: 'bayer'; size: BayerSize } | { kind: 'bluenoise'; size: number };

export type OrderedOptions = {
	palette: Palette;
	threshold: ThresholdMap;
	/**
	 * Size of one dither cell in pixels. 1 dithers at pixel level (finest);
	 * higher values enlarge the pattern, which reads as coarser and more
	 * "printed".
	 */
	scale?: number;
	/**
	 * Moves the decision point along the chosen palette segment. Positive
	 * values favour the darker of the two colours, negative the lighter, so the
	 * control reads the same way for every palette.
	 */
	bias?: number;
};

export type DiffusionKernelName = 'floyd-steinberg' | 'atkinson' | 'burkes' | 'stucki';

export type DiffusionOptions = {
	palette: Palette;
	kernel: DiffusionKernelName;
	/** Alternating scan direction per row, which breaks up directional worms. */
	serpentine?: boolean;
	/** Strength of the diffused error, 0–1. */
	amount?: number;
};

type KernelTap = { dx: number; dy: number; weight: number };

// All kernels are written for a left-to-right scan. `serpentine` mirrors dx.
const DIFFUSION_KERNELS: Record<DiffusionKernelName, KernelTap[]> = {
	'floyd-steinberg': [
		{ dx: 1, dy: 0, weight: 7 / 16 },
		{ dx: -1, dy: 1, weight: 3 / 16 },
		{ dx: 0, dy: 1, weight: 5 / 16 },
		{ dx: 1, dy: 1, weight: 1 / 16 }
	],
	atkinson: [
		{ dx: 1, dy: 0, weight: 1 / 8 },
		{ dx: 2, dy: 0, weight: 1 / 8 },
		{ dx: -1, dy: 1, weight: 1 / 8 },
		{ dx: 0, dy: 1, weight: 1 / 8 },
		{ dx: 1, dy: 1, weight: 1 / 8 },
		{ dx: 0, dy: 2, weight: 1 / 8 }
	],
	burkes: [
		{ dx: 1, dy: 0, weight: 8 / 32 },
		{ dx: 2, dy: 0, weight: 4 / 32 },
		{ dx: -2, dy: 1, weight: 2 / 32 },
		{ dx: -1, dy: 1, weight: 4 / 32 },
		{ dx: 0, dy: 1, weight: 8 / 32 },
		{ dx: 1, dy: 1, weight: 4 / 32 },
		{ dx: 2, dy: 1, weight: 2 / 32 }
	],
	stucki: [
		{ dx: 1, dy: 0, weight: 8 / 42 },
		{ dx: 2, dy: 0, weight: 4 / 42 },
		{ dx: -2, dy: 1, weight: 2 / 42 },
		{ dx: -1, dy: 1, weight: 4 / 42 },
		{ dx: 0, dy: 1, weight: 8 / 42 },
		{ dx: 1, dy: 1, weight: 4 / 42 },
		{ dx: 2, dy: 1, weight: 2 / 42 },
		{ dx: -2, dy: 2, weight: 1 / 42 },
		{ dx: -1, dy: 2, weight: 2 / 42 },
		{ dx: 0, dy: 2, weight: 4 / 42 },
		{ dx: 1, dy: 2, weight: 2 / 42 },
		{ dx: 2, dy: 2, weight: 1 / 42 }
	]
};

export const diffusionKernels: { id: DiffusionKernelName; name: string; note: string }[] = [
	{ id: 'floyd-steinberg', name: 'Floyd–Steinberg', note: 'The classic. Fine grain, some worms.' },
	{
		id: 'atkinson',
		name: 'Atkinson',
		note: 'Diffuses only 6/8 of the error — lighter, crisper, more contrast.'
	},
	{
		id: 'burkes',
		name: 'Burkes',
		note: 'Smoother than Floyd–Steinberg, fewer directional artefacts.'
	},
	{ id: 'stucki', name: 'Stucki', note: 'Widest kernel here. Very smooth, slightly soft.' }
];

const bayerCache = new Map<BayerSize, Float32Array>();

function getBayer(size: BayerSize): Float32Array {
	let map = bayerCache.get(size);
	if (!map) {
		map = bayerThresholds(size);
		bayerCache.set(size, map);
	}
	return map;
}

/**
 * Resolve a threshold map into a fast sampler.
 *
 * The map is looked up once here rather than on every pixel: the alternative
 * costs a `Map.get` (or, worse, a possible blue-noise generation) per pixel,
 * which dominates the actual dithering work.
 */
function thresholdSampler(map: ThresholdMap): (x: number, y: number, scale: number) => number {
	if (map.kind === 'bayer') {
		const size = map.size;
		const data = getBayer(size);

		return (x, y, scale) =>
			data[(Math.floor(y / scale) % size) * size + (Math.floor(x / scale) % size)];
	}

	const size = map.size;
	const data = generateBlueNoise(size);

	return (x, y, scale) =>
		data[(Math.floor(y / scale) % size) * size + (Math.floor(x / scale) % size)] / 255;
}

/**
 * Ordered dither against a palette.
 *
 * For each pixel we find the palette segment that best approximates the source
 * colour, then use the threshold map to choose a point along it. With a
 * two-colour palette this reduces to the textbook "compare against a Bayer
 * value" rule; with a larger palette it avoids the colour casts you get from
 * dithering each channel independently.
 *
 * Every allocation is hoisted out of the loop, and the palette is flattened
 * into typed arrays up front. At a megapixel this loop runs a million times, so
 * both matter: a per-pixel array literal costs seconds, and reading through a
 * caller's reactive object graph costs almost as much.
 */
export function orderedDither(image: DitherImage, options: OrderedOptions): DitherImage {
	const { palette, threshold } = options;
	const scale = Math.max(1, options.scale ?? 1);
	const bias = options.bias ?? 0;
	const { width, height, data } = image;
	const flat = flattenPalette(palette);
	const { rgb, luma, count } = flat;

	// A one-colour palette is a no-op; skip the per-pixel work entirely.
	if (count === 1) {
		for (let i = 0; i < data.length; i += 4) {
			data[i] = rgb[0];
			data[i + 1] = rgb[1];
			data[i + 2] = rgb[2];
		}
		return image;
	}

	const sample = thresholdSampler(threshold);
	const match: SegmentMatch = { indexA: 0, indexB: 0, t: 0 };

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];

			nearestSegmentFlat(flat, r, g, b, match);

			// Parameterise the segment from its darker end to its lighter end.
			// `nearestSegmentFlat` walks from the nearest colour, so the
			// direction varies per pixel; normalising it here is what lets
			// `bias` mean "darker" everywhere rather than "toward the nearest
			// colour".
			const flip = luma[match.indexA] > luma[match.indexB];

			const darker = (flip ? match.indexB : match.indexA) * 3;
			const lighter = (flip ? match.indexA : match.indexB) * 3;
			const position = flip ? 1 - match.t : match.t;
			const chosen = position > sample(x, y, scale) + bias ? lighter : darker;

			data[i] = rgb[chosen];
			data[i + 1] = rgb[chosen + 1];
			data[i + 2] = rgb[chosen + 2];
		}
	}

	return image;
}

/**
 * Error-diffusion dither against a palette.
 *
 * Errors are accumulated in a float buffer rather than being written back into
 * the 8-bit image, which would clip and lose most of the correction.
 */
export function diffusionDither(image: DitherImage, options: DiffusionOptions): DitherImage {
	const { palette, kernel } = options;
	const serpentine = options.serpentine ?? true;
	const amount = options.amount ?? 1;
	const { width, height, data } = image;
	const flat = flattenPalette(palette);
	const { rgb } = flat;
	const taps = DIFFUSION_KERNELS[kernel];

	// Working copy of the luminance-carrying channels, in floats.
	const buffer = new Float32Array(width * height * 3);
	for (let p = 0, i = 0; p < buffer.length; p += 3, i += 4) {
		buffer[p] = data[i];
		buffer[p + 1] = data[i + 1];
		buffer[p + 2] = data[i + 2];
	}

	for (let y = 0; y < height; y++) {
		const rightToLeft = serpentine && y % 2 === 1;
		const direction = rightToLeft ? -1 : 1;

		for (let step = 0; step < width; step++) {
			const x = rightToLeft ? width - 1 - step : step;
			const p = (y * width + x) * 3;

			const r = buffer[p];
			const g = buffer[p + 1];
			const b = buffer[p + 2];

			const nearest = nearestColorIndexFlat(flat, r, g, b);
			const index = nearest * 3;
			const cr = rgb[index];
			const cg = rgb[index + 1];
			const cb = rgb[index + 2];

			const i = (y * width + x) * 4;
			data[i] = cr;
			data[i + 1] = cg;
			data[i + 2] = cb;

			const errorR = (r - cr) * amount;
			const errorG = (g - cg) * amount;
			const errorB = (b - cb) * amount;

			for (const tap of taps) {
				const nx = x + tap.dx * direction;
				const ny = y + tap.dy;

				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

				const np = (ny * width + nx) * 3;
				buffer[np] += errorR * tap.weight;
				buffer[np + 1] += errorG * tap.weight;
				buffer[np + 2] += errorB * tap.weight;
			}
		}
	}

	return image;
}

/** Plain nearest-colour quantisation, no dithering — the control case. */
export function quantizeOnly(image: DitherImage, palette: Palette): DitherImage {
	const { data } = image;
	const flat = flattenPalette(palette);
	const { rgb } = flat;

	for (let i = 0; i < data.length; i += 4) {
		const index = nearestColorIndexFlat(flat, data[i], data[i + 1], data[i + 2]) * 3;
		data[i] = rgb[index];
		data[i + 1] = rgb[index + 1];
		data[i + 2] = rgb[index + 2];
	}

	return image;
}

/** Convenience: the average colour of a palette, handy for placeholder fills. */
export function paletteAverage(palette: Palette): RGB {
	const n = palette.colors.length;
	let r = 0;
	let g = 0;
	let b = 0;

	for (const color of palette.colors) {
		r += color[0];
		g += color[1];
		b += color[2];
	}

	return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
