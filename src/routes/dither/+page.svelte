<script lang="ts">
	import { onMount } from 'svelte';
	import InkStack from '#lib/components/InkStack.svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import Slider from '#lib/components/Slider.svelte';
	import { decodeImage } from '#lib/decode';
	import type { BayerSize } from '#lib/dither/bayer';
	import { inkSetById, inkSetRamp, type InkSet } from '#lib/studio/inks';
	import { renderPlate, type PlateOptions } from '#lib/studio/render';
	import type { FrameMessage, StaleMessage } from '#lib/studio/render.worker';
	import { createStonesDrawing, createStonesPhoto } from '#lib/studio/samples';
	import { screenModes, type ScreenMode } from '#lib/studio/screen';

	/** Longest edge of the on-screen print, in device pixels. */
	const MAX_EDGE = 1400;

	/**
	 * While the controls are moving, frames are thrown away faster than they are
	 * printed: a draft is dithered at this edge instead, and a full print lands
	 * once the hand stops.
	 */
	const DRAFT_EDGE = 620;
	const SETTLE = 180;

	// Everything bound to a `Segmented` is a plain string; narrowing the type
	// would fight `bind:`. The casts happen in `options()`.
	let mode = $state('stipple');
	let bayerSize = $state('8');
	let shape = $state('patch');

	let cell = $state(3);
	let angle = $state(35);
	let bias = $state(0);
	let gain = $state(0);
	let black = $state(0.1);
	let white = $state(0.96);
	let gamma = $state(1);
	let invert = $state(false);
	let grain = $state(0.32);
	let roughness = $state(0.32);
	let inset = $state(0.1);
	let outline = $state(3);
	let seed = $state(11);

	let ink = $state<InkSet>({ ...inkSetById('kraft') });

	let stage = $state<HTMLDivElement | null>(null);
	let output = $state<HTMLCanvasElement | null>(null);
	let overlay = $state<HTMLCanvasElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	let source = $state<HTMLCanvasElement | null>(null);
	let sourceName = $state('sample photo');
	let sourceRatio = $state(1.4);
	let revision = $state(0);
	let stageWidth = $state(0);

	let comparing = $state(false);
	let dragging = $state(false);
	let resolution = $state('');
	let elapsed = $state(0);

	let worker: Worker | null = null;
	let jobId = 0;
	let sourceRevision = 0;
	let busy = false;
	let dirty = false;
	let wantFull = false;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	let observer: ResizeObserver | undefined;

	const status = $derived(
		`${sourceName} · ${resolution} · ${elapsed.toFixed(1)} ms` + (dragging ? ' · drop to load' : '')
	);

	/**
	 * One settings object for both the preview and the export.
	 *
	 * `scale` scales everything measured in pixels: the screen cell, the dot
	 * gain, the outline. Rendering at 2× with 2× marks produces the same
	 * artwork, just with smaller pixels.
	 */
	function options(scale = 1): PlateOptions {
		return {
			tone: { black, white, gamma, invert },
			screen: {
				mode: mode as ScreenMode,
				cell: cell * scale,
				angle,
				bayerSize: Number(bayerSize) as BayerSize
			},
			bias,
			gain: gain * scale,
			ramp: inkSetRamp(ink),
			grain,
			shape: shape === 'patch' ? { inset, roughness, seed, outline: outline * scale } : null,
			seed
		};
	}

	/** Cover-fit: the print has the source's aspect, and never letterboxes. */
	function drawCover(
		ctx: CanvasRenderingContext2D,
		image: HTMLCanvasElement,
		width: number,
		height: number
	) {
		const scale = Math.max(width / image.width, height / image.height);
		const drawWidth = image.width * scale;
		const drawHeight = image.height * scale;
		ctx.clearRect(0, 0, width, height);
		ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
	}

	/** Pixel size of a print at the current stage width. */
	function targetSize(full: boolean): { width: number; height: number } {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const edge = full ? MAX_EDGE : DRAFT_EDGE;
		const width = Math.min(edge, Math.max(240, Math.round(stageWidth * dpr)));
		return { width, height: Math.max(1, Math.round(width / sourceRatio)) };
	}

	/**
	 * Something changed. Print a draft straight away, and arm a full-resolution
	 * print for when the changes stop.
	 *
	 * A job in flight is never stacked: the queue is one flag, so a burst of
	 * fifty colour events costs one frame of work at a time and always for the
	 * newest state.
	 */
	function invalidate() {
		dirty = true;
		wantFull = false;
		clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			wantFull = true;
			dirty = true;
			pump();
		}, SETTLE);
		pump();
	}

	function pump() {
		if (busy || !dirty || !source || stageWidth === 0) return;

		dirty = false;
		busy = true;
		const full = wantFull;
		wantFull = false;

		const { width, height } = targetSize(full);
		const frameId = jobId++;
		const print = targetSize(true);
		resolution = `${print.width} × ${print.height}`;

		if (worker) {
			worker.postMessage({
				type: 'render',
				id: frameId,
				sourceId: sourceRevision,
				width,
				height,
				options: options()
			});
			return;
		}

		// No worker (older browser, or the module failed to load): do the same
		// work here. Drafts still keep the page responsive; only the full print
		// pauses.
		printHere(full);
		settle();
	}

	/** The fallback path: draw, dither and blit, on this thread. */
	function printHere(full: boolean) {
		const canvas = output;
		const image = source;
		if (!canvas || !image) return;

		const print = targetSize(true);
		if (canvas.width !== print.width || canvas.height !== print.height) {
			canvas.width = print.width;
			canvas.height = print.height;
		}

		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;

		const { width, height } = targetSize(full);
		const scratch = document.createElement('canvas');
		scratch.width = width;
		scratch.height = height;

		const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
		if (!scratchContext) return;

		drawCover(scratchContext, image, width, height);
		const pixels = scratchContext.getImageData(0, 0, width, height);
		const started = performance.now();
		renderPlate(pixels, options());
		elapsed = performance.now() - started;
		scratchContext.putImageData(pixels, 0, 0);

		ctx.imageSmoothingEnabled = width !== print.width;
		ctx.drawImage(scratch, 0, 0, print.width, print.height);
	}

	function onWorkerFrame(event: MessageEvent<FrameMessage | StaleMessage>) {
		if (event.data.type === 'stale') {
			// The image had not arrived yet. Let go of the job and try again in a
			// moment; the image itself re-triggers a render when it lands.
			busy = false;
			dirty = true;
			setTimeout(pump, 60);
			return;
		}

		const { bitmap, elapsed: ms } = event.data;
		const canvas = output;
		const ctx = canvas?.getContext('2d');

		if (canvas && ctx) {
			// The canvas stays at the size of a finished print, so a draft never
			// reallocates the backing store; it is simply drawn up from 620px.
			const { width, height } = targetSize(true);
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}

			ctx.imageSmoothingEnabled = bitmap.width !== width;
			ctx.drawImage(bitmap, 0, 0, width, height);
		}

		bitmap.close();
		elapsed = ms;
		drawOverlay();
		settle();
	}

	function settle() {
		busy = false;
		if (dirty || wantFull) pump();
	}

	function drawOverlay() {
		const canvas = overlay;
		const image = source;
		const base = output;
		if (!comparing || !canvas || !image || !base) return;

		if (canvas.width !== base.width || canvas.height !== base.height) {
			canvas.width = base.width;
			canvas.height = base.height;
		}

		const ctx = canvas.getContext('2d');
		if (ctx) drawCover(ctx, image, canvas.width, canvas.height);
	}

	function loadCanvas(canvas: HTMLCanvasElement, name: string) {
		source = canvas;
		sourceName = name;
		sourceRatio = canvas.width / canvas.height;

		const id = ++sourceRevision;
		if (!worker) {
			revision += 1;
			return;
		}

		// The worker keeps its own copy of the pixels, so every render after this
		// one is just options — but the copy is a decode, so the render is only
		// requested once the worker actually has it. Bumping `revision` first
		// would print the previous photograph and then never redraw.
		void createImageBitmap(canvas)
			.then((bitmap) => {
				worker?.postMessage({ type: 'source', sourceId: id, bitmap }, [bitmap]);
			})
			.catch(() => {
				// No bitmap factory, or it refused the canvas: send the pixels.
				const context = canvas.getContext('2d', { willReadFrequently: true });
				const pixels = context?.getImageData(0, 0, canvas.width, canvas.height);
				if (pixels) worker?.postMessage({ type: 'source', sourceId: id, pixels });
			})
			.finally(() => {
				if (id === sourceRevision) revision += 1;
			});
	}

	function chooseSample(kind: 'photo' | 'drawing') {
		if (kind === 'photo') {
			loadCanvas(createStonesPhoto(), 'sample photo');
			ink = { ...inkSetById('kraft') };
			mode = 'stipple';
			shape = 'patch';
			cell = 3;
			gain = 0;
			black = 0.1;
			white = 0.96;
			gamma = 1;
			invert = false;
		} else {
			loadCanvas(createStonesDrawing(), 'sample drawing');
			ink = { ...inkSetById('bone') };
			mode = 'stipple';
			shape = 'full';
			cell = 1;
			gain = 0;
			black = 0.12;
			white = 0.92;
			gamma = 1;
			invert = false;
		}
	}

	async function loadFile(file: File) {
		try {
			const canvas = await decodeImage(file);
			loadCanvas(canvas, file.name.replace(/\.[^.]+$/, '') || 'image');
		} catch (error) {
			// Streams, PDFs and phone formats this browser has no decoder for.
			// Say which file and why, instead of failing quietly.
			const reason = error instanceof Error ? error.message : 'unknown reason';
			resolution = `${file.name} — ${reason}`.slice(0, 90);
		}
	}

	function onPaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (!item.type.startsWith('image/')) continue;
			const file = item.getAsFile();
			if (file) void loadFile(file);
			return;
		}
	}

	function savePng() {
		const image = source;
		const base = output;
		if (!image || !base) return;

		// 2× the preview, with every pixel-scale control doubled to match. The
		// preview may be a draft, so the size comes from the stage, not the canvas.
		const scale = 2;
		const size = targetSize(true);
		const canvas = document.createElement('canvas');
		canvas.width = size.width * scale;
		canvas.height = size.height * scale;

		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;

		drawCover(ctx, image, canvas.width, canvas.height);
		const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
		renderPlate(pixels, options(scale));
		ctx.putImageData(pixels, 0, 0);

		canvas.toBlob((blob) => {
			if (!blob) return;
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `dither-${ink.id}-${Date.now()}.png`;
			link.click();
			URL.revokeObjectURL(link.href);
		}, 'image/png');
	}

	// Re-render whenever a control, the source, or the panel width changes.
	$effect(() => {
		void [
			revision,
			stageWidth,
			mode,
			bayerSize,
			shape,
			cell,
			angle,
			bias,
			gain,
			black,
			white,
			gamma,
			invert,
			grain,
			roughness,
			inset,
			outline,
			seed,
			ink.base,
			ink.inks.join()
		];

		if (!source) return;

		invalidate();
	});

	$effect(() => {
		if (comparing) drawOverlay();
	});

	onMount(() => {
		if (stage) {
			observer = new ResizeObserver((entries) => {
				stageWidth = entries[0].contentRect.width;
			});
			observer.observe(stage);
		}

		window.addEventListener('paste', onPaste);

		if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
			try {
				worker = new Worker(new URL('../../lib/studio/render.worker.ts', import.meta.url), {
					type: 'module'
				});
				worker.onmessage = onWorkerFrame;
				worker.onerror = () => {
					// A worker that cannot start is not an error worth showing: fall
					// back to rendering on this thread and carry on.
					worker?.terminate();
					worker = null;
					invalidate();
				};
			} catch {
				worker = null;
			}
		}

		// Drawing the sample is a per-pixel loop; let the page paint first.
		const handle = requestAnimationFrame(() => chooseSample('photo'));

		return () => {
			observer?.disconnect();
			window.removeEventListener('paste', onPaste);
			cancelAnimationFrame(handle);
			clearTimeout(settleTimer);
			worker?.terminate();
			worker = null;
		};
	});
</script>

<svelte:head>
	<meta
		name="description"
		content="Photographs and drawings cut down to one screen and two inks — a dithering studio for printed marks."
	/>
</svelte:head>

<main class="studio">
	<header class="studio-head">
		<span class="eyebrow">studio</span>
		<h1>Dither</h1>
		<p class="blurb">
			A photograph or a drawing, reduced to one screen and two inks. Drop your own image, or start
			from the stones.
		</p>
	</header>

	<div class="bench">
		<div class="stage-col">
			<div
				class="stage"
				class:stage--drop={dragging}
				bind:this={stage}
				role="presentation"
				ondragover={(event) => {
					event.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={(event) => {
					event.preventDefault();
					dragging = false;
					const file = event.dataTransfer?.files?.[0];
					if (file) void loadFile(file);
				}}
			>
				<div class="frame" style:aspect-ratio={sourceRatio}>
					<canvas bind:this={output} aria-label="Dithered print of {sourceName}"></canvas>

					{#if comparing}
						<canvas bind:this={overlay} class="overlay" aria-hidden="true"></canvas>
					{/if}
				</div>
			</div>

			<div class="toolbar">
				<button type="button" class="chip chip--accent" onclick={() => fileInput?.click()}>
					open image…
				</button>
				<button type="button" class="chip" onclick={() => chooseSample('photo')}>
					sample photo
				</button>
				<button type="button" class="chip" onclick={() => chooseSample('drawing')}>
					sample drawing
				</button>
				<button type="button" class="chip" onclick={savePng}>save png ×2</button>
				<button
					type="button"
					class="chip"
					class:on={comparing}
					onclick={() => (comparing = !comparing)}
					aria-pressed={comparing}
				>
					{comparing ? 'dither' : 'source'}
				</button>

				<span class="status">{status}</span>
			</div>

			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				class="sr-only"
				onchange={(event) => {
					const file = event.currentTarget.files?.[0];
					if (file) void loadFile(file);
					event.currentTarget.value = '';
				}}
			/>

			<p class="hint eyebrow">drop or paste an image</p>
		</div>

		<aside class="panel">
			<Segmented label="Screen" bind:value={mode} options={screenModes} columns={2} />

			<Slider
				label="mark size"
				bind:value={cell}
				min={1}
				max={6}
				step={1}
				format={(value) => `${value}px`}
			/>

			{#if mode === 'engrave' || mode === 'halftone'}
				<Slider
					label="angle"
					bind:value={angle}
					min={0}
					max={180}
					step={1}
					format={(value) => `${value}°`}
				/>
			{/if}

			{#if mode === 'bayer'}
				<Segmented
					label="matrix"
					bind:value={bayerSize}
					options={[
						{ value: '2', label: '2×2' },
						{ value: '4', label: '4×4' },
						{ value: '8', label: '8×8' },
						{ value: '16', label: '16×16' }
					]}
				/>
			{/if}

			<Slider
				label="dot gain"
				bind:value={gain}
				min={-2}
				max={2}
				step={1}
				format={(value) => (value > 0 ? `+${value}px` : `${value}px`)}
			/>

			<Slider
				label="threshold bias"
				bind:value={bias}
				min={-0.3}
				max={0.3}
				step={0.01}
				format={(value) => value.toFixed(2)}
			/>

			<hr class="rule" />

			<Slider
				label="black point"
				bind:value={black}
				min={0}
				max={0.6}
				step={0.01}
				format={(value) => value.toFixed(2)}
			/>
			<Slider
				label="white point"
				bind:value={white}
				min={0.4}
				max={1}
				step={0.01}
				format={(value) => value.toFixed(2)}
			/>
			<Slider
				label="gamma"
				bind:value={gamma}
				min={0.4}
				max={2.4}
				step={0.02}
				format={(value) => value.toFixed(2)}
			/>

			<label class="check">
				<input type="checkbox" bind:checked={invert} />
				invert tone
			</label>

			<hr class="rule" />

			<InkStack bind:value={ink} />

			<hr class="rule" />

			<Segmented
				label="Sheet"
				bind:value={shape}
				options={[
					{ value: 'full', label: 'edge to edge' },
					{ value: 'patch', label: 'pebble' }
				]}
			/>

			{#if shape === 'patch'}
				<Slider
					label="inset"
					bind:value={inset}
					min={0}
					max={0.3}
					step={0.01}
					format={(value) => `${Math.round(value * 100)}%`}
				/>
				<Slider
					label="roughness"
					bind:value={roughness}
					min={0}
					max={1}
					step={0.01}
					format={(value) => value.toFixed(2)}
				/>
				<Slider
					label="outline"
					bind:value={outline}
					min={0}
					max={6}
					step={1}
					format={(value) => `${value}px`}
				/>
				<button type="button" class="chip" onclick={() => (seed = Math.floor(Math.random() * 9999))}>
					new pebble
				</button>
			{/if}

			<Slider
				label="grain"
				bind:value={grain}
				min={0}
				max={1}
				step={0.01}
				format={(value) => value.toFixed(2)}
			/>
		</aside>
	</div>
</main>

<style>
	.studio {
		max-width: 72rem;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 3rem) var(--gutter) clamp(3rem, 8vw, 5rem);
	}

	.studio-head {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: baseline;
		column-gap: 1rem;
		margin-bottom: 1.75rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--rule);
	}

	.studio-head h1 {
		margin: 0;
		font-family: var(--serif);
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		font-weight: 400;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--ink);
	}

	.blurb {
		grid-column: 1 / -1;
		max-width: 34rem;
		margin: 0.35rem 0 0;
		font-size: 0.95rem;
		color: var(--ink);
	}

	.bench {
		display: grid;
		gap: 1.5rem;
	}

	@media (min-width: 60rem) {
		.bench {
			grid-template-columns: minmax(0, 1fr) minmax(0, 20rem);
			align-items: start;
		}
	}

	.stage-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	@media (min-width: 60rem) {
		.stage-col {
			position: sticky;
			top: 5rem;
		}
	}

	.stage {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--rule);
		background: var(--paper-deep);
		padding: 0.5rem;
		transition: border-color 0.15s ease;
	}

	.stage--drop {
		border-color: var(--accent);
	}

	.frame {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: #000;
	}

	.frame canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.overlay {
		position: absolute;
		inset: 0;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.75rem;
	}

	.chip {
		border: 1px solid var(--rule);
		padding: 0.375rem 0.75rem;
		background: none;
		font-family: var(--mono);
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
		color: var(--ink-dim);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.chip:hover {
		border-color: var(--rule-strong);
		color: var(--ink);
	}
	.chip--accent {
		border-color: color-mix(in oklab, var(--accent) 60%, transparent);
		color: var(--accent);
	}
	.chip--accent:hover {
		border-color: var(--accent);
		background: color-mix(in oklab, var(--accent) 10%, transparent);
	}
	.chip.on {
		border-color: var(--accent);
		background: color-mix(in oklab, var(--accent) 10%, transparent);
		color: var(--accent);
	}

	.status {
		margin-left: auto;
		color: color-mix(in oklab, var(--ink-dim) 70%, transparent);
		font-variant-numeric: tabular-nums;
	}

	.hint {
		margin: 0;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--rule);
		background: color-mix(in oklab, var(--paper-deep) 92%, transparent);
		padding: 1.25rem;
	}

	.panel .rule {
		margin: 0;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--ink-dim);
	}

	.check input {
		accent-color: var(--accent);
	}

	@media (max-width: 40rem) {
		.status {
			margin-left: 0;
			flex-basis: 100%;
		}
	}
</style>
