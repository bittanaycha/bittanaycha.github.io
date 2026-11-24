#!/usr/bin/env node
/**
 * Move the plan between the vault and the database.
 *
 *   npm run pull   the database is the truth; rewrite Seasons/plan.json
 *   npm run push   the vault is the truth; send Seasons/plan.json up
 *
 * Both sides carry a modified stamp, and the vault keeps a receipt of the last
 * pull (the file's hash and the stamp the server had). If the file changed and
 * the server changed since that receipt, the two edits cannot be merged, so the
 * command refuses instead of picking a winner.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Node does not read `.env` on its own, and the file only holds two keys.
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) {
	for (const line of readFileSync(envFile, 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
		if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
	}
}

const vault = process.env.YGDRASIL_VAULT ?? join(homedir(), 'Vaults/Yggdrasil');
const planPath = join(vault, 'Seasons/plan.json');
const receiptPath = join(vault, 'Seasons/.plan-sync.json');

const url = (process.env.PLAN_URL ?? '').replace(/\/$/, '');
const key = process.env.PLAN_PASSPHRASE ?? '';

const mode = process.argv[2];
if (mode !== 'pull' && mode !== 'push') {
	console.error('usage: node scripts/plan-sync.mjs pull|push');
	process.exit(1);
}

if (!url) {
	console.error('PLAN_URL is not set. Copy .env.example to .env and point it at the site.');
	process.exit(1);
}
if (mode === 'push' && !key) {
	console.error('PLAN_PASSPHRASE is not set. Copy .env.example to .env.');
	process.exit(1);
}

const hash = (text) => createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, '\t')}\n`);

const receipt = existsSync(receiptPath) ? readJson(receiptPath) : null;
const fileText = existsSync(planPath) ? readFileSync(planPath, 'utf8') : null;

async function server() {
	const response = await fetch(`${url}/api/plan`, { headers: { accept: 'application/json' } });
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`${response.status} from ${url}/api/plan: ${body.slice(0, 200)}`);
	}
	return response.json();
}

if (mode === 'pull') {
	const plan = await server();
	const text = `${JSON.stringify(plan, null, '\t')}\n`;
	writeFileSync(planPath, text);
	writeJson(receiptPath, { pulled_at: new Date().toISOString(), server_updated: plan.updated, hash: hash(text) });
	console.log(`pulled ${plan.blocks.length} blocks, ${plan.languages.length} languages, ${plan.anchors.length} anchors`);
	console.log(`wrote  ${planPath}`);
	process.exit(0);
}

// push
if (!fileText) {
	console.error(`no plan at ${planPath}`);
	process.exit(1);
}
const local = JSON.parse(fileText);
const localHash = hash(fileText);
const remote = await server();

const fileChanged = !receipt || receipt.hash !== localHash;
const serverChanged = !receipt || receipt.server_updated !== remote.updated;

if (fileChanged && serverChanged) {
	console.error('both sides changed since the last pull, so this would choose a winner silently.');
	console.error(`  vault:  ${receipt ? `changed since ${receipt.pulled_at}` : 'no receipt, unknown history'}`);
	console.error(`  server: updated ${remote.updated}, receipt had ${receipt?.server_updated ?? 'nothing'}`);
	console.error('pull, redo the edit, then push.');
	process.exit(1);
}

if (!fileChanged) {
	console.log('the vault has not changed since the last pull, nothing to push.');
	process.exit(0);
}

const response = await fetch(`${url}/api/plan`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', 'x-plan-key': key },
	body: JSON.stringify(local)
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
	console.error(`${response.status}: ${body.problems ? body.problems.join('\n  ') : (body.message ?? 'the plan did not save')}`);
	process.exit(1);
}

writeFileSync(planPath, fileText);
writeJson(receiptPath, {
	pulled_at: new Date().toISOString(),
	server_updated: body.written.updated,
	hash: localHash
});
console.log(`pushed ${local.blocks.length} blocks, ${local.languages.length} languages, ${local.anchors.length} anchors`);
