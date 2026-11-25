import { asc, eq } from 'drizzle-orm';
import type { Binding } from './db';
import { database } from './db';
import { assignments, blocks, languages, meta } from './schema';
import type { Assignment, Block, Language, Plan } from '../plan-rules';
import { problems } from '../plan-rules';

const STAMP = 'updated';

export async function readPlan(db: Binding): Promise<Plan> {
	const d = database(db);

	const [blockRows, languageRows, assignmentRows, stampRows] = await Promise.all([
		d.select().from(blocks).orderBy(asc(blocks.from)),
		d.select().from(languages).orderBy(asc(languages.position)),
		d.select().from(assignments).orderBy(asc(assignments.from)),
		d.select().from(meta).where(eq(meta.key, STAMP))
	]);

	return {
		updated: stampRows[0]?.value ?? new Date().toISOString().slice(0, 10),
		timezone: 'Europe/Paris',
		languages: languageRows.map((row): Language => ({
			id: row.id,
			name: row.name,
			level: row.level,
			aim: row.aim,
			stage: row.stage,
			state: row.state
		})),
		assignments: assignmentRows.map((row): Assignment => ({
			language: row.language,
			slot: row.slot as Assignment['slot'],
			from: row.from,
			to: row.to
		})),
		blocks: blockRows.map((row): Block => ({
			id: row.id,
			kind: row.kind as Block['kind'],
			title: row.title,
			icon: row.icon,
			detail: row.detail,
			from: row.from,
			to: row.to
		}))
	};
}

export class PlanError extends Error {
	problems: string[];
	constructor(problems: string[]) {
		super(problems.join('; '));
		this.problems = problems;
	}
}

/** Write a whole plan. Either all of it lands or none of it does. */
export async function writePlan(db: Binding, plan: Plan) {
	const found = problems(plan);
	if (found.length > 0) throw new PlanError(found);

	const d = database(db);
	const stamp = plan.updated;

	await d.batch([
		d.delete(blocks),
		d.delete(assignments),
		d.delete(languages),
		...plan.languages.map((language, index) =>
			d.insert(languages).values({
				id: language.id,
				name: language.name,
				level: language.level ?? '',
				aim: language.aim ?? '',
				stage: language.stage ?? '',
				state: language.state ?? '',
				position: index
			})
		),
		...plan.assignments.map((item) =>
			d.insert(assignments).values({
				language: item.language,
				slot: item.slot,
				from: item.from,
				to: item.to
			})
		),
		...plan.blocks.map((block) =>
			d.insert(blocks).values({
				id: block.id,
				kind: block.kind,
				title: block.title,
				icon: block.icon ?? '',
				detail: block.detail ?? '',
				from: block.from,
				to: block.to
			})
		),
		d
			.insert(meta)
			.values({ key: STAMP, value: stamp })
			.onConflictDoUpdate({ target: meta.key, set: { value: stamp } })
	]);
}

/** Bump the plan's stamp without touching the rows. */
export async function touch(db: Binding) {
	const d = database(db);
	const stamp = new Date().toISOString().slice(0, 10);
	await d
		.insert(meta)
		.values({ key: STAMP, value: stamp })
		.onConflictDoUpdate({ target: meta.key, set: { value: stamp } });
	return stamp;
}
