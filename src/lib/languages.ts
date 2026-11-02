/**
 * Six languages, one row each. The ladder runs A1 to C2 and the row shows the
 * level held, then the level aimed at.
 *
 * Where the vault states a level it is used as is: French and Spanish are B1
 * (Wizard's Tower), with C1 the target there; Japanese is on its way back to
 * B2. Italian, Mandarin and Welsh have targets in the vault but no stated
 * level, so those three are marked assumed — correct them here and the page
 * follows.
 */

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type Level = (typeof CEFR)[number];

export type Language = {
	/** Two letters, as the vault orders them. */
	code: string;
	name: string;
	level: Level;
	target: Level;
	/** Stated in the vault, or a placeholder until it is. */
	stated: boolean;
};

export const languages: Language[] = [
	{ code: 'FR', name: 'french', level: 'B1', target: 'C1', stated: true },
	{ code: 'JP', name: 'japanese', level: 'B1', target: 'B2', stated: true },
	{ code: 'ES', name: 'spanish', level: 'B1', target: 'C1', stated: true },
	{ code: 'IT', name: 'italian', level: 'A2', target: 'B2', stated: false },
	{ code: 'CN', name: 'mandarin', level: 'A1', target: 'B2', stated: false },
	{ code: 'WE', name: 'welsh', level: 'A1', target: 'B1', stated: false }
];

export const index = (level: Level): number => CEFR.indexOf(level);
