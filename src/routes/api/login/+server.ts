import { json, error } from '@sveltejs/kit';
import { configured, passphraseMatches, unlock } from '#lib/server/auth';
import { envOf } from '#lib/server/bindings';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const env = envOf(platform);
	if (!configured(env)) throw error(503, 'no passphrase set on the server');

	const body = (await request.json().catch(() => ({}))) as { passphrase?: string };
	if (!body.passphrase || !passphraseMatches(env, body.passphrase)) {
		throw error(401, 'wrong passphrase');
	}

	await unlock(cookies, env.PLAN_SECRET as string);
	return json({ ok: true });
};
