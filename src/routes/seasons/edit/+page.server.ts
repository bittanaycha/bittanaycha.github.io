import { redirect } from '@sveltejs/kit';
import { databaseOf } from '#lib/server/bindings';
import { readPlan } from '#lib/server/plan';
import { localDate } from '#lib/calendar';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ platform, locals, url }) => {
	if (!locals.editor) redirect(303, `/seasons?from=${url.pathname}`);

	const db = databaseOf(platform);
	if (!db) redirect(303, '/seasons');

	return { plan: await readPlan(db), today: localDate(Date.now()) };
};
