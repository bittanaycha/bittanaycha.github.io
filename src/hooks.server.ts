import { open } from '#lib/server/auth';
import { envOf } from '#lib/server/bindings';
import type { Handle } from '@sveltejs/kit/hooks';

/**
 * Work out once per request whether this browser is allowed to edit.
 *
 * `envOf` returns nothing while prerendering, where there is no Worker to ask
 * for bindings, so this costs one empty check per prerendered page.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const env = envOf(event.platform);
	event.locals.editor = Boolean(env?.PLAN_SECRET) && (await open(event.cookies, env!.PLAN_SECRET!));
	return resolve(event);
};
