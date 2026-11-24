import { json } from '@sveltejs/kit';
import { lock } from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ cookies }) => {
	lock(cookies);
	return json({ ok: true });
};
