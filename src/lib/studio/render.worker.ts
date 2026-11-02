/// <reference lib="webworker" />
/**
 * The plate renderer, off the main thread.
 *
 * `renderPlate` is pure — it takes pixels and a plain options object and gives
 * pixels back — so it can run anywhere. Here it runs in a worker that owns a
 * copy of the source bitmap and an `OffscreenCanvas`: the page sends the size
 * and the options, gets an `ImageBitmap` back, and never blocks. Dragging a
 * colour well stays at 60fps even while a 1400px print is being dithered.
 *
 * The source is posted once per image; every render after that is a few hundred
 * bytes of options plus a handful of typed arrays.
 */
import { renderPlate, type PlateOptions } from './render';

type SourceMessage =
	| { type: 'source'; sourceId: number; bitmap: ImageBitmap }
	| { type: 'source'; sourceId: number; pixels: ImageData };

type RenderMessage = {
	type: 'render';
	id: number;
	sourceId: number;
	width: number;
	height: number;
	options: PlateOptions;
};

/** The job was drawn for a source this worker has not received yet. */
export type StaleMessage = { type: 'stale'; id: number };

export type FrameMessage = {
	type: 'frame';
	id: number;
	bitmap: ImageBitmap;
	elapsed: number;
};

const scope = self as unknown as DedicatedWorkerGlobalScope;

let source: OffscreenCanvas | null = null;
let sourceId = 0;
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;

scope.onmessage = (event: MessageEvent<SourceMessage | RenderMessage>) => {
	const message = event.data;

	if (message.type === 'source') {
		source = asCanvas(message);
		sourceId = message.sourceId;
		return;
	}

	// A job that arrives before its image would print the previous photograph.
	// Say so instead of guessing; the page draws again once the image lands.
	if (!source || message.sourceId !== sourceId) {
		scope.postMessage({ type: 'stale', id: message.id } satisfies StaleMessage);
		return;
	}

	const { width, height, options, id } = message;
	if (width < 1 || height < 1) return;

	if (!canvas || canvas.width !== width || canvas.height !== height) {
		canvas = new OffscreenCanvas(width, height);
		context = canvas.getContext('2d', { willReadFrequently: true });
	}
	if (!context) return;

	const started = performance.now();

	// Cover-fit, exactly as the page would: the print has the source's aspect.
	const scale = Math.max(width / source.width, height / source.height);
	const drawWidth = source.width * scale;
	const drawHeight = source.height * scale;
	context.clearRect(0, 0, width, height);
	context.drawImage(
		source,
		(width - drawWidth) / 2,
		(height - drawHeight) / 2,
		drawWidth,
		drawHeight
	);

	const pixels = context.getImageData(0, 0, width, height);
	renderPlate(pixels, options);
	context.putImageData(pixels, 0, 0);

	// Transferring the frame out is zero-copy; the canvas resets and is redrawn
	// on the next job.
	const bitmap = canvas.transferToImageBitmap();
	scope.postMessage(
		{ type: 'frame', id, bitmap, elapsed: performance.now() - started } satisfies FrameMessage,
		[bitmap]
	);
};

/**
 * The page normally hands over a transferred `ImageBitmap`, which costs nothing
 * to move. If its bitmap factory is missing or refuses the canvas, the pixels
 * arrive as `ImageData` instead — same picture, one copy.
 */
function asCanvas(message: SourceMessage): OffscreenCanvas {
	if ('bitmap' in message) {
		const { bitmap } = message;
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
		bitmap.close();
		return canvas;
	}

	const { pixels } = message;
	const canvas = new OffscreenCanvas(pixels.width, pixels.height);
	canvas.getContext('2d')?.putImageData(pixels, 0, 0);
	return canvas;
}
