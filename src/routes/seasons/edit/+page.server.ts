import { redirect } from '@sveltejs/kit';
import { databaseOf } from '#lib/server/bindings';
import { readPlan } from '#lib/server/plan';
import { localDate, yearWindow } from '#lib/calendar';
import type { PageServerLoad } from './$types';

export const prerender = false;

// The plan on this page is the same plan the public page reads, so a visitor
// without the passphrase can still see it. Only saving is refused; the page
// renders the passphrase field instead of the form.
export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = databaseOf(platform);
	if (!db) redirect(303, '/seasons');

	const today = localDate(Date.now());
	return {
		plan: await readPlan(db),
		today,
		window: yearWindow(today),
		locked: !locals.editor
	};
};
