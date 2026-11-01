/**
 * A file from the desktop, as a canvas the renderers can read.
 *
 * `createImageBitmap` is the fast path, but it is also the fussiest: it refuses
 * anything whose decoder it does not own — HEIC out of a phone, some
 * progressive JPEGs, camera files — even when the browser itself would happily
 * paint the image. So a failure there falls back to an `<img>`, which uses the
 * platform decoders and applies the EXIF rotation on the way in.
 *
 * The result is always upright and never longer than `limit` on its long edge:
 * the prints are dithered at screen resolution, so a 48-megapixel original is
 * only ever going to be resampled down afterwards.
 */
export async function decodeImage(source: Blob, limit = 2400): Promise<HTMLCanvasElement> {
	const frame = await decode(source);
	const scale = Math.min(1, limit / Math.max(frame.width, frame.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(frame.width * scale));
	canvas.height = Math.max(1, Math.round(frame.height * scale));

	const context = canvas.getContext('2d');
	if (!context) throw new Error('this browser would not give us a 2d canvas');

	context.drawImage(frame.source, 0, 0, canvas.width, canvas.height);
	frame.close?.();
	return canvas;
}

type Frame = { source: CanvasImageSource; width: number; height: number; close?: () => void };

async function decode(source: Blob): Promise<Frame> {
	if (typeof createImageBitmap === 'function') {
		try {
			const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
			return {
				source: bitmap,
				width: bitmap.width,
				height: bitmap.height,
				close: () => bitmap.close()
			};
		} catch (first) {
			// Fall through: an <img> may still be able to read it.
			if (import.meta.env.DEV) console.warn('createImageBitmap refused the file', first);
		}
	}

	const image = await loadImage(source);
	return { source: image, width: image.naturalWidth, height: image.naturalHeight };
}

function loadImage(source: Blob): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(source);
	const image = new Image();
	image.decoding = 'sync';
	image.src = url;

	const release = () => URL.revokeObjectURL(url);

	return (
		image.decode
			? image.decode()
			: new Promise<void>((resolve, reject) => {
					image.onload = () => resolve();
					image.onerror = () => reject(new Error('the browser could not decode this file'));
				})
	)
		.then(() => {
			release();
			return image;
		})
		.catch((error) => {
			release();
			throw error;
		});
}
