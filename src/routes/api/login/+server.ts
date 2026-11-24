import { json, error } from '@sveltejs/kit';
import { configured, passphraseMatches, unlock } from '#lib/server/auth';
import { envOf } from '#lib/server/bindings';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const env = envOf(platform);
	if (!configured(env)) {
		const missing = [!env.PLAN_PASSPHRASE && 'PLAN_PASSPHRASE', !env.PLAN_SECRET && 'PLAN_SECRET']
			.filter(Boolean)
			.join(' and ');
		throw error(503, `the worker has no ${missing} set`);
	}

	const body = (await request.json().catch(() => ({}))) as { passphrase?: string };
	if (!body.passphrase || !passphraseMatches(env, body.passphrase)) {
		throw error(401, 'wrong passphrase');
	}

	await unlock(cookies, env.PLAN_SECRET as string);
	return json({ ok: true });
};
