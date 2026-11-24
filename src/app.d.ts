declare global {
	namespace App {
		interface Locals {
			editor: boolean;
		}
		interface Platform {
			env: {
				DB: D1Database;
				PLAN_PASSPHRASE?: string;
				PLAN_SECRET?: string;
			};
			ctx: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
