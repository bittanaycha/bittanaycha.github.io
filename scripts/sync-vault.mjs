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

const ROLES = new Set(['active', 'secondary', 'anchor', 'dormant']);

const seasonsPlan = JSON.parse(read(join(vault, 'Seasons/plan.json')));

const wheel = seasonsPlan.wheel;
const languages = seasonsPlan.languages;
const seasons = seasonsPlan.seasons;

const spokeIds = new Set(wheel.map((spoke) => spoke.id));
const languageIds = new Set(languages.map((language) => language.id));

for (const season of seasons) {
	if (!spokeIds.has(season.opens)) problems.push(`season ${season.id}: unknown opening spoke ${season.opens}`);
	if (!spokeIds.has(season.closes)) problems.push(`season ${season.id}: unknown closing spoke ${season.closes}`);
	if (season.from >= season.to) problems.push(`season ${season.id}: ends before it starts`);
	if (season.gate && (season.gate.date <= season.from || season.gate.date >= season.to)) {
		problems.push(`season ${season.id}: gate ${season.gate.date} falls outside the season`);
	}

	for (const [id, entry] of Object.entries(season.roles)) {
		if (!languageIds.has(id)) problems.push(`season ${season.id}: unknown language ${id}`);
		if (!ROLES.has(entry.role)) problems.push(`season ${season.id}/${id}: unknown role ${entry.role}`);
	}
	for (const id of languageIds) {
		if (!season.roles[id]) problems.push(`season ${season.id}: no role for ${id}`);
	}
	const active = languages.filter((language) => season.roles[language.id]?.role === 'active');
	if (active.length > 1) problems.push(`season ${season.id}: ${active.length} active languages`);
	const anchors = languages.filter((language) => season.roles[language.id]?.role === 'anchor');
	if (anchors.length > 2) problems.push(`season ${season.id}: ${anchors.length} anchors`);
}

seasons.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
for (let i = 1; i < seasons.length; i += 1) {
	if (seasons[i].from < seasons[i - 1].to) problems.push(`seasons ${seasons[i - 1].id} and ${seasons[i].id} overlap`);
}

// ------------------------------------------------------------------- write

const seasonsFile = `// Generated by scripts/sync-vault.mjs from Seasons/plan.json.
// Do not edit by hand — change the vault and run \`npm run sync\`.

export type Spoke = {
	id: string;
	name: string;
	short: string;
	kind: 'quarter' | 'cross';
	label: string;
	date: string;
	time?: string;
};

export type Language = {
	id: string;
	name: string;
	mark: string;
	level: string;
	aim: string;
	stage: string;
};

export type Role = 'active' | 'secondary' | 'anchor' | 'dormant';

export type SeasonRole = {
	role: Role;
	dose: string;
	target: string;
};

export type Season = {
	id: string;
	kind: string;
	opens: string;
	closes: string;
	from: string;
	to: string;
	gate: { spoke: string; date: string } | null;
	primary: string;
	roles: Record<string, SeasonRole>;
};

export const updated = ${quote(seasonsPlan.updated)};
export const timezone = ${quote(seasonsPlan.timezone ?? 'Europe/Paris')};

export const wheel: Spoke[] = [
${wheel
	.map(
		(spoke) =>
			`\t{ id: ${quote(spoke.id)}, name: ${quote(spoke.name)}, short: ${quote(spoke.short)}, kind: ${quote(spoke.kind)}, label: ${quote(spoke.label)}, date: ${quote(spoke.date)}${spoke.time ? `, time: ${quote(spoke.time)}` : ''} },`
	)
	.join('\n')}
];

export const languages: Language[] = [
${languages
	.map(
		(language) =>
			`\t{ id: ${quote(language.id)}, name: ${quote(language.name)}, mark: ${quote(language.mark)}, level: ${quote(language.level)}, aim: ${quote(language.aim)}, stage: ${quote(language.stage)} },`
	)
	.join('\n')}
];

export const seasons: Season[] = [
${seasons
	.map(
		(season) =>
			`\t{\n\t\tid: ${quote(season.id)},\n\t\tkind: ${quote(season.kind)},\n\t\topens: ${quote(season.opens)},\n\t\tcloses: ${quote(season.closes)},\n\t\tfrom: ${quote(season.from)},\n\t\tto: ${quote(season.to)},\n\t\tgate: ${season.gate ? `{ spoke: ${quote(season.gate.spoke)}, date: ${quote(season.gate.date)} }` : 'null'},\n\t\tprimary: ${quote(season.primary)},\n\t\troles: {\n${Object.entries(season.roles)
				.map(
					([id, entry]) =>
						`\t\t\t${id}: { role: ${quote(entry.role)}, dose: ${quote(entry.dose)}, target: ${quote(entry.target)} },`
				)
				.join('\n')}\n\t\t}\n\t},`
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
const active = languages.filter((language) => seasons.some((season) => season.roles[language.id].role === 'active'));
console.log(`days  ${dayRows.length} rows, weeks ${plan.weeks.length}`);
console.log(`runs  ${runs.length} rows, ${totalKm.toFixed(1)} km`);
console.log(
	`wheel ${wheel.length} spokes, ${seasons.length} seasons, ${languages.length} languages (${active.map((language) => language.name).join(', ')} active somewhere)`
);
if (problems.length) {
	console.log('\ncheck:');
	for (const problem of problems) console.log(`  ${problem}`);
	process.exitCode = 1;
}
