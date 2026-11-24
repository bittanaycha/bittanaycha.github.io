type Env = App.Platform['env'];

/**
 * In a deployed Worker the bindings arrive on `event.platform`. Under `vite dev`
 * the adapter keeps its proxy on `globalThis` instead, so read that as well.
 */
export function envOf(platform: App.Platform | undefined): Partial<Env> {
	const proxy = (
		globalThis as {
			__sveltekit_cloudflare_platform?: { env?: Partial<Env> };
		}
	).__sveltekit_cloudflare_platform;
	return platform?.env ?? proxy?.env ?? {};
}

export function databaseOf(platform: App.Platform | undefined) {
	return envOf(platform).DB;
}
