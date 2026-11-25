/**
 * The seasons pages carry two papers: dark kraft and light kraft. The choice
 * belongs to the browser, not the plan, so it lives in localStorage and on the
 * root element. app.html reads it before paint; this module is for the toggle.
 */
export type SeasonsTheme = 'dark' | 'light';

const KEY = 'seasons-theme';

export function readSeasonsTheme(): SeasonsTheme {
	if (typeof document === 'undefined') return 'dark';
	return document.documentElement.dataset.seasonsTheme === 'light' ? 'light' : 'dark';
}

export function toggleSeasonsTheme(): SeasonsTheme {
	const next: SeasonsTheme = readSeasonsTheme() === 'dark' ? 'light' : 'dark';
	if (typeof document !== 'undefined') {
		document.documentElement.dataset.seasonsTheme = next;
	}
	try {
		localStorage.setItem(KEY, next);
	} catch {
		// A blocked storage only loses the memory between visits, not the switch.
	}
	return next;
}
