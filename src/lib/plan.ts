/**
 * The marathon plan, mirrored from the Yggdrasil vault (Marathon/plan.json).
 * Numbers only, plus the plan's own labels — edit the vault, then copy across.
 */

export type Phase = 'base' | 'build' | 'extend' | 'specific' | 'taper' | 'race';

export type Week = {
	week: number;
	phase: Phase;
	focus: string;
	start: string;
	end: string;
	km: number;
	long: number;
	runs: number;
};

export type Gate = {
	gate: 'A' | 'B' | 'C' | 'D';
	week: number;
	date: string;
	distance: string;
	place: string;
};

export const race = {
	name: 'Cluj-Napoca Marathon',
	date: '2027-04-11',
	time: '08:30',
	place: 'Cluj-Napoca',
	distance: 42.195,
} as const;

export const phases: { id: Phase; label: string; from: number; to: number }[] = [
	{ id: 'base', label: 'base', from: 1, to: 8 },
	{ id: 'build', label: 'build', from: 9, to: 14 },
	{ id: 'extend', label: 'extend', from: 15, to: 19 },
	{ id: 'specific', label: 'specific', from: 20, to: 24 },
	{ id: 'taper', label: 'taper', from: 25, to: 25 },
	{ id: 'race', label: 'race', from: 26, to: 26 },
];

export const weeks: Week[] = [
	{
		week: 1,
		phase: 'base',
		focus: "Start where you are",
		start: '2026-10-12',
		end: '2026-10-18',
		km: 7.0,
		long: 4.5,
		runs: 2,
	},
	{
		week: 2,
		phase: 'base',
		focus: "Five short easy runs",
		start: '2026-10-19',
		end: '2026-10-25',
		km: 23.9,
		long: 5,
		runs: 5,
	},
	{
		week: 3,
		phase: 'base',
		focus: "Habit, not heroics",
		start: '2026-10-26',
		end: '2026-11-01',
		km: 28.0,
		long: 7,
		runs: 5,
	},
	{
		week: 4,
		phase: 'base',
		focus: "A little more",
		start: '2026-11-02',
		end: '2026-11-08',
		km: 33.0,
		long: 8,
		runs: 5,
	},
	{
		week: 5,
		phase: 'base',
		focus: "Down week",
		start: '2026-11-09',
		end: '2026-11-15',
		km: 27.0,
		long: 6,
		runs: 4,
	},
	{
		week: 6,
		phase: 'base',
		focus: "Six days",
		start: '2026-11-16',
		end: '2026-11-22',
		km: 37.0,
		long: 10,
		runs: 6,
	},
	{
		week: 7,
		phase: 'base',
		focus: "5 km race",
		start: '2026-11-23',
		end: '2026-11-29',
		km: 25.0,
		long: 9,
		runs: 4,
	},
	{
		week: 8,
		phase: 'base',
		focus: "After the race",
		start: '2026-11-30',
		end: '2026-12-06',
		km: 30,
		long: 10,
		runs: 5,
	},
	{
		week: 9,
		phase: 'build',
		focus: "First sessions",
		start: '2026-12-07',
		end: '2026-12-13',
		km: 41,
		long: 11,
		runs: 6,
	},
	{
		week: 10,
		phase: 'build',
		focus: "Longer reps",
		start: '2026-12-14',
		end: '2026-12-20',
		km: 45,
		long: 12,
		runs: 6,
	},
	{
		week: 11,
		phase: 'build',
		focus: "Settling in",
		start: '2026-12-21',
		end: '2026-12-27',
		km: 49,
		long: 13,
		runs: 6,
	},
	{
		week: 12,
		phase: 'build',
		focus: "Eight minutes",
		start: '2026-12-28',
		end: '2027-01-03',
		km: 53,
		long: 15,
		runs: 6,
	},
	{
		week: 13,
		phase: 'build',
		focus: "Down week",
		start: '2027-01-04',
		end: '2027-01-10',
		km: 44,
		long: 12,
		runs: 5,
	},
	{
		week: 14,
		phase: 'build',
		focus: "10 km test",
		start: '2027-01-11',
		end: '2027-01-17',
		km: 45,
		long: 14,
		runs: 6,
	},
	{
		week: 15,
		phase: 'extend',
		focus: "Three sessions a week",
		start: '2027-01-18',
		end: '2027-01-24',
		km: 57.0,
		long: 13,
		runs: 6,
	},
	{
		week: 16,
		phase: 'extend',
		focus: "Down week",
		start: '2027-01-25',
		end: '2027-01-31',
		km: 51.0,
		long: 14,
		runs: 5,
	},
	{
		week: 17,
		phase: 'extend',
		focus: "Ten-minute reps",
		start: '2027-02-01',
		end: '2027-02-07',
		km: 65.0,
		long: 18,
		runs: 6,
	},
	{
		week: 18,
		phase: 'extend',
		focus: "Long run with pace",
		start: '2027-02-08',
		end: '2027-02-14',
		km: 68.0,
		long: 20,
		runs: 6,
	},
	{
		week: 19,
		phase: 'extend',
		focus: "Half marathon test",
		start: '2027-02-15',
		end: '2027-02-21',
		km: 52.1,
		long: 21.1,
		runs: 6,
	},
	{
		week: 20,
		phase: 'specific',
		focus: "Marathon pace enters",
		start: '2027-02-22',
		end: '2027-02-28',
		km: 73.0,
		long: 26,
		runs: 6,
	},
	{
		week: 21,
		phase: 'specific',
		focus: "Biggest week",
		start: '2027-03-01',
		end: '2027-03-07',
		km: 77.0,
		long: 28,
		runs: 6,
	},
	{
		week: 22,
		phase: 'specific',
		focus: "Down week",
		start: '2027-03-08',
		end: '2027-03-14',
		km: 55.0,
		long: 18,
		runs: 5,
	},
	{
		week: 23,
		phase: 'specific',
		focus: "Dress rehearsal",
		start: '2027-03-15',
		end: '2027-03-21',
		km: 71.0,
		long: 24,
		runs: 6,
	},
	{
		week: 24,
		phase: 'specific',
		focus: "Last long run",
		start: '2027-03-22',
		end: '2027-03-28',
		km: 59.0,
		long: 18,
		runs: 6,
	},
	{
		week: 25,
		phase: 'taper',
		focus: "Taper",
		start: '2027-03-29',
		end: '2027-04-04',
		km: 41.0,
		long: 12,
		runs: 5,
	},
	{
		week: 26,
		phase: 'race',
		focus: "Race week",
		start: '2027-04-05',
		end: '2027-04-11',
		km: 61.2,
		long: 0,
		runs: 5,
	},
];

export const gates: Gate[] = [
	{
		gate: 'A',
		week: 7,
		date: '2026-11-29',
		distance: "5 km",
		place: "Martigues",
	},
	{
		gate: 'B',
		week: 14,
		date: '2027-01-17',
		distance: "10 km",
		place: "Time trial",
	},
	{
		gate: 'C',
		week: 19,
		date: '2027-02-21',
		distance: "Half marathon",
		place: "Cannes",
	},
	{ gate: 'D', week: 23, date: '2027-03-21', distance: '24 km', place: '14 km at MP' },
];

export const totals = {
	training: 1218.2,
	distance: 1260.4,
	peak: 77.0,
	peakWeek: 21,
	weekCount: 26,
} as const;

export const startDate = '2026-10-12';
