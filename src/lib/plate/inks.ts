/**
 * Ink stacks: a substrate plus one to three printed inks.
 *
 * This is a risograph model, not a palette. A palette says "these are the
 * colours the image may use". An ink stack says "this is the paper, these are
 * the drums" — the colours exist before the image does, and the image is
 * squeezed into them. That distinction is the whole aesthetic of the print
 * work this lab is modelled on: the paper is never white and the ink is never
 * grey, so every image inherits the same warmth.
 *
 * The one rule that makes rendering simple: {@link buildInkRamp} sorts the
 * stack by luminance, and the renderer walks that ramp with the pixel's own
 * luminance. Nothing else needs to know which colour is "paper"; a dark
 * substrate prints light ink, a cream substrate prints dark ink, and the same
 * code covers both.
 */

import { hexToRgb, luminance, type RGB } from '../dither/palettes';

export type InkSet = {
	id: string;
	name: string;
	note: string;
	/** The substrate. Usually, but not necessarily, the darkest colour. */
	base: string;
	/** Printed inks, in the order they would be overprinted. */
	inks: string[];
};

/**
 * The curated stacks.
 *
 * `kraft` is measured from the reference covers (see `moodboard/`); the rest
 * are variations on the same idea — one substrate, one or two drums, no
 * attempt at full colour.
 */
export const inkSets: InkSet[] = [
	{
		id: 'kraft',
		name: 'Kraft & bone',
		note: 'The reference: unbleached board, one warm white ink, nothing else.',
		base: '#463523',
		inks: ['#d6d5cb']
	},
	{
		id: 'kraft-cyan',
		name: 'Kraft & cyan',
		note: 'Kraft and bone, with a cyan drum in the midtones. The covers do exactly this with their titles.',
		base: '#463523',
		inks: ['#d6d5cb', '#3fa9d4']
	},
	{
		id: 'bone',
		name: 'Bone & iron',
		note: 'Cream stock, black ink. The drawing stack — line work reads at full contrast.',
		base: '#e9e2d2',
		inks: ['#17130f']
	},
	{
		id: 'bone-red',
		name: 'Bone & vermilion',
		note: 'Cream, black, and a red that sits in the midtones like a second pass through the press.',
		base: '#eae2d1',
		inks: ['#171310', '#c0442c']
	},
	{
		id: 'slate',
		name: 'Slate & chalk',
		note: 'Cold board and white chalk. The same structure as kraft, a different temperature.',
		base: '#23272c',
		inks: ['#dfe3e3']
	},
	{
		id: 'oxide',
		name: 'Oxide & ochre',
		note: 'Burnt brown, orange, and a gold highlight. Print-shop colours rather than screen colours.',
		base: '#2b1b13',
		inks: ['#c9602b', '#e8c162']
	},
	{
		id: 'riso',
		name: 'Riso pink & blue',
		note: 'The loud one. Cream stock, blue shadows, fluorescent pink midtones.',
		base: '#f0ebdf',
		inks: ['#26409e', '#ff4d92']
	},
	{
		id: 'blueprint',
		name: 'Blueprint',
		note: 'Deep blue stock and a pale ink. Good for drawings and diagrams, bad for faces.',
		base: '#16253c',
		inks: ['#cfe0ee']
	}
];

export const defaultInkSetId = 'kraft';

export function inkSetById(id: string): InkSet {
	return inkSets.find((set) => set.id === id) ?? inkSets[0];
}

/**
 * A stack in the form the pixel loop wants: flat typed arrays sorted by
 * luminance, plus the index of the substrate.
 *
 * Sorting by luminance is what lets one renderer handle both polarities. A
 * brown board with white ink sorts dark-to-light and prints ink where the
 * photo is bright; a cream board with black ink sorts the other way round and
 * prints ink where the photo is dark. The ramp is the same ramp.
 */
export type InkRamp = {
	/** RGB triples, length `count * 3`, darkest entry first. */
	rgb: Uint8Array;
	/** Rec. 709 luminance per entry, normalised to 0–1. */
	luma: Float32Array;
	count: number;
	/** Where the substrate landed in the sorted ramp. */
	baseIndex: number;
	/** The far end of the ramp from the substrate — outlines and specks use it. */
	contrastIndex: number;
};

export function buildInkRamp(base: RGB, inks: RGB[]): InkRamp {
	type Entry = { rgb: RGB; isBase: boolean };

	const entries: Entry[] = [
		{ rgb: base, isBase: true },
		...inks.map((rgb): Entry => ({ rgb, isBase: false }))
	];

	entries.sort((a, b) => luminance(a.rgb) - luminance(b.rgb));

	const count = entries.length;
	const rgb = new Uint8Array(count * 3);
	const luma = new Float32Array(count);
	let baseIndex = 0;

	for (let i = 0; i < count; i++) {
		const [r, g, b] = entries[i].rgb;
		rgb[i * 3] = r;
		rgb[i * 3 + 1] = g;
		rgb[i * 3 + 2] = b;
		luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

		if (entries[i].isBase) baseIndex = i;
	}

	// The ink at the far end of the ramp from the substrate. It is what the
	// patch outline is drawn in, so it reads as a line rather than a fill.
	const contrastIndex = baseIndex === 0 ? count - 1 : 0;

	return { rgb, luma, count, baseIndex, contrastIndex };
}

/** Convenience: build a ramp straight from a curated set. */
export function inkSetRamp(set: InkSet): InkRamp {
	return buildInkRamp(
		hexToRgb(set.base),
		set.inks.map((hex) => hexToRgb(hex))
	);
}

/** The stack as an ordered list of hex colours, for swatches in the UI. */
export function inkSetSwatches(set: InkSet): string[] {
	return [set.base, ...set.inks];
}
