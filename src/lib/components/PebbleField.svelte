<script module lang="ts">
	// Decoded once per session and shared by every plate on the page: a resize
	// should cost one dither, not seven more network round trips. Kept at module
	// scope so it is plainly not component state.
	const imageCache: Record<string, Promise<HTMLImageElement | null>> = {};

	function load(src: string): Promise<HTMLImageElement | null> {
		const cached = imageCache[src];
		if (cached) return cached;

		const pending = new Promise<HTMLImageElement | null>((resolve) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => resolve(null);
			image.src = src;
		});

		imageCache[src] = pending;
		return pending;
	}
</script>

<script lang="ts">
	/**
	 * The home plate: a handful of photographs cut into pebbles, joined by a
	 * wandering line, then printed through the same renderer as the lab.
	 *
	 * The composite is built in colour (photographs clipped to hand-cut shapes)
	 * on a black field, so that everything the photographs do not cover falls
	 * below the black point and comes out as bare paper. The dithering, the ink
	 * ramp and the grain are all `renderPlate`; only the outlines and the
	 * connectors are drawn afterwards, straight onto the canvas, so they stay
	 * crisp instead of dissolving into the screen.
	 */
	import { onMount } from 'svelte';
	import { hash2, outlineRadius } from '#lib/plate/mask';
	import { inkSets, inkSetRamp, type InkSet } from '#lib/plate/inks';
	import { renderPlate } from '#lib/plate/render';

	export type PlatePebble = {
		/** Path under static/, e.g. `/photos/fox.jpg`. */
		src: string;
		/** Centre and radius in units of the plate width. */
		x: number;
		y: number;
		r: number;
		seed: number;
	};

	type Props = {
		pebbles: PlatePebble[];
		/** Pairs of indices to join with a connector. */
		links?: [number, number][];
		inks?: InkSet;
		cell?: number;
		grain?: number;
		roughness?: number;
		label?: string;
		class?: string;
	};

	let {
		pebbles,
		links = [],
		inks = inkSets[0],
		cell = 3,
		grain = 0.2,
		roughness = 0.34,
		label = 'a plate of photographed plants and animals, printed in two inks',
		class: className = ''
	}: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let ready = $state(false);
	let failed = $state(false);
	let frame = 0;
	let drawToken = 0;
	let observer: ResizeObserver | undefined;

	const BINS = 512;
	const ASPECT = 4 / 3;

	/** Closed outline of one pebble at a given size, in canvas pixels. */
	function pebblePath(pebble: PlatePebble, width: number, height: number): Path2D {
		const path = new Path2D();
		const radius = outlineRadius(pebble.seed, roughness, BINS);
		const cx = pebble.x * width;
		const cy = pebble.y * height;
		const rx = pebble.r * width;
		const ry = pebble.r * width;

		for (let i = 0; i <= BINS; i++) {
			const index = i % BINS;
			const angle = (index / BINS) * Math.PI * 2;
			const r = radius[index];
			const px = cx + Math.cos(angle) * r * rx;
			const py = cy + Math.sin(angle) * r * ry;
			if (index === 0) path.moveTo(px, py);
			else path.lineTo(px, py);
		}

		path.closePath();
		return path;
	}

	/** Where the outline sits at a given angle, so connectors meet the edge. */
	function edgePoint(
		pebble: PlatePebble,
		angle: number,
		width: number,
		height: number
	): { x: number; y: number; r: number } {
		const radius = outlineRadius(pebble.seed, roughness, BINS);
		const index = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
		const r = radius[Math.floor(index * BINS) % BINS];
		return {
			x: pebble.x * width + Math.cos(angle) * r * pebble.r * width,
			y: pebble.y * height + Math.sin(angle) * r * pebble.r * width,
			r
		};
	}

	function coverRect(image: HTMLImageElement, size: number) {
		const scale = Math.max(size / image.width, size / image.height);
		const w = image.width * scale;
		const h = image.height * scale;
		return { x: (size - w) / 2, y: (size - h) / 2, w, h };
	}

	/**
	 * Every photograph gets its own tonal stretch, because a print does not care
	 * what the camera metered for. Each pebble is re-centred on its own 5–95
	 * percentile band before it is composited, so a backlit fox and a cactus on
	 * a white sweep both come out with a full range of tone instead of one solid
	 * patch of ink.
	 */
	function stretched(image: HTMLImageElement, size: number): HTMLCanvasElement {
		const buffer = document.createElement('canvas');
		buffer.width = Math.max(1, Math.round(size));
		buffer.height = Math.max(1, Math.round(size));
		const brush = buffer.getContext('2d');
		if (!brush) return buffer;

		const rect = coverRect(image, size);
		brush.drawImage(image, rect.x, rect.y, rect.w, rect.h);

		const pixels = brush.getImageData(0, 0, buffer.width, buffer.height);
		const data = pixels.data;
		const histogram = new Uint32Array(256);
		for (let i = 0; i < data.length; i += 4) {
			histogram[(data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8]++;
		}

		const total = data.length / 4;
		const percentile = (fraction: number) => {
			let seen = 0;
			for (let level = 0; level < 256; level++) {
				seen += histogram[level];
				if (seen >= total * fraction) return level / 255;
			}
			return 1;
		};

		// Normalise into a printable band rather than stretching freely, then
		// sink the edge of every pebble into the paper. The photographs are
		// framed with a thin plate vignette, so the outer ring prints as bare
		// board and the subject keeps a full range of tone in the middle — the
		// way a duotone print falls off at the edge of a screen.
		const low = percentile(0.05);
		const high = percentile(0.95);
		const span = Math.max(0.08, high - low);
		const FLOOR = 0.12;
		const CEILING = 1.04;
		const width = buffer.width;
		const half = width / 2;

		for (let i = 0; i < data.length; i += 4) {
			const pixel = i / 4;
			const dx = ((pixel % width) - half) / half;
			const dy = (Math.floor(pixel / width) - half) / half;
			const radius = Math.sqrt(dx * dx + dy * dy);

			let vignette = (radius - 0.42) / 0.62;
			vignette = vignette <= 0 ? 0 : vignette >= 1 ? 1 : vignette;
			vignette = 1 - 0.74 * vignette * vignette;

			for (let channel = 0; channel < 3; channel++) {
				let value = (data[i + channel] / 255 - low) / span;
				value = value <= 0 ? 0 : value >= 1 ? 1 : value;
				data[i + channel] = (FLOOR + (CEILING - FLOOR) * value) * vignette * 255;
			}
		}

		brush.putImageData(pixels, 0, 0);
		return buffer;
	}

	async function draw() {
		if (!canvas) return;
		const width = canvas.width;
		const height = canvas.height;
		if (!width || !height) return;

		const composite = document.createElement('canvas');
		composite.width = width;
		composite.height = height;
		const brush = composite.getContext('2d');
		if (!brush) return;
		brush.fillStyle = '#000';
		brush.fillRect(0, 0, width, height);

		const token = ++drawToken;
		const images = await Promise.all(pebbles.map((pebble) => load(pebble.src)));
		if (token !== drawToken) return;

		if (images.every((image) => image === null)) {
			failed = true;
			return;
		}

		const paths = pebbles.map((pebble) => pebblePath(pebble, width, height));

		pebbles.forEach((pebble, index) => {
			const image = images[index];
			if (!image) return;
			const size = pebble.r * width * 2.1;
			brush.save();
			brush.clip(paths[index]);
			brush.drawImage(
				stretched(image, size),
				pebble.x * width - size / 2,
				pebble.y * height - size / 2,
				size,
				size
			);
			brush.restore();
		});

		const source = brush.getImageData(0, 0, width, height);
		const ramp = inkSetRamp(inks);

		const printed = renderPlate(source, {
			tone: { black: 0.01, white: 0.97, gamma: 1, invert: false },
			screen: { mode: 'stipple', cell, angle: 35, bayerSize: 8 },
			bias: 0,
			gain: 0,
			ramp,
			grain,
			shape: null,
			seed: 3
		});

		const context = canvas.getContext('2d');
		if (!context) return;
		const out = new ImageData(printed.width, printed.height);
		out.data.set(printed.data);
		context.putImageData(out, 0, 0);

		// Outlines and connectors are ink, not screen: drawn after the dither so
		// they keep their weight.
		const inkIndex = ramp.contrastIndex * 3;
		const ink = `rgb(${ramp.rgb[inkIndex]},${ramp.rgb[inkIndex + 1]},${ramp.rgb[inkIndex + 2]})`;
		context.strokeStyle = ink;
		context.lineCap = 'round';
		context.lineJoin = 'round';

		context.lineWidth = Math.max(1.5, width * 0.0026);
		for (const path of paths) context.stroke(path);

		context.lineWidth = Math.max(1, width * 0.0019);
		for (const [a, b] of links) {
			const from = pebbles[a];
			const to = pebbles[b];
			if (!from || !to) continue;

			const angle = Math.atan2((to.y - from.y) * height, (to.x - from.x) * width);
			const start = edgePoint(from, angle, width, height);
			const end = edgePoint(to, angle + Math.PI, width, height);

			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const length = Math.hypot(dx, dy) || 1;
			const nx = -dy / length;
			const ny = dx / length;
			const wobble = length * 0.07;

			context.beginPath();
			context.moveTo(start.x, start.y);
			for (let step = 1; step <= 24; step++) {
				const t = step / 24;
				const bow = Math.sin(t * Math.PI) * wobble;
				const shake = (hash2(step, a * 31 + b, 7) - 0.5) * wobble * 0.55;
				context.lineTo(
					start.x + dx * t + nx * (bow + shake),
					start.y + dy * t + ny * (bow + shake)
				);
			}
			context.stroke();
		}

		ready = true;
	}

	function measure() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (!rect.width) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const width = Math.min(1500, Math.round(rect.width * dpr));
		const height = Math.round(width * ASPECT);
		if (width === canvas.width && height === canvas.height) return;
		canvas.width = width;
		canvas.height = height;
		void draw();
	}

	function schedule() {
		window.clearTimeout(frame);
		frame = window.setTimeout(measure, 140);
	}

	onMount(() => {
		schedule();
		observer = new ResizeObserver(schedule);
		if (canvas) observer.observe(canvas);
		return () => {
			observer?.disconnect();
			window.clearTimeout(frame);
		};
	});
</script>

<div
	class="plate {ready ? 'is-ready' : 'plate--loading'} {className}"
	style="aspect-ratio: 3 / 4"
	role="img"
	aria-label={label}
>
	<canvas bind:this={canvas}></canvas>
</div>

{#if failed}
	<p class="eyebrow" style="margin-top: 0.75rem">plate unavailable</p>
{/if}
