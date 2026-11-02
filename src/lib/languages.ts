/**
 * Six languages, one branch each. The ladder runs A1 to C2 and the branch shows
 * the level held, then the level aimed at.
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
	/** Pigment for this branch: leaf fill, rule and bud. */
	colour: string;
};

export const languages: Language[] = [
	{ code: 'FR', name: 'french', level: 'B1', target: 'C1', stated: true, colour: '#8a6a2f' },
	{ code: 'JP', name: 'japanese', level: 'B1', target: 'B2', stated: true, colour: '#9c4f3d' },
	{ code: 'ES', name: 'spanish', level: 'B1', target: 'C1', stated: true, colour: '#b07c2a' },
	{ code: 'IT', name: 'italian', level: 'A2', target: 'B2', stated: false, colour: '#5a7250' },
	{ code: 'CN', name: 'mandarin', level: 'A1', target: 'B2', stated: false, colour: '#3f6b6a' },
	{ code: 'WE', name: 'welsh', level: 'A1', target: 'B1', stated: false, colour: '#7b5a72' }
];

export const index = (level: Level): number => CEFR.indexOf(level);
