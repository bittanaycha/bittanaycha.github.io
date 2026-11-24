import { databaseOf } from '#lib/server/bindings';
import { readPlan } from '#lib/server/plan';
import { localDate, marksFor } from '#lib/calendar';
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
	const year = Number(today.slice(0, 4));

	// The ring is one turn of the year, from the winter solstice to the next, so
	// the solstice sits at the wheel's leftmost point. The season in the header is
	// the quarter we are actually in, which need not be inside that window.
	const marks = [...marksFor(year), ...marksFor(year + 1)];
	const quarters = marks
		.filter((mark) => mark.system === 'astronomical')
		.sort((a, b) => (a.date < b.date ? -1 : 1));
	// The ring and the strip both start at the winter solstice, which the wheel
	// puts at its leftmost point.
	const solstices = quarters.filter((mark) => mark.name.toLowerCase().includes('winter'));
	const opening = solstices.find((mark) => mark.date > today) ?? solstices[0];
	const closing =
		solstices.find(
			(mark) => mark.date > opening.date && mark.date.slice(5) === opening.date.slice(5)
		) ?? solstices[solstices.length - 1];

	const inWindow = marks.filter((mark) => mark.date >= opening.date && mark.date < closing.date);

	const allMarks = [...marksFor(year - 1), ...marksFor(year), ...marksFor(year + 1)].sort((a, b) =>
		a.date < b.date ? -1 : 1
	);

	// Today's kō comes from the whole almanac, not from the window: the window
	// starts at the next solstice, so its first kō is a month away.
	const koNow = allMarks.filter((mark) => mark.system === 'ko' && mark.date <= today).at(-1);
	const current = koNow ?? inWindow.find((mark) => mark.system === 'ko') ?? null;

	const seasons = quarters
		.filter((mark) => mark.date >= opening.date && mark.date < closing.date)
		.map((mark, index, all) => ({
			// The quarter the season opens on names it: autumn, winter, spring, summer.
			name: mark.name.split(' ')[0],
			detail: mark.name,
			from: mark.date,
			to: all[index + 1]?.date ?? closing.date
		}));


	// Which quarter day opened the season we are standing in.
	const allQuarters = allMarks.filter((mark) => mark.system === 'astronomical');
	const quarter = allQuarters.filter((mark) => mark.date <= today).at(-1) ?? allQuarters[0];

	return {
		ready: true as const,
		editor: locals.editor,
		today,
		window: { from: opening.date, to: closing.date },
		seasonName: quarter.name.split(' ')[0],
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
