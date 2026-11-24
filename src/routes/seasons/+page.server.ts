import { databaseOf } from '#lib/server/bindings';
import { readPlan } from '#lib/server/plan';
import { localDate, marksFor, yearWindow } from '#lib/calendar';
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

	// Half a year either side of today, so nothing that matters is left off the
	// rim: the winter solstice is wherever it falls in that window.
	const turn = yearWindow(today);
	const opening = { date: turn.from };
	const closing = { date: turn.to };

	const marks = [
		...marksFor(year - 1),
		...marksFor(year),
		...marksFor(year + 1),
		...marksFor(year + 2)
	];
	const quarters = marks
		.filter((mark) => mark.system === 'astronomical')
		.sort((a, b) => (a.date < b.date ? -1 : 1));

	const inWindow = marks.filter((mark) => mark.date >= opening.date && mark.date < closing.date);

	const allMarks = [...marks].sort((a, b) => (a.date < b.date ? -1 : 1));

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
