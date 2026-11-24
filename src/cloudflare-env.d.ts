/**
 * `cloudflare:workers` only exists inside the Workers runtime. The adapter
 * resolves the specifier at build time, so the type just has to describe the
 * `env` it exports.
 */
declare module 'cloudflare:workers' {
	export const env: App.Platform['env'];
}
