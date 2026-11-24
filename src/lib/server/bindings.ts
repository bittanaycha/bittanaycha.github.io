import { env as cloudflareEnv } from 'cloudflare:workers';

/**
 * The Worker's bindings. `cloudflare:workers` is real in a deployed Worker and a
 * proxy over `wrangler dev`'s bindings locally, which is why this import is the
 * one to use in both. `platform.env` is what a request carries when the adapter
 * hands it over, and it wins when it is there.
 */
export function envOf(platform: App.Platform | undefined): Partial<App.Platform['env']> {
	const fromPlatform = platform?.env;
	if (fromPlatform && fromPlatform.DB) return fromPlatform;

	try {
		// The proxy throws on the first property read when there is no Worker
		// behind it, which is exactly the prerender case.
		const env = cloudflareEnv as unknown as Partial<App.Platform['env']>;
		return env?.DB ? env : {};
	} catch {
		return {};
	}
}

export function databaseOf(platform: App.Platform | undefined) {
	return envOf(platform).DB;
}
