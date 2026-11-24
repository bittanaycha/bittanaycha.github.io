import { error, json } from '@sveltejs/kit';
import { configured, passphraseMatches } from '#lib/server/auth';
import { envOf } from '#lib/server/bindings';
import { PlanError, readPlan, writePlan } from '#lib/server/plan';
import type { Plan } from '#lib/plan-rules';
import type { RequestHandler } from './$types';

export const prerender = false;

/** The plan, as the site and `npm run pull` see it. */
export const GET: RequestHandler = async ({ platform }) => {
	const env = envOf(platform);
	if (!env.DB) throw error(503, 'no database');
	return json(await readPlan(env.DB));
};

/**
 * Replace the whole plan. A browser sends its cookie; the vault scripts send
 * `x-plan-key: <passphrase>` instead, because they are not browsers.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const env = envOf(platform);

	const key = request.headers.get('x-plan-key');
	const allowed = locals.editor || (configured(env) && key !== null && passphraseMatches(env, key));
	if (!allowed) throw error(401, 'not your plan');

	let plan: Plan;
	try {
		plan = (await request.json()) as Plan;
	} catch {
		throw error(400, 'not json');
	}

	if (!plan || !Array.isArray(plan.blocks) || !Array.isArray(plan.languages)) {
		throw error(400, 'a plan needs blocks and languages');
	}

	try {
		await writePlan(env.DB, { ...plan, timezone: plan.timezone ?? 'Europe/Paris' });
	} catch (e) {
		if (e instanceof PlanError) {
			return json({ ok: false, problems: e.problems }, { status: 422 });
		}
		throw e;
	}

	return json({ ok: true, written: await readPlan(env.DB) });
};
