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

	// The ring runs from the quarter day we are in, to the same one a year on.
	const marks = [...marksFor(year), ...marksFor(year + 1)];
	const quarters = marks
		.filter((mark) => mark.system === 'astronomical')
		.sort((a, b) => (a.date < b.date ? -1 : 1));
	const opening = quarters.filter((mark) => mark.date <= today).at(-1) ?? quarters[0];
	const closing =
		quarters.find(
			(mark) => mark.date > opening.date && mark.date.slice(5) === opening.date.slice(5)
		) ?? quarters[4];

	const inWindow = marks.filter((mark) => mark.date >= opening.date && mark.date < closing.date);

	const seasons = quarters
		.filter((mark) => mark.date >= opening.date && mark.date < closing.date)
		.map((mark, index, all) => ({
			// The quarter the season opens on names it: autumn, winter, spring, summer.
			name: mark.name.split(' ')[0],
			detail: mark.name,
			from: mark.date,
			to: all[index + 1]?.date ?? closing.date
		}));

	const ko = inWindow.filter((mark) => mark.system === 'ko');
	const current = ko.filter((mark) => mark.date <= today).at(-1) ?? ko[ko.length - 1];

	return {
		ready: true as const,
		editor: locals.editor,
		today,
		window: { from: opening.date, to: closing.date },
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
