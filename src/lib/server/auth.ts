import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'plan_session';
const WEEK = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

async function sign(payload: string, secret: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function configured(env: { PLAN_PASSPHRASE?: string; PLAN_SECRET?: string }) {
	return Boolean(env.PLAN_PASSPHRASE && env.PLAN_SECRET);
}

export function passphraseMatches(env: { PLAN_PASSPHRASE?: string }, attempt: string) {
	const expected = env.PLAN_PASSPHRASE ?? '';
	if (!expected || attempt.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ attempt.charCodeAt(i);
	return diff === 0;
}

export async function open(cookies: Cookies, secret: string) {
	const raw = cookies.get(COOKIE);
	if (!raw) return false;
	const [until, mac] = raw.split('.');
	if (!until || !mac) return false;
	if (Number(until) < Date.now()) return false;
	const expected = await sign(until, secret);
	return expected === mac;
}

export async function unlock(cookies: Cookies, secret: string) {
	const until = String(Date.now() + WEEK * 1000);
	cookies.set(COOKIE, `${until}.${await sign(until, secret)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: WEEK
	});
}

export function lock(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}
