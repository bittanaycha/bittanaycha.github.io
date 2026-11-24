import { databaseOf } from '#lib/server/bindings';
import { readPlan } from '#lib/server/plan';
import { localDate, marksFor, ringWindow, seasonsBetween, winterSolsticeIn } from '#lib/calendar';
import { weeks } from '#lib/plan-rules';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = databaseOf(platform);
	const today = localDate(Date.now());

	if (!db) {
		return {
			ready: false as const,
			editor: locals.editor,
			today,
			window: { from: today, to: today },
			solstice: today,
			seasonName: 'the year',
			seasons: [],
			languages: [],
			assignments: [],
			blocks: [],
			marks: [],
			ko: null,
			updated: today
		};
	}

	const plan = await readPlan(db);

	// The ring is one turn of the year, never more: a plan that runs past it is
	// clipped at the rim rather than squeezed into a longer sweep.
	const turn = ringWindow(today);

	const first = Number(turn.from.slice(0, 4)) - 1;
	const last = Number(turn.to.slice(0, 4)) + 1;
	const marks = [];
	for (let year = first; year <= last; year += 1) marks.push(...marksFor(year));
	const allMarks = marks.sort((a, b) => (a.date < b.date ? -1 : 1));

	const inWindow = allMarks.filter((mark) => mark.date >= turn.from && mark.date <= turn.to);
	const seasons = seasonsBetween(turn.from, turn.to);
	const solstice = winterSolsticeIn(turn.from, turn.to, today);

	// Today's kō comes from the whole almanac, not from the window: the window
	// opens in the past, so its last kō can be behind us.
	const koNow = allMarks.filter((mark) => mark.system === 'ko' && mark.date <= today).at(-1);
	const current = koNow ?? inWindow.filter((mark) => mark.system === 'ko').at(-1) ?? null;

	// Which quarter day opened the season we are standing in.
	const quarters = allMarks.filter((mark) => mark.system === 'astronomical');
	const quarter = quarters.filter((mark) => mark.date <= today).at(-1) ?? quarters[0];

	return {
		ready: true as const,
		editor: locals.editor,
		today,
		window: turn,
		solstice,
		seasonName: quarter?.name.split(' ')[0] ?? 'the year',
		seasons,
		languages: plan.languages,
		assignments: plan.assignments,
		blocks: plan.blocks.map((block) => ({ ...block, weeks: weeks(block.from, block.to) })),
		marks: inWindow.map((mark) => ({
			id: mark.id,
			system: mark.system,
			name: mark.name,
			detail: mark.detail,
			date: mark.date
		})),
		ko: current ?? null,
		updated: plan.updated
	};
};
