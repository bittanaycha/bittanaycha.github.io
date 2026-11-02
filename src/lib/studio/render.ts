/**
 * The plate renderer: tone in, printed sheet out.
 *
 * The pipeline is deliberately short, because every stage is one someone can
 * see and name:
 *
 *   photo ──▶ tone (levels, gamma, invert) ──▶ screen threshold ──▶ ink mask
 *         ──▶ dot gain ──▶ sheet shape ──▶ ink ramp ──▶ paper grain
 *
 * Tone is a single float per pixel, so the renderer is monochrome by
 * construction. Colour comes from the ink ramp: the tone is matched into the
 * sorted stack and dithered between the two neighbouring stops. Two stops give
 * the one-bit print of the reference; three or four give the overprinted riso
 * look without changing a line of the pixel loop.
 *
 * Nothing in here touches the DOM, so the whole thing is testable in node.
 */

import type { DitherImage } from '../dither/quantize';
import type { InkRamp } from './inks';
import { blobMask, dilateMask, erodeMask, hash2, type BlobOptions } from './mask';
import { createScreen, type ScreenOptions } from './screen';

export type ToneOptions = {
	/** Input level mapped to black, 0–1. */
	black: number;
	/** Input level mapped to white, 0–1. */
	white: number;
	gamma: number;
	invert: boolean;
};

export type SheetOptions = BlobOptions & {
	/** Outline thickness in pixels, drawn just inside the patch edge. */
	outline: number;
};

export type PlateOptions = {
	tone: ToneOptions;
	screen: ScreenOptions;
	/** Pushes the threshold toward more or less ink. −0.3–0.3. */
	bias: number;
	/** Dot gain in pixels: positive fattens marks, negative thins them. */
	gain: number;
	ramp: InkRamp;
	/** Paper and ink grain, 0–1. */
	grain: number;
	/** Cut the print into an irregular patch. `null` prints edge to edge. */
	shape: SheetOptions | null;
	seed: number;
};

/** Grain is applied to every channel equally, so it reads as paper, not noise. */
const GRAIN_AMOUNT = 15;

/**
 * A tile of two-octave value noise, generated once and repeated. At
 * `GRAIN_AMOUNT` amplitude the repeat is invisible, and it keeps the cost out
 * of the per-pixel loop.
 */
function grainTile(seed: number): Float32Array {
	const SIZE = 256;
	const tile = new Float32Array(SIZE * SIZE);

	function lattice(x: number, y: number, cell: number, offset: number): number {
		return hash2(x % cell, y % cell, seed + offset);
	}

	function value(x: number, y: number, cell: number, offset: number): number {
		const fx = x / cell;
		const fy = y / cell;
		const x0 = Math.floor(fx);
		const y0 = Math.floor(fy);
		const tx = fx - x0;
		const ty = fy - y0;
		const sx = tx * tx * (3 - 2 * tx);
		const sy = ty * ty * (3 - 2 * ty);

		const a = lattice(x0, y0, cell, offset);
		const b = lattice(x0 + 1, y0, cell, offset);
		const c = lattice(x0, y0 + 1, cell, offset);
		const d = lattice(x0 + 1, y0 + 1, cell, offset);

		return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
	}

	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			// Two octaves: a slow mottle, plus a fibre-ish grain.
			const value1 = value(x, y, 32, 0);
			const value2 = value(x, y, 8, 97);
			tile[y * SIZE + x] = (value1 - 0.5) * 0.75 + (value2 - 0.5) * 0.45;
		}
	}

	return tile;
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The transfer curve, as a 256-entry table.
 *
 * Tone is a pure function of luminance, and luminance is one byte per pixel,
 * so the expensive parts (levels, gamma) can be evaluated 256 times instead of
 * once per pixel. Both the public `toneFromImage` and the render loop read
 * this table, which keeps the two from drifting apart.
 */
export function toneLut(options: ToneOptions): Float32Array {
	const lut = new Float32Array(256);
	const black = Math.min(options.black, options.white - 1 / 255);
	const span = Math.max(1 / 255, options.white - black);
	const gamma = Math.max(0.05, options.gamma);

	for (let i = 0; i < 256; i++) {
		let value = clamp01((i / 255 - black) / span);
		if (gamma !== 1) value = Math.pow(value, gamma);
		lut[i] = options.invert ? 1 - value : value;
	}

	return lut;
}

/** Byte luminance, rounded rather than truncated so mid-greys stay mid. */
function lumaByte(data: Uint8ClampedArray, i: number): number {
	return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] + 0.5) | 0;
}

/**
 * Scratch buffers, reused across frames.
 *
 * A slider drag renders ten times a second at a megapixel a frame; allocating
 * a fresh pair of masks each time turns a smooth drag into GC pauses.
 */
let scratchLength = 0;
let scratchChosen = new Uint8Array(0);
let scratchPrinted = new Uint8Array(0);

function scratch(length: number): { chosen: Uint8Array; printed: Uint8Array } {
	if (scratchLength < length) {
		scratchLength = length;
		scratchChosen = new Uint8Array(length);
		scratchPrinted = new Uint8Array(length);
	}

	return { chosen: scratchChosen, printed: scratchPrinted };
}

/**
 * Reduce the source to one tone per pixel.
 *
 * Levels first, then gamma, then an optional inversion. Inversion is a
 * deliberate lever rather than a fix-up: a negative print is a legitimate
 * choice, and a scan of white paper with dark lines is not.
 */
export function toneFromImage(image: DitherImage, options: ToneOptions): Float32Array {
	const { data } = image;
	const tone = new Float32Array(image.width * image.height);
	const lut = toneLut(options);

	for (let i = 0, p = 0; p < tone.length; i += 4, p++) {
		tone[p] = lut[lumaByte(data, i)];
	}

	return tone;
}

/**
 * Render `image` in place.
 *
 * In-place keeps the hot path allocation-free and matches `orderedDither`, so
 * the page can reuse one ImageData across frames.
 */
export function renderPlate(image: DitherImage, options: PlateOptions): DitherImage {
	const { width, height, data } = image;
	const { ramp, screen, bias, grain, shape, seed } = options;

	const lut = toneLut(options.tone);
	const threshold = createScreen(screen).threshold;

	const count = ramp.count;
	const baseIndex = ramp.baseIndex;
	const contrastIndex = ramp.contrastIndex;
	// Where dot gain should push a pixel that has been grown into ink.
	const nearestInk = baseIndex === 0 ? Math.min(1, count - 1) : Math.max(0, count - 2);

	const { chosen, printed } = scratch(width * height);

	for (let y = 0, p = 0, i = 0; y < height; y++) {
		for (let x = 0; x < width; x++, p++, i += 4) {
			const value = lut[lumaByte(data, i)] + bias;

			// Walk the luminance-sorted ramp to the two stops this tone sits
			// between, then dither across them. With two stops this is exactly
			// `tone > threshold`.
			let index;
			if (value <= ramp.luma[0]) {
				index = 0;
			} else if (value >= ramp.luma[count - 1]) {
				index = count - 1;
			} else {
				let lo = 0;
				while (lo < count - 2 && value > ramp.luma[lo + 1]) lo++;
				const span = ramp.luma[lo + 1] - ramp.luma[lo];
				const position = span > 0 ? (value - ramp.luma[lo]) / span : 0;
				index = position > threshold(x, y) ? lo + 1 : lo;
			}

			// Transparent pixels carry no ink, whichever end of the ramp the
			// substrate sits at. This is what makes line art on a transparent
			// PNG behave without the caller flattening it first.
			if (data[i + 3] < 128) index = baseIndex;

			chosen[p] = index;
			printed[p] = index === baseIndex ? 0 : 1;
		}
	}

	// Dot gain. Growing the ink mask (rather than biasing the threshold) is
	// what makes printed marks look fatter instead of merely darker — the
	// tone stays put and the dots grow into their neighbours' space.
	const gainRadius = Math.round(options.gain);
	let mask: Uint8Array = printed;
	if (gainRadius > 0) {
		mask = dilateMask(printed, width, height, gainRadius);
	} else if (gainRadius < 0) {
		mask = erodeMask(printed, width, height, -gainRadius);
	}

	let blob: Uint8Array | null = null;
	let interior: Uint8Array | null = null;

	if (shape) {
		blob = blobMask(width, height, shape);
		interior = shape.outline > 0 ? erodeMask(blob, width, height, shape.outline) : blob;
	}

	const paper = grainTile(seed);
	const paperSize = 256;

	for (let y = 0, p = 0, i = 0; y < height; y++) {
		const ty = (y & (paperSize - 1)) * paperSize;

		for (let x = 0; x < width; x++, p++, i += 4) {
			let index: number;

			if (blob && !blob[p]) {
				index = baseIndex;
			} else if (blob && interior && !interior[p]) {
				// The outline is drawn in the colour at the far end of the ramp,
				// which is the ink the motifs themselves are printed in.
				index = contrastIndex;
			} else if (mask[p]) {
				index = printed[p] ? chosen[p] : nearestInk;
			} else {
				index = baseIndex;
			}

			const r = ramp.rgb[index * 3];
			const g = ramp.rgb[index * 3 + 1];
			const b = ramp.rgb[index * 3 + 2];

			if (grain > 0) {
				const mottle = paper[ty + (x & (paperSize - 1))];
				const fine = hash2(x, y, seed) - 0.5;
				const noise = (mottle + fine * 0.35) * GRAIN_AMOUNT * grain;

				data[i] = r + noise;
				data[i + 1] = g + noise;
				data[i + 2] = b + noise;
			} else {
				data[i] = r;
				data[i + 1] = g;
				data[i + 2] = b;
			}

			data[i + 3] = 255;
		}
	}

	return image;
}
