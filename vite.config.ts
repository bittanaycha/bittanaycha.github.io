import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * GitHub Pages has two flavours:
 *
 *   user site      https://<user>.github.io          → repo named <user>.github.io, BASE_PATH=""
 *   project site   https://<user>.github.io/<repo>   → BASE_PATH="/<repo>"
 *
 * Set BASE_PATH in the environment (or as a repo variable in Actions) for a
 * project site. Nothing else needs to change — every link goes through
 * `base` from `$app/paths`.
 */
const base = process.env.BASE_PATH ?? '';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: undefined,
				precompress: false,
				strict: true
			}),
			paths: { base },
			prerender: { entries: ['*'] }
		})
	]
});
