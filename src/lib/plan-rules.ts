/**
 * The rules a plan has to satisfy. Shared by the site before a write and by
 * anything that reads the plan, so a bad plan fails in the same place every
 * time.
 *
 * Two shapes live in here, because the plan is two different things. Languages
 * are a fixed set with three slots — one primary, one secondary, everything else
 * tertiary — and what changes over the year is which language sits in which
 * slot. Running, music and study are seasons you name, date and give a length.
 */

/**
 * A block is a name and two dates. `kind` survives on the record so old rows
 * keep their value, but nothing asks for it any more and the ring colours by
 * the order the blocks start in.
 */
export const KINDS = ['running', 'music', 'study', 'season'] as const;
export type Kind = string;

export const SLOTS = ['primary', 'secondary', 'tertiary'] as const;
export type Slot = (typeof SLOTS)[number];

export type Block = {
	id: string;
	kind: Kind;
	title: string;
	detail: string;
	dose: string;
	target: string;
	from: string;
	to: string;
};

export type Language = {
	id: string;
	name: string;
	level: string;
	aim: string;
	stage: string;
	state: string;
};

/** One language holding one slot for a stretch of the year. */
export type Assignment = {
	language: string;
	slot: Slot;
	from: string;
	to: string;
	dose: string;
	target: string;
};

export type Plan = {
	updated: string;
	timezone: string;
	languages: Language[];
	assignments: Assignment[];
	blocks: Block[];
};

const DAY = 86_400_000;

export const day = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();

/** Inclusive length in days; a block that starts and ends on one day is 1. */
export function days(from: string, to: string) {
	return Math.round((day(to) - day(from)) / DAY) + 1;
}

export function weeks(from: string, to: string) {
	return Math.max(1, Math.round(days(from, to) / 7));
}

export function addDays(iso: string, n: number) {
	const date = new Date(day(iso) + n * DAY);
	return date.toISOString().slice(0, 10);
}

export function validDate(value: unknown): value is string {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(day(value));
}

/** The assignment a language holds on a date, if any. */
export function slotOf(plan: Plan, language: string, date: string): Assignment | null {
	return (
		plan.assignments.find(
			(item) => item.language === language && item.from <= date && date <= item.to
		) ?? null
	);
}

/** Who holds what on a date. Every language without an assignment is tertiary. */
export function slotsOn(plan: Plan, date: string): Map<string, Assignment | null> {
	const held = new Map<string, Assignment | null>();
	for (const language of plan.languages) held.set(language.id, slotOf(plan, language.id, date));
	return held;
}

/**
 * Everything wrong with a plan, in the order a person would fix it. An empty
 * array means it can be written.
 */
export function problems(plan: Plan): string[] {
	const found: string[] = [];

	if (!validDate(plan.updated)) found.push(`updated: ${plan.updated} is not a date`);

	const known = new Set<string>();
	for (const language of plan.languages) {
		if (!language.id) found.push('a language has no id');
		if (known.has(language.id)) found.push(`language ${language.id} appears twice`);
		known.add(language.id);
	}

	const blockIds = new Set<string>();
	for (const block of plan.blocks) {
		if (!block.id) found.push('a block has no id');
		if (blockIds.has(block.id)) found.push(`block ${block.id} appears twice`);
		blockIds.add(block.id);

		if (!block.kind) found.push(`${block.id}: a block needs a kind`);
		if (!block.title.trim()) found.push(`${block.id}: no title`);
		if (!validDate(block.from) || !validDate(block.to)) {
			found.push(`${block.id}: ${block.from} to ${block.to} is not a date range`);
			continue;
		}
		if (block.to < block.from) found.push(`${block.id}: ends before it starts`);
	}

	for (const item of plan.assignments) {
		const name = item.language || 'a slot';
		if (!known.has(item.language)) found.push(`${name}: unknown language`);
		if (!SLOTS.includes(item.slot)) found.push(`${name}: unknown slot ${item.slot}`);
		if (!validDate(item.from) || !validDate(item.to)) {
			found.push(`${name}: ${item.from} to ${item.to} is not a date range`);
			continue;
		}
		if (item.to < item.from) found.push(`${name}: ends before it starts`);
	}

	// No language may hold two slots at once.
	const ordered = [...plan.assignments].sort((a, b) => (a.from < b.from ? -1 : 1));
	for (let i = 0; i < ordered.length; i += 1) {
		for (let j = i + 1; j < ordered.length; j += 1) {
			const a = ordered[i];
			const b = ordered[j];
			if (b.from > a.to) break;
			if (a.language === b.language) {
				found.push(`${a.language} holds two slots on ${b.from}`);
			}
		}
	}

	// Only one primary and one secondary may be held at any instant.
	const edges = [...new Set(plan.assignments.flatMap((item) => [item.from, item.to]))].sort();
	for (const edge of edges) {
		if (!validDate(edge)) continue;
		const live = plan.assignments.filter((item) => item.from <= edge && edge <= item.to);
		const primary = live.filter((item) => item.slot === 'primary');
		const secondary = live.filter((item) => item.slot === 'secondary');
		if (primary.length > 1) {
			found.push(`${primary.map((item) => item.language).join(', ')} are all primary on ${edge}`);
		}
		if (secondary.length > 1) {
			found.push(`${secondary.map((item) => item.language).join(', ')} are all secondary on ${edge}`);
		}
	}

	return found;
}
