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

/** `null` when the sun never crosses the horizon (not a French problem). */
export function sunWindow(date: Date, lat: number, lon: number): SunWindow | null {
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
	const noon = 720 - 4 * lon - eot;
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
};

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
	return { name: PHASES[Math.floor((age / SYNODIC) * 8) % 8], lit };
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
