import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The plan lives here, not in the JSON file. `Seasons/plan.json` in the vault is
 * a mirror written by `npm run pull`; the sync refuses to overwrite a mirror
 * that has changed since the last one.
 *
 * Languages are a fixed set of six with three slots between them. Everything
 * else is a block: a kind, a name and two dates.
 */

export const languages = sqliteTable('languages', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	level: text('level').notNull().default(''),
	aim: text('aim').notNull().default(''),
	stage: text('stage').notNull().default(''),
	position: integer('position').notNull().default(0)
});

/** Which language holds which slot, for a stretch of the year. */
export const assignments = sqliteTable('assignments', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	language: text('language').notNull(),
	slot: text('slot').notNull(),
	from: text('from').notNull(),
	to: text('to').notNull(),
	dose: text('dose').notNull().default(''),
	target: text('target').notNull().default('')
});

export const blocks = sqliteTable('blocks', {
	id: text('id').primaryKey(),
	kind: text('kind').notNull(),
	title: text('title').notNull(),
	detail: text('detail').notNull().default(''),
	dose: text('dose').notNull().default(''),
	target: text('target').notNull().default(''),
	from: text('from').notNull(),
	to: text('to').notNull()
});

/** One row. `updated` is bumped on every write so the two mirrors can compare. */
export const meta = sqliteTable('meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});
