/**
 * Target palettes and colour matching.
 *
 * Distances use the "redmean" approximation of perceptual colour difference.
 * It costs about as much as plain Euclidean RGB distance but avoids the worst
 * of RGB's mistakes — most visibly, it stops mid-greys from snapping to
 * saturated colours in palettes like PICO-8 or the C64 set.
 */

export type RGB = readonly [number, number, number];

export type Palette = {
	id: string;
	name: string;
	/** Short note shown in the UI. */
	note: string;
	colors: RGB[];
};

export function hexToRgb(hex: string): RGB {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16)
	] as const;
}

export function rgbToHex([r, g, b]: RGB): string {
	const to = (v: number) =>
		Math.max(0, Math.min(255, Math.round(v)))
			.toString(16)
			.padStart(2, '0');
	return `#${to(r)}${to(g)}${to(b)}`;
}

/** Evenly spaced greyscale ramp of `steps` entries, black through white. */
export function grayscalePalette(steps: number): RGB[] {
	if (steps <= 1) return [[0, 0, 0]];
	return Array.from({ length: steps }, (_, i) => {
		const v = Math.round((i / (steps - 1)) * 255);
		return [v, v, v] as const;
	});
}

function fromHex(id: string, name: string, note: string, hexes: string[]): Palette {
	return { id, name, note, colors: hexes.map(hexToRgb) };
}

export const palettes: Palette[] = [
	fromHex('bw', '1-bit', 'Pure black and white. The harshest, most legible option.', [
		'#000000',
		'#ffffff'
	]),
	{
		id: 'gray4',
		name: '4 greys',
		note: 'Four evenly spaced steps — where Bayer cross-hatching reads most clearly.',
		colors: grayscalePalette(4)
	},
	{
		id: 'gray8',
		name: '8 greys',
		note: 'Eight steps, close to a smooth gradient at small dither scales.',
		colors: grayscalePalette(8)
	},
	fromHex('gameboy', 'Game Boy', 'The four green shades of the original DMG LCD.', [
		'#0f380f',
		'#306230',
		'#8bac0f',
		'#9bbc0f'
	]),
	fromHex(
		'pico8',
		'PICO-8',
		'Sixteen colours with a wide value range — good for testing colour matching.',
		[
			'#000000',
			'#1d2b53',
			'#7e2553',
			'#008751',
			'#ab5236',
			'#5f574f',
			'#c2c3c7',
			'#fff1e8',
			'#ff004d',
			'#ffa300',
			'#ffec27',
			'#00e436',
			'#29adff',
			'#83769c',
			'#ff77a8',
			'#ffccaa'
		]
	),
	fromHex('c64', 'Commodore 64', 'The 16-colour VIC-II hardware palette.', [
		'#000000',
		'#ffffff',
		'#883932',
		'#67b6bd',
		'#8b3f96',
		'#55a049',
		'#40318d',
		'#bfce72',
		'#8b5429',
		'#574200',
		'#b86962',
		'#505050',
		'#787878',
		'#94e089',
		'#7869c4',
		'#9f9f9f'
	]),
	fromHex(
		'amber',
		'CRT amber',
		'A single-hue phosphor ramp — everything becomes a glowing terminal.',
		['#140b00', '#3d2200', '#7a4600', '#b8720f', '#e8a33d', '#ffd08a']
	),
	fromHex(
		'ice',
		'Glacier',
		'A cool blue-to-white ramp for when you want less contrast than 1-bit.',
		['#05070f', '#131c33', '#26375c', '#3f5c8a', '#6f8fbd', '#a8c4e0', '#e2edf7']
	)
];

export const defaultPaletteId = 'gray4';

export function paletteById(id: string): Palette {
	return palettes.find((p) => p.id === id) ?? palettes[0];
}

/** Rec. 709 relative luminance on the 0–255 scale. */
export function luminance([r, g, b]: RGB): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Squared "redmean" perceptual distance from six raw channel values.
 *
 * This is the scalar form used by every hot loop. Taking numbers rather than
 * two `RGB` tuples matters more than it looks: the tuple version has to build
 * two arrays per call, and a per-pixel loop over a megapixel image turns that
 * into millions of short-lived allocations. Same arithmetic, no garbage.
 */
export function colorDistanceChannels(
	r1: number,
	g1: number,
	b1: number,
	r2: number,
	g2: number,
	b2: number
): number {
	const rmean = (r1 + r2) * 0.5;
	const dr = r1 - r2;
	const dg = g1 - g2;
	const db = b1 - b2;

	return (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
}

/**
 * Squared perceptual distance (redmean) between two colours. Returned squared
 * so callers avoid a `sqrt` per candidate.
 */
export function colorDistanceSq(a: RGB, b: RGB): number {
	return colorDistanceChannels(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/**
 * A palette in the form the hot loops want: flat typed arrays, no nested
 * objects and no property lookups against the caller's data structure.
 *
 * That last point is not just micro-optimisation. A palette handed down from a
 * Svelte component is a `$state` proxy, so every `palette.colors[i]` in a
 * per-pixel loop goes through the reactive get-trap. Measured on a half
 * megapixel image, reading through the proxy cost ~1.8s where reading a
 * flattened copy costs ~26ms — same arithmetic, 67x apart. Flattening once per
 * dither call makes the library fast regardless of what the caller passes.
 */
export type FlatPalette = {
	/** RGB triples, length `count * 3`. */
	rgb: Uint8Array;
	/** Rec. 709 luminance per entry, precomputed for the darker/lighter ordering. */
	luma: Float32Array;
	count: number;
};

/** Copy a palette into typed arrays. Call once per dither operation. */
export function flattenPalette(palette: Palette): FlatPalette {
	// The caller's `colors` is read exactly once, here. Everything downstream
	// works off the typed arrays, so a reactive proxy is never consulted again.
	const colors = palette.colors;
	const count = colors.length;
	const rgb = new Uint8Array(count * 3);
	const luma = new Float32Array(count);

	for (let i = 0; i < count; i++) {
		const [r, g, b] = colors[i];
		rgb[i * 3] = r;
		rgb[i * 3 + 1] = g;
		rgb[i * 3 + 2] = b;
		luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	return { rgb, luma, count };
}

/** Index of the nearest entry in a flattened palette. */
export function nearestColorIndexFlat(
	palette: FlatPalette,
	r: number,
	g: number,
	b: number
): number {
	const { rgb, count } = palette;

	let bestIndex = 0;
	let bestDistance = Infinity;

	for (let i = 0; i < count; i++) {
		const j = i * 3;
		const d = colorDistanceChannels(r, g, b, rgb[j], rgb[j + 1], rgb[j + 2]);

		if (d < bestDistance) {
			bestDistance = d;
			bestIndex = i;
		}
	}

	return bestIndex;
}

/** The palette segment that best approximates a colour, plus where along it. */
export type SegmentMatch = {
	indexA: number;
	indexB: number;
	/** Position along the segment from `indexA` to `indexB`, clamped to 0–1. */
	t: number;
};

/**
 * Allocation-free form of {@link nearestSegment}, against a flattened palette.
 * Writes into `out` so it can be called once per pixel.
 */
export function nearestSegmentFlat(
	palette: FlatPalette,
	r: number,
	g: number,
	b: number,
	out: SegmentMatch
): SegmentMatch {
	const { rgb, count } = palette;

	let indexA = 0;
	let bestDistance = Infinity;

	for (let i = 0; i < count; i++) {
		const j = i * 3;
		const d = colorDistanceChannels(r, g, b, rgb[j], rgb[j + 1], rgb[j + 2]);

		if (d < bestDistance) {
			bestDistance = d;
			indexA = i;
		}
	}

	out.indexA = indexA;

	if (count === 1) {
		out.indexB = indexA;
		out.t = 0;
		return out;
	}

	// Among the remaining entries, pick the one whose segment with `indexA`
	// passes closest to the source colour.
	const anchor = indexA * 3;
	const ar = rgb[anchor];
	const ag = rgb[anchor + 1];
	const ab = rgb[anchor + 2];

	let indexB = indexA === 0 ? 1 : 0;
	let bestSegment = Infinity;

	for (let i = 0; i < count; i++) {
		if (i === indexA) continue;

		const j = i * 3;
		const dx = rgb[j] - ar;
		const dy = rgb[j + 1] - ag;
		const dz = rgb[j + 2] - ab;
		const lengthSq = dx * dx + dy * dy + dz * dz;

		let t = 0;
		if (lengthSq > 0) {
			t = ((r - ar) * dx + (g - ag) * dy + (b - ab) * dz) / lengthSq;
			t = t < 0 ? 0 : t > 1 ? 1 : t;
		}

		const distance = colorDistanceChannels(r, g, b, ar + t * dx, ag + t * dy, ab + t * dz);

		if (distance < bestSegment) {
			bestSegment = distance;
			indexB = i;
		}
	}

	const partner = indexB * 3;
	const dx = rgb[partner] - ar;
	const dy = rgb[partner + 1] - ag;
	const dz = rgb[partner + 2] - ab;
	const lengthSq = dx * dx + dy * dy + dz * dz;

	let t = 0.5;
	if (lengthSq > 0) {
		t = ((r - ar) * dx + (g - ag) * dy + (b - ab) * dz) / lengthSq;
		t = t < 0 ? 0 : t > 1 ? 1 : t;
	}

	out.indexB = indexB;
	out.t = t;
	return out;
}

/** Index of the nearest palette entry to `(r, g, b)`. */
export function nearestColorIndex(r: number, g: number, b: number, palette: Palette): number {
	return nearestColorIndexFlat(flattenPalette(palette), r, g, b);
}

/** Palette-taking form of {@link nearestSegmentFlat}, for one-off lookups. */
export function nearestSegmentInto(
	r: number,
	g: number,
	b: number,
	palette: Palette,
	out: SegmentMatch
): SegmentMatch {
	return nearestSegmentFlat(flattenPalette(palette), r, g, b, out);
}

/**
 * The two nearest palette entries and the position of the source colour along
 * the line between them.
 *
 * Ordered dithering against an arbitrary palette needs more than "nearest
 * colour plus a nudge" — that produces banding and colour shifts. Instead we
 * find the segment of the palette that best approximates the colour, then let
 * the threshold decide where along that segment to land. This is the idea
 * behind Yliluoma's ordered dithering.
 *
 * For a per-pixel loop, flatten the palette once and call
 * {@link nearestSegmentFlat} instead.
 */
export function nearestSegment(r: number, g: number, b: number, palette: Palette): SegmentMatch {
	return nearestSegmentFlat(flattenPalette(palette), r, g, b, { indexA: 0, indexB: 0, t: 0 });
}
