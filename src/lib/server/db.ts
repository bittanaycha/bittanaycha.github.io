import { drizzle } from 'drizzle-orm/d1';

/** The D1 binding, as the adapter hands it over in `event.platform`. */
export type Binding = Parameters<typeof drizzle>[0];

export function database(db: Binding) {
	return drizzle(db);
}
