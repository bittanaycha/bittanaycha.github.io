/**
 * Daniels–Gilbert VDOT from a race result, and the paces that follow from it.
 * Ported from FCRC's PaceCalculator.swift, which in turn came from the club's
 * Obsidian plugin: the arithmetic there is unchanged, so a number here matches
 * a number quoted on the plan.
 */

export type Distance = {
	id: string;
	label: string;
	meters: number;
	defaultTime: string;
};

export const distances: Distance[] = [
	{ id: '5k', label: '5 km', meters: 5000, defaultTime: '19:00' },
	{ id: '10k', label: '10 km', meters: 10000, defaultTime: '39:30' },
	{ id: 'half', label: 'half', meters: 21097.5, defaultTime: '1:27:30' },
	{ id: 'marathon', label: 'marathon', meters: 42195, defaultTime: '3:02:00' }
];

export type Band = {
	id: string;
	label: string;
	low: number;
	high: number;
	/** Longest rep this band covers, in seconds. */
	upTo: number;
};

export const bands: Band[] = [
	{ id: 'short', label: '45 s – 1 min', low: -0.01, high: 0.01, upTo: 60 },
	{ id: 'medium', label: '1 – 3 min', low: 0.01, high: 0.03, upTo: 180 },
	{ id: 'long', label: '3 – 5 min', low: 0.03, high: 0.06, upTo: 300 },
	{ id: 'longest', label: '5 – 12 min', low: 0.06, high: 0.09, upTo: 720 }
];

/** `19:00`, `1:27:30`, or the same with a comma. Seconds, or null. */
export function parseClock(raw: string): number | null {
	const normalized = raw.trim().replace(',', '.');
	if (!normalized) return null;

	let total = 0;
	for (const part of normalized.split(':')) {
		const value = Number(part);
		if (!Number.isFinite(value) || part.trim() === '') return null;
		total = total * 60 + value;
	}
	return total > 0 ? total : null;
}

/** `243.9` → `4:04`, carrying rounded seconds into the minute. */
export function paceLabel(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '—';
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds - minutes * 60);
	return rest === 60 ? `${minutes + 1}:00` : `${minutes}:${`${rest}`.padStart(2, '0')}`;
}

const A = 0.000104;
const B = 0.182258;

export function vdot(meters: number, seconds: number): number {
	const minutes = seconds / 60;
	const velocity = meters / minutes;
	const oxygen = -4.6 + B * velocity + A * velocity * velocity;
	const fraction = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
	return oxygen / fraction;
}

/** Seconds per kilometre at 88% of the estimated VO₂ max. */
export function threshold(vdotValue: number): number {
	const c = -(4.6 + 0.88 * vdotValue);
	const velocity = (-B + Math.sqrt(B * B - 4 * A * c)) / (2 * A);
	return 60000 / velocity;
}

export type Solution = {
	vdot: number;
	/** Seconds per kilometre. */
	threshold: number;
	mile: number;
	kmh: number;
	band: Band;
	rep: number;
	/** Rep length in metres at the slowest and fastest pace. */
	shortest: number;
	longest: number;
	/** Seconds per kilometre, fastest and slowest ends of the band. */
	fast: number;
	slow: number;
};

export function solve(meters: number, seconds: number, repSeconds: number): Solution | null {
	if (!(meters > 0) || !(seconds > 0)) return null;

	const value = vdot(meters, seconds);
	const pace = threshold(value);
	const band = bands.find((candidate) => repSeconds <= candidate.upTo) ?? bands[bands.length - 1];
	const fast = pace * (1 + band.low);
	const slow = pace * (1 + band.high);

	return {
		vdot: value,
		threshold: pace,
		mile: pace * 1.609344,
		kmh: 3600 / pace,
		band,
		rep: repSeconds,
		shortest: Math.round((1000 * repSeconds) / slow / 10) * 10,
		longest: Math.round((1000 * repSeconds) / fast / 10) * 10,
		fast,
		slow
	};
}
