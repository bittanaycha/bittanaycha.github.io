/**
 * The screens: four ways to turn a tone into a single bit.
 *
 * A screen is a threshold field — a function of position that returns 0–1 —
 * and the renderer inks a pixel when its tone is above that threshold. Which
 * function you choose is the difference between a digital dither and a printed
 * mark, and the reference work uses at least two of them on the same sheet:
 * stochastic stipple for the stones, an angled line screen for the fur.
 *
 *   stipple   blue-noise ranks — fine, unstructured grain. The default.
 *   bayer     the classic ordered matrix, reconstructed from `bayerThresholds`.
 *   engrave   a line screen at an angle: continuous lines whose width follows
 *             tone. Reads as a printed engraving rather than a dither.
 *   halftone  a rotated cluster-dot screen. Big round dots, obviously printed.
 *
 * All four are pure functions of (x, y), so they tile, test cleanly, and can be
 * evaluated per pixel without carrying state.
 */

import { generateBlueNoise } from '../dither/bluenoise';
import { bayerThresholds, type BayerSize } from '../dither/bayer';

export type ScreenMode = 'stipple' | 'bayer' | 'engrave' | 'halftone';

export type ScreenOptions = {
	mode: ScreenMode;
	/** Pixels per mark (or line pitch). 1 gives single-pixel grain. */
	cell: number;
	/** Rotation in degrees, for the screens that have a grain direction. */
	angle: number;
	/** Matrix size when `mode` is `bayer`. */
	bayerSize: BayerSize;
};

/** Threshold field, in the range 0–1. */
export type Screen = {
	threshold: (x: number, y: number) => number;
};

const TAU = Math.PI * 2;

/** Blue noise repeats at 64px; coarser cells repeat proportionally slower. */
const NOISE_SIZE = 64;

export function createScreen(options: ScreenOptions): Screen {
	const cell = Math.max(1, options.cell);

	if (options.mode === 'stipple') {
		const noise = generateBlueNoise(NOISE_SIZE);
		const size = NOISE_SIZE;
		return {
			threshold: (x, y) => {
				const nx = Math.floor(x / cell) % size;
				const ny = Math.floor(y / cell) % size;
				return noise[ny * size + nx] / 256;
			}
		};
	}

	if (options.mode === 'bayer') {
		const matrix = bayerThresholds(options.bayerSize);
		const size = options.bayerSize;
		return {
			threshold: (x, y) => {
				const nx = Math.floor(x / cell) % size;
				const ny = Math.floor(y / cell) % size;
				return matrix[ny * size + nx];
			}
		};
	}

	const radians = (options.angle * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	// Rotate around the image origin. Without a half-pixel bias the screens
	// start on a pixel boundary, which leaves a visible seam at 0°.
	const ox = 0.5;
	const oy = 0.5;

	if (options.mode === 'engrave') {
		const pitch = Math.max(1.5, cell);
		return {
			threshold: (x, y) => {
				const u = ((x + ox) * cos + (y + oy) * sin) / pitch;
				return u - Math.floor(u);
			}
		};
	}

	// Halftone: a circular spot function on a rotated grid. The normaliser is
	// the distance to the furthest pixel centre in the cell, so the corner of
	// the cell just reaches 1 and the dot grows smoothly with coverage. Below
	// three pixels there is no room for a round dot, so the pitch is clamped
	// rather than letting the screen collapse to a constant.
	const pitch = Math.max(3, cell);
	const reach = ((pitch - 1) / 2) * Math.SQRT2;
	return {
		threshold: (x, y) => {
			const u = ((x + ox) * cos + (y + oy) * sin) / pitch;
			const v = (-(x + ox) * sin + (y + oy) * cos) / pitch;
			const du = (u - Math.floor(u) - 0.5) * pitch;
			const dv = (v - Math.floor(v) - 0.5) * pitch;
			const distance = Math.sqrt(du * du + dv * dv) / reach;
			return Math.min(1, distance);
		}
	};
}

/** Human labels for the lab's segmented control. */
export const screenModes: { value: ScreenMode; label: string; title: string }[] = [
	{ value: 'stipple', label: 'stipple', title: 'Blue-noise grain: single dots, no direction' },
	{ value: 'bayer', label: 'bayer', title: 'Ordered matrix: the classic cross-hatch' },
	{ value: 'engrave', label: 'engrave', title: 'Angled line screen, like a plate engraving' },
	{ value: 'halftone', label: 'halftone', title: 'Rotated cluster dots, like a newspaper photo' }
];

export { TAU };
