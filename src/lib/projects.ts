/**
 * The project cards. Add, remove or reorder freely — the grid reflows on its own.
 * `href` may be an absolute URL or a path inside this site (e.g. '/projects/foo').
 */
export type Project = {
	title: string;
	description: string;
	href: string;
	/** Short label in the corner of the card. */
	tag?: string;
	/** Optional second link, e.g. a write-up. */
	more?: { label: string; href: string };
};

export const projects: Project[] = [
	{
		title: 'Mimir',
		description:
			'A desktop application that teaches. Download one thing, connect a model, learn — instead of asking a chatbot and forgetting.',
		href: 'https://github.com/bittanaycha/mimir2',
		tag: 'app'
	},
	{
		title: 'Tomodoro',
		description:
			'A macOS Pomodoro timer and tortoise companion. Times the work, then gets out of the way.',
		href: 'https://github.com/bittanaycha/Tomodoro',
		tag: 'macOS'
	},
	{
		title: 'Mimir theme',
		description:
			'Warm paper, sage and serif: a reading theme for an Obsidian learning vault. No remote assets, works offline.',
		href: 'https://github.com/bittanaycha/obsidian-mimir-theme',
		tag: 'Obsidian'
	},
	{
		title: 'Lesson publisher',
		description:
			'Publish a finished note and every file it embeds into a second vault, mirroring the folder structure.',
		href: 'https://github.com/bittanaycha/obsidian-lesson-publisher',
		tag: 'Obsidian'
	},
	{
		title: 'Mimir controls',
		description:
			'Step the reading size and switch light or dark from the note header, without opening settings.',
		href: 'https://github.com/bittanaycha/obsidian-mimir-controls',
		tag: 'Obsidian'
	},
	{
		title: 'pine-3000',
		description: 'A small experiment that got out of hand.',
		href: 'https://github.com/bittanaycha/pine-3000',
		tag: 'experiment'
	}
];
