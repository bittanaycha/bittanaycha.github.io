#!/usr/bin/env node
/**
 * Reads the marathon pages out of the Yggdrasil vault and writes the two data
 * files the site imports. Run it after editing the plan, a week note or the
 * training log:
 *
 *   npm run sync
 *
 * The vault path can be overridden with YGDRASIL_VAULT. Nothing here runs at
 * build time: the generated files are committed, so the deploy never needs the
 * vault.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = process.env.YGDRASIL_VAULT ?? join(process.env.HOME ?? '', 'Vaults/Yggdrasil');

const MARATHON = join(vault, 'Marathon');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const read = (path) => readFileSync(path, 'utf8');

function iso(date) {
	return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
}

function utc(isoDate) {
	const [y, m, d] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

/** Cells of a markdown table row, without the leading and trailing pipes. */
function cells(line) {
	return line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((cell) => cell.trim());
}

function quote(value) {
	if (value === null || value === undefined) return 'null';
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

// ---------------------------------------------------------------- week notes

const plan = JSON.parse(read(join(MARATHON, 'plan.json')));
const dayRows = [];
const problems = [];

for (const week of plan.weeks) {
	const file = join(vault, week.file);
	let text;
	try {
		text = read(file);
	} catch {
		problems.push(`missing week note for week ${week.week}: ${week.file}`);
		continue;
	}

	const start = utc(week.start);
	let year = start.getUTCFullYear();
	let lastMonth = start.getUTCMonth();

	for (const line of text.split('\n')) {
		const match = line.match(/^\|\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Za-z]{3})\s*\|/);
		if (!match) continue;

		const month = MONTHS.indexOf(match[3].toLowerCase());
		if (month < 0) continue;
		// A week that crosses new year runs Dec then Jan; the year steps once.
		if (month < lastMonth - 6) year += 1;
		lastMonth = month;

		const [day, session, km, note] = cells(line);
		const weekday = day.slice(0, 3);
		const date = new Date(Date.UTC(year, month, Number(match[2])));
		if (DAYS[date.getUTCDay()] !== weekday) {
			problems.push(`week ${week.week}: ${day} is not a ${weekday} (${iso(date)})`);
		}

		dayRows.push({
			date: iso(date),
			week: week.week,
			session,
			km: km === '—' || km === '-' || km === '' ? null : Number(km),
			note
		});
	}
}

dayRows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// ------------------------------------------------------------- training log

const logText = read(join(MARATHON, 'Training Log.md'));
const runs = [];

{
	const start = logText.indexOf('## Runs');
	const end = logText.indexOf('## Weekly summary');
	const section = logText.slice(start, end > start ? end : undefined);

	for (const line of section.split('\n')) {
		if (!line.trim().startsWith('|')) continue;
		const row = cells(line);
		if (row.length < 7) continue;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0])) continue;

		runs.push({
			date: row[0],
			session: row[1],
			km: Number(row[2]) || 0,
			time: row[3],
			pace: row[4],
			rpe: row[5],
			note: row[6]
		});
	}
}

for (const run of runs) {
	const planWeek = plan.weeks.find((week) => run.date >= week.start && run.date <= week.end);
	if (!planWeek) problems.push(`run on ${run.date} falls outside the plan weeks`);
}

// ------------------------------------------------------------------- seasons

const DOMAINS = new Set(['running', 'music', 'language', 'study']);
const MAX_ANCHORS = 2;

const seasonsPlan = JSON.parse(read(join(vault, 'Seasons/plan.json')));

const seasons = seasonsPlan.seasons;
const languages = seasonsPlan.languages;
const languageById = new Map(languages.map((language) => [language.id, language]));

for (const season of seasons) {
	if (season.from >= season.to) problems.push(`season ${season.id}: ends before it starts`);
}

seasons.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
for (let i = 1; i < seasons.length; i += 1) {
	if (seasons[i].from < seasons[i - 1].to) problems.push(`seasons ${seasons[i - 1].id} and ${seasons[i].id} overlap`);
}

const DAY = 86_400_000;

/** A block is one thing for a number of weeks. The end date is derived, never stored. */
const blocks = (seasonsPlan.blocks ?? []).map((block) => {
	const from = utc(block.from);
	const weeks = Number(block.weeks);
	const days = weeks * 7;

	if (!DOMAINS.has(block.domain)) problems.push(`block ${block.id}: unknown domain ${block.domain}`);
	if (!Number.isInteger(weeks) || weeks < 1) problems.push(`block ${block.id}: weeks must be a whole number, got ${block.weeks}`);
	if (block.domain === 'language') {
		if (!languageById.has(block.language)) problems.push(`block ${block.id}: unknown language ${block.language}`);
	} else if (block.language) {
		problems.push(`block ${block.id}: only a language block names a language`);
	}

	const to = new Date(from.getTime() + Math.max(days - 1, 0) * DAY);

	return {
		id: block.id,
		domain: block.domain,
		language: block.language ?? '',
		title: block.title,
		detail: block.detail ?? '',
		dose: block.dose ?? '',
		target: block.target ?? '',
		from: iso(from),
		to: iso(to),
		weeks,
		days
	};
});

blocks.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

// Different domains run at the same time — that is the point. The same domain
// does not: one running block, one music block, one language block at a time.
for (let i = 0; i < blocks.length; i += 1) {
	for (let j = i + 1; j < blocks.length; j += 1) {
		const a = blocks[i];
		const b = blocks[j];
		if (b.from > a.to) continue;
		if (a.domain === b.domain) {
			problems.push(`blocks ${a.id} and ${b.id} are both ${a.domain} and overlap`);
		}
	}
}

const anchors = (seasonsPlan.anchors ?? []).map((anchor) => {
	if (!languageById.has(anchor.language)) problems.push(`anchor ${anchor.language}: unknown language`);
	if (anchor.from >= anchor.to) problems.push(`anchor ${anchor.language}: ends before it starts`);
	return {
		language: anchor.language,
		from: anchor.from,
		to: anchor.to,
		dose: anchor.dose ?? '',
		target: anchor.target ?? ''
	};
});

// Two anchors is the ceiling, and a language cannot be anchored while it is the
// active one.
const edges = [...new Set(anchors.flatMap((anchor) => [anchor.from, anchor.to]))].sort();
for (const day of edges) {
	const live = anchors.filter((anchor) => anchor.from <= day && day <= anchor.to);
	if (live.length > MAX_ANCHORS) problems.push(`anchors: ${live.length} on ${day}, the ceiling is ${MAX_ANCHORS}`);
	const active = blocks.find((block) => block.domain === 'language' && block.from <= day && day <= block.to);
	if (active && live.some((anchor) => anchor.language === active.language)) {
		problems.push(`${active.language} is anchored and active on ${day}`);
	}
}

// ------------------------------------------------------------------- write

const seasonsFile = `// Generated by scripts/sync-vault.mjs from Seasons/plan.json.
// Do not edit by hand — change the vault and run \`npm run sync\`.

export type Season = {
	id: string;
	name: string;
	from: string;
	to: string;
};

export type Language = {
	id: string;
	name: string;
	level: string;
	aim: string;
	stage: string;
};

export type Domain = 'running' | 'music' | 'language' | 'study';

export type Block = {
	id: string;
	domain: Domain;
	language: string;
	title: string;
	detail: string;
	dose: string;
	target: string;
	from: string;
	to: string;
	weeks: number;
	days: number;
};

export type Anchor = {
	language: string;
	from: string;
	to: string;
	dose: string;
	target: string;
};

export const updated = ${quote(seasonsPlan.updated)};
export const timezone = ${quote(seasonsPlan.timezone ?? 'Europe/Paris')};

export const seasons: Season[] = [
${seasons
	.map((season) => `\t{ id: ${quote(season.id)}, name: ${quote(season.name)}, from: ${quote(season.from)}, to: ${quote(season.to)} },`)
	.join('\n')}
];

export const languages: Language[] = [
${languages
	.map(
		(language) =>
			`\t{ id: ${quote(language.id)}, name: ${quote(language.name)}, level: ${quote(language.level)}, aim: ${quote(language.aim)}, stage: ${quote(language.stage)} },`
	)
	.join('\n')}
];

export const anchors: Anchor[] = [
${anchors
	.map(
		(anchor) =>
			`\t{ language: ${quote(anchor.language)}, from: ${quote(anchor.from)}, to: ${quote(anchor.to)}, dose: ${quote(anchor.dose)}, target: ${quote(anchor.target)} },`
	)
	.join('\n')}
];

export const blocks: Block[] = [
${blocks
	.map(
		(block) =>
			`\t{\n\t\tid: ${quote(block.id)},\n\t\tdomain: ${quote(block.domain)},\n\t\tlanguage: ${quote(block.language)},\n\t\ttitle: ${quote(block.title)},\n\t\tdetail: ${quote(block.detail)},\n\t\tdose: ${quote(block.dose)},\n\t\ttarget: ${quote(block.target)},\n\t\tfrom: ${quote(block.from)},\n\t\tto: ${quote(block.to)},\n\t\tweeks: ${block.weeks},\n\t\tdays: ${block.days}\n\t},`
	)
	.join('\n')}
];
`;

const daysFile = `// Generated by scripts/sync-vault.mjs from the Yggdrasil vault.
// Do not edit by hand — change the week notes and run \`npm run sync\`.

export type Day = {
	date: string;
	week: number;
	session: string;
	km: number | null;
	note: string;
};

export const days: Day[] = [
${dayRows
	.map(
		(day) =>
			`\t{ date: ${quote(day.date)}, week: ${day.week}, session: ${quote(day.session)}, km: ${day.km ?? 'null'}, note: ${quote(day.note)} },`
	)
	.join('\n')}
];
`;

const logFile = `// Generated by scripts/sync-vault.mjs from Marathon/Training Log.md.
// Do not edit by hand — change the vault and run \`npm run sync\`.

export type Run = {
	date: string;
	session: string;
	km: number;
	time: string;
	pace: string;
	rpe: string;
	note: string;
};

export const runs: Run[] = [
${runs
	.map(
		(run) =>
			`\t{ date: ${quote(run.date)}, session: ${quote(run.session)}, km: ${run.km}, time: ${quote(run.time)}, pace: ${quote(run.pace)}, rpe: ${quote(run.rpe)}, note: ${quote(run.note)} },`
	)
	.join('\n')}
];
`;

writeFileSync(join(root, 'src/lib/days.ts'), daysFile);
writeFileSync(join(root, 'src/lib/log.ts'), logFile);
writeFileSync(join(root, 'src/lib/seasons.ts'), seasonsFile);

const totalKm = runs.reduce((sum, run) => sum + run.km, 0);
const totalWeeks = blocks.reduce((sum, block) => sum + block.weeks, 0);
console.log(`days   ${dayRows.length} rows, weeks ${plan.weeks.length}`);
console.log(`runs   ${runs.length} rows, ${totalKm.toFixed(1)} km`);
console.log(`blocks ${blocks.length} (${totalWeeks} weeks), ${seasons.length} seasons, ${languages.length} languages, ${anchors.length} anchors`);
if (problems.length) {
	console.log('\ncheck:');
	for (const problem of problems) console.log(`  ${problem}`);
	process.exitCode = 1;
}
