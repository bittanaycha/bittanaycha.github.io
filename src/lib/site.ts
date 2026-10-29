/**
 * Everything you are likely to want to change lives here.
 * No other file needs editing to give this page your own name.
 */
export const site = {
	/** Used in the browser tab and the header wordmark. */
	name: 'Tom',
	/** The big line at the top of the page. Keep it to one sentence. */
	tagline: 'I build small, local-first tools for reading, thinking and learning.',
	/** One supporting paragraph. Two sentences maximum reads best. */
	intro:
		'Mostly Obsidian plugins, a Pomodoro timer that refuses to nag, and an app that tries to teach rather than answer. Everything runs on your machine and keeps working offline.',
	/** Shown at https://<user>.github.io — also used for the "GitHub" link. */
	github: 'bittanaycha',
	/** Optional. Delete the line to hide the link. */
	email: 'tombinnie@protonmail.com',
	/** The <title> of the page. */
	title: 'Tom — small local-first tools',
	/** Used for <meta name="description">. */
	description:
		'Tom builds small, local-first tools for reading, thinking and learning — Obsidian plugins, a Pomodoro timer, and a desktop app that teaches.'
};

export type Site = typeof site;
