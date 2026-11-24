<script lang="ts">
	import Ring from '#lib/components/Ring.svelte';
	import { marksBetween } from '#lib/calendar';
	import { numDate } from '#lib/format';
	import {
		SLOTS,
		addDays,
		days as countDays,
		problems as planProblems,
		weeks as countWeeks,
		type Assignment,
		type Block,
		type Language
	} from '#lib/plan-rules';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	// The editor works on local copies; `data` is the server's snapshot and is
	// only read once, then replaced by what the form holds.
	// svelte-ignore state_referenced_locally
	const today = data.today;

	// svelte-ignore state_referenced_locally
	let blocks = $state<Block[]>(data.plan.blocks.map((block) => ({ ...block })));
	// svelte-ignore state_referenced_locally
	let assignments = $state<Assignment[]>(data.plan.assignments.map((item) => ({ ...item })));
	// svelte-ignore state_referenced_locally
	let languages = $state<Language[]>(data.plan.languages.map((language) => ({ ...language })));

	let passphrase = $state('');
	let unlocking = $state(false);
	let unlockError = $state('');

	let problems = $state<string[]>([]);
	let message = $state('');
	let saving = $state(false);

	const systems = ['all', 'astronomical', 'meteorological', 'celtic', 'sekki', 'ko'] as const;
	let system = $state<(typeof systems)[number]>('all');

	/** The year opens at the winter solstice and stretches to hold the plan. */
	// svelte-ignore state_referenced_locally
	const windowFrom = data.window.from;

	// The ring is the same rolling year as the reading page: half a year either
	// side of today, no stretching to reach a date the ring cannot show.
	const windowTo = $derived(data.window.to);

	const clashes = $derived.by(() =>
		planProblems({
			updated: data.plan.updated,
			timezone: data.plan.timezone,
			languages,
			assignments,
			blocks
		})
	);

	const seasons = $derived.by(() => {
		const marks = marksBetween(
			new Date(`${windowFrom}T12:00:00Z`).getTime(),
			new Date(`${windowTo}T12:00:00Z`).getTime(),
			['astronomical']
		);
		return marks.map((mark, index) => ({
			name: mark.name,
			from: mark.date,
			to: marks[index + 1]?.date ?? addDays(mark.date, 91)
		}));
	});

	/** Which endpoint the ring and the mark list are writing to. */
	let selected = $state<{ kind: 'block' | 'assignment'; index: number; end: 'from' | 'to' }>({
		kind: 'block',
		index: 0,
		end: 'from'
	});

	const ringBlocks = $derived([
		...blocks
			.filter((block) => block.from && block.to && block.from <= block.to)
			.map((block) => ({ ...block, kind: block.kind })),
		...assignments
			.filter((item) => item.slot !== 'tertiary' && item.from && item.to && item.from <= item.to)
			.map((item) => ({
				id: `${item.language}-${item.from}`,
				kind: 'language',
				title: languages.find((language) => language.id === item.language)?.name ?? item.language,
				from: item.from,
				to: item.to
			}))
	]);

	const focus = $derived.by(() => {
		const row = selected.kind === 'block' ? blocks[selected.index] : assignments[selected.index];
		return row?.[selected.end] ?? today;
	});

	const nearby = $derived.by(() => {
		const middle = new Date(`${focus}T12:00:00Z`).getTime();
		const found = marksBetween(middle - 70 * 86_400_000, middle + 70 * 86_400_000, undefined)
			.filter((mark) => system === 'all' || mark.system === system)
			.map((mark) => ({ ...mark, gap: Math.abs(new Date(`${mark.date}T12:00:00Z`).getTime() - middle) }));
		const coarse = found.filter((mark) => mark.system !== 'ko');
		const ko = found
			.filter((mark) => mark.system === 'ko')
			.sort((a, b) => a.gap - b.gap)
			.slice(0, 4);
		return [...coarse, ...ko].sort((a, b) => (a.date < b.date ? -1 : 1));
	});

	/** The editor's wheel carries the same marks as the public one. */
	const ringMarks = $derived(
		marksBetween(
			new Date(`${windowFrom}T12:00:00Z`).getTime(),
			new Date(`${windowTo}T12:00:00Z`).getTime(),
			undefined
		)
	);

	function setDate(date: string) {
		if (selected.kind === 'block') {
			const block = blocks[selected.index];
			if (!block) return;
			block[selected.end] = date;
			if (selected.end === 'from' && block.to < date) block.to = addDays(date, 6);
			blocks = [...blocks];
		} else {
			const item = assignments[selected.index];
			if (!item) return;
			item[selected.end] = date;
			assignments = [...assignments];
		}
		message = '';
	}

	/** The mark of any system closest to a date, so a quick length lands on one. */
	function snap(date: string) {
		const middle = new Date(`${date}T12:00:00Z`).getTime();
		const found = marksBetween(
			middle - 40 * 86_400_000,
			middle + 40 * 86_400_000,
			['astronomical', 'meteorological', 'celtic', 'sekki']
		).map((mark) => ({
			date: mark.date,
			gap: Math.abs(new Date(`${mark.date}T12:00:00Z`).getTime() - middle)
		}));
		return found.sort((a, b) => a.gap - b.gap)[0]?.date ?? date;
	}

	/**
	 * Start the block today, in a month, in three or in six. Today is exact; the
	 * longer ones land on the nearest checkpoint. The length is kept, so the end
	 * follows the start.
	 */
	function quick(days: number) {
		if (selected.kind !== 'block') return;
		const block = blocks[selected.index];
		if (!block) return;
		const span = countDays(block.from, block.to);
		const start = days === 0 ? today : snap(addDays(today, days));
		block.from = start;
		block.to = addDays(start, span);
		blocks = [...blocks];
		selected = { kind: 'block', index: selected.index, end: 'from' };
		message = '';
	}

	function choose(kind: 'block' | 'assignment', index: number, end: 'from' | 'to') {
		selected = { kind, index, end };
	}

	function addBlock() {
		const last = blocks.map((block) => block.to).sort().at(-1);
		const from = last && last >= today ? addDays(last, 1) : today;
		blocks = [
			...blocks,
			{
				id: `season-${Date.now().toString(36)}`,
				kind: 'season',
				title: 'a season',
				detail: '',
				dose: '',
				target: '',
				from,
				to: addDays(from, 7 * 12 - 1)
			}
		];
		selected = { kind: 'block', index: blocks.length - 1, end: 'from' };
	}

	function removeBlock(index: number) {
		blocks = blocks.filter((_, i) => i !== index);
		if (selected.kind === 'block' && selected.index >= blocks.length) {
			selected = { kind: 'block', index: Math.max(0, blocks.length - 1), end: 'from' };
		}
	}

	/** The next language that holds nothing today gets a row. */
	/** True when another language already holds this slot over any of these days. */
	function slotBusy(index: number, slot: string) {
		// Tertiary is not a place, it is the absence of one: any number of
		// languages can be there at once.
		if (slot === 'tertiary') return false;
		const row = assignments[index];
		return assignments.some(
			(other, at) =>
				at !== index && other.slot === slot && other.from <= row.to && row.from <= other.to
		);
	}

	function addAssignment() {
		const busy = new Set(
			assignments.filter((item) => item.to >= today && item.from <= today).map((item) => item.language)
		);
		const free = languages.find((language) => !busy.has(language.id)) ?? languages[0];
		if (!free) return;
		const from = today;
		const to = addDays(today, 364);
		// One primary and one secondary at a time, so a new row takes the first
		// slot nobody else holds across the days it covers.
		const slot =
			SLOTS.find(
				(candidate) =>
					candidate === 'tertiary' ||
					!assignments.some(
						(item) => item.slot === candidate && item.from <= to && from <= item.to
					)
			) ?? 'tertiary';
		assignments = [
			...assignments,
			{
				language: free.id,
				slot,
				from,
				to,
				dose: slot === 'tertiary' ? '2 x 20 min' : '3 x 30 min',
				target: ''
			}
		];
		selected = { kind: 'assignment', index: assignments.length - 1, end: 'from' };
	}

	function removeAssignment(index: number) {
		assignments = assignments.filter((_, i) => i !== index);
		if (selected.kind === 'assignment' && selected.index >= assignments.length) {
			selected = { kind: 'block', index: 0, end: 'from' };
		}
	}

	function setLength(weeks: number) {
		if (selected.kind !== 'block') return;
		const block = blocks[selected.index];
		if (!block || !Number.isFinite(weeks) || weeks < 1) return;
		block.to = addDays(block.from, Math.round(weeks) * 7 - 1);
		blocks = [...blocks];
	}

	function lengthOf(block: Block) {
		return countWeeks(block.from, block.to);
	}

	async function save() {
		saving = true;
		problems = [];
		message = '';
		try {
			const response = await fetch('/api/plan', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...data.plan, updated: today, blocks, assignments, languages })
			});
			const body = await response.json();
			if (!response.ok) {
				problems = body.problems ?? [body.message ?? 'the plan did not save'];
				return;
			}
			message = 'saved';
			await goto('/seasons');
		} finally {
			saving = false;
		}
	}

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		unlocking = true;
		unlockError = '';
		const response = await fetch('/api/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ passphrase })
		});
		unlocking = false;
		if (response.ok) {
			await invalidateAll();
			return;
		}
		unlockError = 'that passphrase is not the one';
	}
</script>

<svelte:head>
	<title>edit the plan - bittanaycha</title>
	<meta name="description" content="Set the year: the language slots, the seasons, their dates and lengths." />
</svelte:head>

<main class="edit">
	{#if data.locked}
		<header class="now">
			<div>
				<h1>the plan</h1>
				<p class="line">The passphrase opens the editor.</p>
			</div>
			<div class="actions">
				<a href="/seasons">back</a>
			</div>
		</header>

		<form class="unlock" onsubmit={unlock}>
			<label for="passphrase">passphrase</label>
			<input
				id="passphrase"
				type="password"
				bind:value={passphrase}
				autocomplete="current-password"
				required
			/>
			<button type="submit" disabled={unlocking}>{unlocking ? 'checking' : 'unlock'}</button>
			{#if unlockError}<p class="problems">{unlockError}</p>{/if}
		</form>
	{:else}
	<header class="now">
		<div>
			<h1>the plan</h1>
		</div>
		<div class="actions">
			<button type="button" onclick={save} disabled={saving}>{saving ? 'saving' : 'save'}</button>
			<a href="/seasons">back</a>
		</div>
	</header>

	{#if message}<p class="ok">{message}</p>{/if}
	{#if clashes.length}
		<ul class="problems">
			{#each clashes as problem (problem)}<li>{problem}</li>{/each}
		</ul>
	{:else if problems.length}
		<ul class="problems">
			{#each problems as problem (problem)}<li>{problem}</li>{/each}
		</ul>
	{/if}

	<section class="pick">
		<div class="ring-wrap">
			<Ring
				from={windowFrom}
				to={windowTo}
				{seasons}
				blocks={ringBlocks}
				marks={ringMarks}
				labels={false}
				{today}
				onpick={setDate}
			/>
		</div>

		<div class="side">
			<p class="picking">
				{selected.end === 'from' ? 'start' : 'end'} of
				{selected.kind === 'block'
					? (blocks[selected.index]?.title ?? 'nothing')
					: (languages.find((language) => language.id === assignments[selected.index]?.language)
							?.name ?? 'nothing')}
				<strong>{numDate(focus)}</strong>
			</p>

			<div class="field">
				<label for="date">date</label>
				<input id="date" type="date" value={focus} oninput={(e) => setDate(e.currentTarget.value)} />
			</div>

			<div class="quick">
				<button type="button" onclick={() => quick(0)}>today</button>
				<button type="button" onclick={() => quick(30)}>1 month</button>
				<button type="button" onclick={() => quick(91)}>3 months</button>
				<button type="button" onclick={() => quick(182)}>6 months</button>
			</div>

			<div class="field">
				<label for="weeks">length in weeks</label>
				<input
					id="weeks"
					type="number"
					min="1"
					max="120"
					value={selected.kind === 'block' ? lengthOf(blocks[selected.index] ?? { from: today, to: today }) : ''}
					disabled={selected.kind !== 'block'}
					oninput={(e) => setLength(Number(e.currentTarget.value))}
				/>
			</div>

			<div class="systems">
				{#each systems as option (option)}
					<button
						type="button"
						class:on={system === option}
						onclick={() => (system = option)}>{option}</button
					>
				{/each}
			</div>

			<ul class="marks">
				{#each nearby as mark (mark.id)}
					<li>
						<button type="button" onclick={() => setDate(mark.date)} class:now={mark.date === focus}>
							<span class="mark-date">{mark.date.slice(5)}</span>
							<span class="mark-name">{mark.name}</span>
							<span class="mark-detail">{mark.detail}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="panel">
		<table>
			<thead>
				<tr>
					<th>title</th>
					<th>start</th>
					<th>end</th>
					<th>weeks</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each blocks as block, index (block.id)}
					<tr class:chosen={selected.kind === 'block' && selected.index === index}>
						<td><input value={block.title} oninput={(e) => (block.title = e.currentTarget.value)} /></td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'block' && selected.index === index && selected.end === 'from'} onclick={() => choose('block', index, 'from')}>
								{numDate(block.from)}
							</button>
						</td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'block' && selected.index === index && selected.end === 'to'} onclick={() => choose('block', index, 'to')}>
								{numDate(block.to)}
							</button>
						</td>
						<td class="num">{lengthOf(block)}</td>
						<td>
							<button type="button" class="remove" onclick={() => removeBlock(index)}>remove</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="add">
			<button type="button" onclick={addBlock}>+ season</button>
		</div>
	</section>

	<section class="panel">
		<table>
			<thead>
				<tr>
					<th>language</th>
					<th>slot</th>
					<th>from</th>
					<th>to</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each assignments as item, index (index)}
					<tr class:chosen={selected.kind === 'assignment' && selected.index === index}>
						<td>
							<select
								value={item.language}
								onchange={(e) => (item.language = e.currentTarget.value)}
							>
								{#each languages as language (language.id)}
									<option value={language.id}>{language.name}</option>
								{/each}
							</select>
						</td>
						<td>
							<select value={item.slot} onchange={(e) => (item.slot = e.currentTarget.value as Assignment['slot'])}>
								{#each SLOTS as slot (slot)}
									<option value={slot} disabled={slotBusy(index, slot) && item.slot !== slot}>
										{slot}{slotBusy(index, slot) && item.slot !== slot ? ' (taken)' : ''}
									</option>
								{/each}
							</select>
						</td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'assignment' && selected.index === index && selected.end === 'from'} onclick={() => choose('assignment', index, 'from')}>
								{numDate(item.from)}
							</button>
						</td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'assignment' && selected.index === index && selected.end === 'to'} onclick={() => choose('assignment', index, 'to')}>
								{numDate(item.to)}
							</button>
						</td>
						<td><button type="button" class="remove" onclick={() => removeAssignment(index)}>remove</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="add">
			<button type="button" onclick={addAssignment}>+ slot</button>
		</div>
	</section>

	<section class="panel">
		<table>
			<thead>
				<tr><th>name</th><th>level</th><th>state</th><th>aim</th><th>stage</th></tr>
			</thead>
			<tbody>
				{#each languages as language (language.id)}
					<tr>
						<td><input value={language.name} oninput={(e) => (language.name = e.currentTarget.value)} /></td>
						<td><input value={language.level} oninput={(e) => (language.level = e.currentTarget.value)} /></td>
						<td><input value={language.state} oninput={(e) => (language.state = e.currentTarget.value)} /></td>
						<td><input value={language.aim} oninput={(e) => (language.aim = e.currentTarget.value)} /></td>
						<td><input value={language.stage} oninput={(e) => (language.stage = e.currentTarget.value)} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}
</main>

<style>
	@font-face {
		font-family: 'Nothing';
		src: url('/fonts/nothing-font-5x7.otf') format('opentype');
		font-weight: 400;
		font-style: normal;
		font-display: block;
	}

	main {
		--ink: #fff;
		--dim: rgb(255 255 255 / 0.62);
		--faint: rgb(255 255 255 / 0.34);
		--rule: rgb(255 255 255 / 0.22);
		font-family: 'Nothing', ui-monospace, monospace;
		color: var(--ink);
		padding: 2.2rem 0 6rem;
		width: 100%;
		max-width: 88rem;
		margin-inline: auto;
		font-size: 0.84rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	h1 {
		font-size: clamp(1.6rem, 3vw, 2.4rem);
		font-weight: 400;
		letter-spacing: 0.08em;
		margin: 0.2rem 0 0.6rem;
	}


	.now {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1.5rem;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1rem;
	}


	.unlock {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
		margin: 0 0 2rem;
		font-size: 0.8rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.unlock input {
		flex: 1 1 14rem;
		max-width: 22rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid rgb(255 255 255 / 0.3);
		background: #000;
		color: var(--ink);
		font: inherit;
		letter-spacing: 0.08em;
	}

	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.ok {
		color: var(--spring);
	}

	.problems {
		color: var(--autumn);
		margin: 0.6rem 0 0;
	}

	.pick {
		display: grid;
		grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 2.5rem);
		border-bottom: 1px solid var(--rule);
		padding: 1.4rem 0;
	}

	.side {
		min-width: 0;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin: 0.5rem 0;
	}

	.picking {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: var(--dim);
	}

	.picking strong {
		display: block;
		margin-top: 0.3rem;
		color: var(--ink);
		font-weight: 400;
		font-size: 1.05rem;
		letter-spacing: 0.06em;
	}

	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	.quick button {
		padding: 0.35rem 0.6rem;
		border: 1px solid rgb(255 255 255 / 0.24);
		background: none;
		color: var(--dim);
		font: inherit;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		cursor: pointer;
	}

	.quick button:hover {
		color: var(--ink);
		border-color: var(--ink);
	}

	.systems {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.8rem 0;
	}

	.systems button.on {
		background: #fff;
		color: #000;
	}

	.marks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.2rem 1rem;
	}

	.marks button {
		display: grid;
		grid-template-columns: 3.4rem 1fr;
		gap: 0.5rem;
		text-align: left;
		width: 100%;
	}

	.mark-name {
		white-space: nowrap;
	}

	.mark-detail {
		grid-column: 2;
		color: rgb(255 255 255 / 0.45);
		font-size: 0.7rem;
	}

	button,
	input,
	select {
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
		background: none;
		border: 1px solid var(--rule);
		padding: 0.18rem 0.4rem;
	}

	button {
		cursor: pointer;
	}

	input {
		width: 100%;
		min-width: 4rem;
	}

	button.date {
		width: 100%;
		white-space: nowrap;
	}

	button.date.active {
		border-color: #fff;
		background: #fff;
		color: #000;
	}

	.panel {
		border-bottom: 1px solid var(--rule);
		padding: 1.4rem 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		margin-top: 0.6rem;
	}

	th {
		text-align: left;
		font-weight: 400;
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		color: rgb(255 255 255 / 0.45);
		padding-bottom: 0.4rem;
	}

	td {
		padding: 0.18rem 0.3rem 0.18rem 0;
		border-top: 1px solid rgb(255 255 255 / 0.12);
		vertical-align: middle;
	}

	tr.chosen td {
		background: rgb(255 255 255 / 0.05);
	}

	td.num {
		font-variant-numeric: tabular-nums;
	}

	.remove {
		border-color: transparent;
		color: rgb(255 255 255 / 0.5);
	}

	.add {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.8rem;
		flex-wrap: wrap;
	}

	@media (max-width: 60rem) {
		.pick {
			grid-template-columns: minmax(0, 1fr);
		}

		.marks {
			grid-template-columns: minmax(0, 1fr);
		}

		table {
			font-size: 0.72rem;
		}

		th:nth-child(5),
		td:nth-child(5),
		th:nth-child(8),
		td:nth-child(8) {
			display: none;
		}
	}
</style>
