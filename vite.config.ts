import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { defineConfig } from 'vite';

const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			paths: { base },
			adapter: adapter({ platformProxy: { configPath: 'wrangler.jsonc' } }),
			// `/seasons` reads the plan from D1 at request time, so it is not prerendered.
			prerender: { entries: ['/', '/dither', '/running'], crawl: false }
		})
	]
});
