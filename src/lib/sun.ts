/**
 * Sunrise, sunset and moon phase for a single day, from the NOAA solar
 * equations. The maths runs in UTC; the strings are printed in Paris time,
 * where both places sit. No network, no geolocation: the two places are fixed.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;
const J1970 = 2440587.5;
const SYNODIC = 29.530588853;
/** The sun's centre is this far below the horizon at apparent sunrise. */
const ZENITH = 90.833;

export type Place = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	/** The dithered landscape bound to this place, one strip per row. */
	strip: string;
};

/** Two homes: the sea, and the wood. */
export const places: Place[] = [
	{ id: 'marseille', name: 'marseille', lat: 43.2965, lon: 5.3698, strip: 'strips/marseille.webp' },
	{ id: 'wigginton', name: 'home', lat: 52.0116, lon: -1.433, strip: 'strips/home.webp' }
];

const julian = (date: Date): number => date.valueOf() / DAY_MS - 0.5 + J1970;

export type SunWindow = {
	rise: Date;
	set: Date;
	/** Minutes of daylight. */
	length: number;
};

type Solar = {
	declination: number;
	/** Minutes after midnight UTC of solar noon. */
	noon: number;
};

/** Declination and solar noon for the UTC day that holds `date`. */
function solar(date: Date, lon: number): Solar {
	const midnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const t = (julian(new Date(midnight)) - 2451545) / 36525;

	const l0 = (280.46646 + 36000.76983 * t + 0.0003032 * t * t) % 360;
	const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
	const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;

	const centre =
		(1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * RAD) +
		(0.019993 - 0.000101 * t) * Math.sin(2 * m * RAD) +
		0.000289 * Math.sin(3 * m * RAD);
	const trueLongitude = l0 + centre;
	const omega = 125.04 - 1934.136 * t;
	const lambda = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * RAD);

	const epsilon0 =
		23 + 26 / 60 + 21.448 / 3600 - (46.815 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600;
	const epsilon = epsilon0 + 0.00256 * Math.cos(omega * RAD);
	const declination = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD));

	const y = Math.tan((epsilon / 2) * RAD) ** 2;
	const eot =
		4 *
		DEG *
		(y * Math.sin(2 * l0 * RAD) -
			2 * e * Math.sin(m * RAD) +
			4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
			0.5 * y * y * Math.sin(4 * l0 * RAD) -
			1.25 * e * e * Math.sin(2 * m * RAD));

	// Minutes after midnight UTC: solar noon, then half a day either side of it.
	return { declination, noon: 720 - 4 * lon - eot };
}

/** `null` when the sun never crosses the horizon (not a French problem). */
export function sunWindow(date: Date, lat: number, lon: number): SunWindow | null {
	const midnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const { declination, noon } = solar(date, lon);
	const cosHour =
		Math.cos(ZENITH * RAD) / (Math.cos(lat * RAD) * Math.cos(declination)) -
		Math.tan(lat * RAD) * Math.tan(declination);
	if (cosHour > 1 || cosHour < -1) return null;

	const half = Math.acos(cosHour) * DEG * 4;
	const rise = new Date(midnight + (noon - half) * 60_000);
	const set = new Date(midnight + (noon + half) * 60_000);
	return { rise, set, length: Math.round((set.valueOf() - rise.valueOf()) / 60_000) };
}

const clock = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Paris',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** `Date` → `07:18`, in Paris time. */
export function hhmm(date: Date): string {
	return clock.format(date);
}

/** `615` → `10h 15` */
export function hours(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return `${h}h ${`${m}`.padStart(2, '0')}`;
}

export type Moon = {
	name: string;
	/** Lit fraction of the disc, 0–1. */
	lit: number;
	nextFull: Date;
	nextNew: Date;
	/** The full moon's old name, monthly except for harvest and hunter's. */
	fullName: string;
};

/** Meeus, Astronomical Algorithms 49: the instant of the k-th new moon.
    Half-integer k lands on the full moon. */
function syzygy(k: number): Date {
	const t = k / 1236.85;
	const t2 = t * t;
	const t3 = t2 * t;
	const t4 = t3 * t;
	const e = 1 - 0.002516 * t - 0.0000074 * t2;
	const m = (2.5534 + 29.1053567 * k - 0.0000014 * t2 - 0.00000011 * t3) * RAD;
	const mp =
		(201.5643 + 385.81693528 * k + 0.0107582 * t2 + 0.00001238 * t3 - 0.000000058 * t4) * RAD;
	const f =
		(160.7108 + 390.67050284 * k - 0.0016118 * t2 - 0.00000227 * t3 + 0.000000011 * t4) * RAD;
	const om = (124.7746 - 1.56375588 * k + 0.0020672 * t2 + 0.00000215 * t3) * RAD;

	let jde =
		2451550.09766 + 29.530588861 * k + 0.00015437 * t2 - 0.00000015 * t3 + 0.00000000073 * t4;

	const sin = Math.sin;
	if (Number.isInteger(k)) {
		jde +=
			-0.4072 * sin(mp) +
			0.17241 * e * sin(m) +
			0.01608 * sin(2 * mp) +
			0.01039 * sin(2 * f) +
			0.00739 * e * sin(mp - m) -
			0.00514 * e * sin(mp + m) +
			0.00208 * e * e * sin(2 * m) -
			0.00111 * sin(mp - 2 * f) -
			0.00057 * sin(mp + 2 * f) +
			0.00056 * e * sin(2 * mp + m) -
			0.00042 * sin(3 * mp) +
			0.00042 * e * sin(m + 2 * f) +
			0.00038 * e * sin(m - 2 * f) -
			0.00024 * e * sin(2 * mp - m) -
			0.00017 * sin(om) -
			0.00007 * sin(mp + 2 * m) +
			0.00004 * sin(2 * mp - 2 * f) +
			0.00004 * sin(3 * m) +
			0.00003 * sin(mp + m - 2 * f) +
			0.00003 * sin(2 * mp + 2 * f) -
			0.00003 * sin(mp + m + 2 * f) +
			0.00003 * sin(mp - m + 2 * f) -
			0.00002 * sin(mp - m - 2 * f) -
			0.00002 * sin(3 * mp + m) +
			0.00002 * sin(4 * mp);
	} else {
		jde +=
			-0.40614 * sin(mp) +
			0.17302 * e * sin(m) +
			0.01614 * sin(2 * mp) +
			0.01043 * sin(2 * f) +
			0.00734 * e * sin(mp - m) -
			0.00515 * e * sin(mp + m) +
			0.00209 * e * e * sin(2 * m) -
			0.00111 * sin(mp - 2 * f) -
			0.00057 * sin(mp + 2 * f) +
			0.00056 * e * sin(2 * mp + m) -
			0.00042 * sin(3 * mp) +
			0.00042 * e * sin(m + 2 * f) +
			0.00038 * e * sin(m - 2 * f) -
			0.00024 * e * sin(2 * mp - m) -
			0.00017 * sin(om) -
			0.00007 * sin(mp + 2 * m) +
			0.00004 * sin(2 * mp - 2 * f) +
			0.00004 * sin(3 * m) +
			0.00003 * sin(mp + m - 2 * f) +
			0.00003 * sin(2 * mp + 2 * f) -
			0.00003 * sin(mp + m + 2 * f) +
			0.00003 * sin(mp - m + 2 * f) -
			0.00002 * sin(mp - m - 2 * f) -
			0.00002 * sin(3 * mp + m);
	}

	return new Date((jde - J1970) * DAY_MS);
}

const meanPhase = (date: Date): number => (julian(date) - 2451550.09766) / SYNODIC;

/** The first new moon after `date`. */
export function nextNewMoon(date: Date): Date {
	const first = Math.floor(meanPhase(date)) - 1;
	for (let i = 0; i < 4; i += 1) {
		const moon = syzygy(first + i);
		if (moon.valueOf() > date.valueOf()) return moon;
	}
	return syzygy(first + 4);
}

/** The first full moon after `date`. */
export function nextFullMoon(date: Date): Date {
	const first = Math.floor(meanPhase(date) - 0.5) - 1;
	for (let i = 0; i < 4; i += 1) {
		const moon = syzygy(first + i + 0.5);
		if (moon.valueOf() > date.valueOf()) return moon;
	}
	return syzygy(first + 4.5);
}

/** Farm names, by month, as printed in the almanacs. */
const MOON_NAMES = [
	'wolf moon',
	'snow moon',
	'worm moon',
	'pink moon',
	'flower moon',
	'strawberry moon',
	'buck moon',
	'sturgeon moon',
	'corn moon',
	"hunter's moon",
	'beaver moon',
	'cold moon'
];

const parisPart = (date: Date, options: Intl.DateTimeFormatOptions): string =>
	new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', ...options }).format(date);

/** The nearest full moon to the autumn equinox is the harvest moon; the one
    after it is the hunter's. Everything else keeps its month's name. */
export function fullMoonName(date: Date): string {
	const year = Number(parisPart(date, { year: 'numeric' }));
	const equinox = new Date(Date.UTC(year, 8, 22, 12));

	const after = nextFullMoon(new Date(equinox.valueOf() - 1));
	const before = nextFullMoon(new Date(equinox.valueOf() - 32 * DAY_MS));
	const nearest =
		Math.abs(after.valueOf() - equinox.valueOf()) < Math.abs(before.valueOf() - equinox.valueOf())
			? after
			: before;

	const gap = date.valueOf() - nearest.valueOf();
	if (Math.abs(gap) < 2 * DAY_MS) return 'harvest moon';
	if (gap > 0 && gap < 40 * DAY_MS) return "hunter's moon";

	const month = Number(parisPart(date, { month: 'numeric' })) - 1;
	return MOON_NAMES[month];
}

/** `Date` → `26 oct 2026`, in Paris. */
export function stamp(date: Date): string {
	const day = Number(parisPart(date, { day: 'numeric' }));
	const month = parisPart(date, { month: 'short' }).toLowerCase();
	const year = parisPart(date, { year: 'numeric' });
	return `${day} ${month} ${year}`;
}

const PHASES = [
	'new',
	'waxing crescent',
	'first quarter',
	'waxing gibbous',
	'full',
	'waning gibbous',
	'last quarter',
	'waning crescent'
];

export function moon(date: Date): Moon {
	const jd = julian(date);
	const age = (((jd - 2451550.1) % SYNODIC) + SYNODIC) % SYNODIC;
	const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
	const nextFull = nextFullMoon(date);
	return {
		name: PHASES[Math.floor((age / SYNODIC) * 8) % 8],
		lit,
		nextFull,
		nextNew: nextNewMoon(date),
		fullName: fullMoonName(nextFull)
	};
}

export type Day = {
	place: Place;
	rise: string;
	set: string;
	length: string;
};

/** Everything the index strip needs, for both places and the moon. */
export function almanac(date: Date): { days: Day[]; moon: Moon } {
	return {
		days: places.map((place) => {
			const window = sunWindow(date, place.lat, place.lon);
			return {
				place,
				rise: window ? hhmm(window.rise) : '—',
				set: window ? hhmm(window.set) : '—',
				length: window ? hours(window.length) : '—'
			};
		}),
		moon: moon(date)
	};
}
