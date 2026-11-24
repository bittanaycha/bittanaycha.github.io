/**
 * The year in four calendars, all reduced to local dates in Europe/Paris.
 *
 * - astronomical: the instants the sun crosses 0, 90, 180 and 270 degrees.
 * - meteorological: the first of March, June, September and December.
 * - celtic: the fire festivals on 1 February, 1 May, 1 August and 1 November,
 *   plus the solstices and equinoxes, which the Irish and Welsh calendars kept.
 * - sekki: the 24 Japanese solar terms and the 72 kō beneath them.
 */

import { KO, SEKKI } from './sekki';

export type System = 'astronomical' | 'meteorological' | 'celtic' | 'sekki' | 'ko';

export type Mark = {
	/** Stable across years, so a block can remember which mark it was set to. */
	id: string;
	system: System;
	name: string;
	detail: string;
	/** Local date, `YYYY-MM-DD`. */
	date: string;
	/** The instant the sun reaches the mark, in ms. Absent for fixed dates. */
	at?: number;
	longitude?: number;
};

const DAY = 86_400_000;

const RAD = Math.PI / 180;

/** Days since 2000-01-01 12:00 TT, from a unix millisecond timestamp. */
function julianDay(ms: number) {
	return ms / DAY + 2440587.5;
}

/** Apparent solar longitude in degrees, 0 to 360. Meeus, ch. 25, low precision. */
export function sunLongitude(ms: number) {
	const T = (julianDay(ms) - 2451545) / 36525;
	const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
	const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
	const C =
		(1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * RAD) +
		(0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD) +
		0.000289 * Math.sin(3 * M * RAD);
	const omega = 125.04 - 1934.136 * T;
	const apparent = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
	return ((apparent % 360) + 360) % 360;
}

/** The instant the sun next reaches `longitude`, at or after `from`. */
export function instantAt(longitude: number, from: number) {
	const target = ((longitude % 360) + 360) % 360;
	const short = (value: number) => {
		const wrapped = ((value % 360) + 360) % 360;
		return wrapped > 180 ? wrapped - 360 : wrapped;
	};

	// Jump most of the way first, then Newton the last few days. The gap has to
	// be normalised into (0, 360): a raw `%` leaves it negative when the target
	// has already passed, and the jump then lands a year late.
	const delta = (((target - sunLongitude(from)) % 360) + 360) % 360;
	let guess = from + (delta / 360) * 365.2422 * DAY;

	for (let i = 0; i < 10; i += 1) {
		const gap = short(target - sunLongitude(guess));
		if (Math.abs(gap) < 1e-7) break;
		guess += (gap / 360) * 365.2422 * DAY;
	}

	return Math.round(guess);
}

const paris = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Paris',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

/** The local calendar date, `YYYY-MM-DD`, of an instant in Paris. */
export function localDate(ms: number) {
	return paris.format(new Date(ms));
}

export function localMidnight(date: string) {
	// Noon local is close enough to noon UTC in Paris for date arithmetic.
	return new Date(`${date}T12:00:00+01:00`).getTime();
}

const QUARTERS = [
	{ id: 'spring-equinox', name: 'spring equinox', longitude: 0, months: '20-21 mar' },
	{ id: 'summer-solstice', name: 'summer solstice', longitude: 90, months: '20-21 jun' },
	{ id: 'autumn-equinox', name: 'autumn equinox', longitude: 180, months: '22-23 sep' },
	{ id: 'winter-solstice', name: 'winter solstice', longitude: 270, months: '21-22 dec' }
];

const FIRES = [
	{ id: 'imbolc', name: 'imbolc', date: '02-01' },
	{ id: 'beltane', name: 'beltane', date: '05-01' },
	{ id: 'lunasa', name: 'lunasa', date: '08-01' },
	{ id: 'samhain', name: 'samhain', date: '11-01' }
];

const METEOROLOGICAL = [
	{ id: 'met-spring', name: 'spring', date: '03-01' },
	{ id: 'met-summer', name: 'summer', date: '06-01' },
	{ id: 'met-autumn', name: 'autumn', date: '09-01' },
	{ id: 'met-winter', name: 'winter', date: '12-01' }
];

/**
 * Every mark from 1 January of `year` to 1 January of `year + 1`, in date
 * order. Each system is generated for the same window so the picker can filter
 * by system without recomputing.
 */
/**
 * The instant in `year` at which the sun reaches `longitude`.
 *
 * `instantAt` only ever looks forward, so probing from 1 January would push the
 * terms whose longitude has already passed (the first degrees of January and
 * February) a whole year on, leaving those months empty. Probing from the middle
 * of the previous December and stepping forward until the date is inside the
 * year keeps one occurrence per term per year.
 */
function occurrenceIn(year: number, longitude: number) {
	const start = Date.UTC(year, 0, 1);
	const end = Date.UTC(year + 1, 0, 1);
	let at = instantAt(longitude, Date.UTC(year - 1, 11, 15));
	for (let step = 0; step < 3 && at < start; step += 1) at = instantAt(longitude, at + 40 * 86_400_000);
	return at < end ? at : null;
}

export function marksFor(year: number): Mark[] {
	const marks: Mark[] = [];
	const start = Date.UTC(year, 0, 1);
	const end = Date.UTC(year + 1, 0, 1);

	for (const quarter of QUARTERS) {
		for (let y = year - 1; y <= year + 1; y += 1) {
			const at = instantAt(quarter.longitude, Date.UTC(y, 0, 1));
			if (at < start || at >= end) continue;
			marks.push({
				id: `${quarter.id}-${localDate(at).slice(0, 4)}`,
				system: 'astronomical',
				name: quarter.name,
				detail: quarter.months,
				date: localDate(at),
				at,
				longitude: quarter.longitude
			});
		}
	}

	for (const fire of FIRES) {
		const date = `${year}-${fire.date}`;
		marks.push({
			id: `${fire.id}-${year}`,
			system: 'celtic',
			name: fire.name,
			detail: 'fire festival',
			date
		});
	}

	for (const fixed of METEOROLOGICAL) {
		marks.push({
			id: `${fixed.id}-${year}`,
			system: 'meteorological',
			name: fixed.name,
			detail: 'first of the month',
			date: `${year}-${fixed.date}`
		});
	}

	for (const term of SEKKI) {
		const at = occurrenceIn(year, term.longitude);
		if (at === null) continue;
		marks.push({
			id: `sekki-${term.romaji}-${localDate(at).slice(0, 4)}`,
			system: 'sekki',
			name: term.name,
			detail: `${term.kana} - ${term.en}`,
			date: localDate(at),
			at,
			longitude: term.longitude
		});
	}

	for (const ko of KO) {
		const at = occurrenceIn(year, ko.longitude);
		if (at === null) continue;
		marks.push({
			id: `ko-${ko.n}-${localDate(at).slice(0, 4)}`,
			system: 'ko',
			name: ko.name,
			detail: `${ko.kana} - ${ko.en}`,
			date: localDate(at),
			at,
			longitude: ko.longitude
		});
	}

	return marks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Marks between two instants of the year, for a picker showing one window. */
export function marksBetween(from: number, to: number, systems?: System[]): Mark[] {
	const first = marksFor(new Date(from).getUTCFullYear());
	const second = marksFor(new Date(from).getUTCFullYear() + 1);
	const marks = [...first, ...second]
		.filter((mark) => {
			const at = mark.at ?? localMidnight(mark.date);
			return at >= from && at <= to;
		})
		.filter((mark) => !systems || systems.includes(mark.system));

	const seen = new Set<string>();
	return marks.filter((mark) => (seen.has(mark.id) ? false : (seen.add(mark.id), true)));
}

/**
 * The year the ring shows: the next winter solstice through the one after it,
 * so the wheel always starts at 9 o'clock and always covers a full turn.
 */
export function yearWindow(today: string) {
	const at = new Date(`${today}T12:00:00Z`).getTime();
	const opening = instantAt(270, at);
	const closing = instantAt(270, opening + 10 * DAY);
	return { opening: localDate(opening), from: localDate(opening), to: localDate(closing - DAY) };
}

/** The season a date falls in, given the astronomical quarters. */
export function seasonOf(date: string) {
	const year = Number(date.slice(0, 4));
	const marks = marksFor(year).filter((mark) => mark.system === 'astronomical');
	const after = marks.filter((mark) => mark.date <= date);
	if (after.length === 0) return marks[marks.length - 1].name;
	return after[after.length - 1].name;
}
