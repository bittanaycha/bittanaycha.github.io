<script lang="ts">
	import Ring from '#lib/components/Ring.svelte';
	import { marksBetween, ringWindow, seasonsBetween, winterSolsticeIn } from '#lib/calendar';
	import { numDate } from '#lib/format';
	import {
		SLOTS,
		addDays,
		addMonths,
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

	/**
	 * The wheel follows what is being edited: half a year either side of the
	 * selected date. A date a year out stays on the wheel instead of sitting at
	 * its edge, which is what used to make a preset look like it jumped to 2028.
	 */
	let center = $state(today);
	const turn = $derived(ringWindow(center));
	const windowFrom = $derived(turn.from);
	const windowTo = $derived(turn.to);

	const clashes = $derived.by(() =>
		planProblems({
			updated: data.plan.updated,
			timezone: data.plan.timezone,
			languages,
			assignments,
			blocks
		})
	);

	const seasons = $derived(seasonsBetween(windowFrom, windowTo));
	const solstice = $derived(winterSolsticeIn(windowFrom, windowTo, center));

	/** Which endpoint the ring and the mark list are writing to. */
	let selected = $state<{ kind: 'block' | 'assignment'; index: number; end: 'from' | 'to' }>({
		kind: 'block',
		index: 0,
		end: 'from'
	});

	const SLOT_TONE: Record<string, string> = {
		primary: 'var(--lane-1)',
		secondary: 'var(--lane-2)',
		tertiary: 'var(--lane-3)'
	};

	const valid = (row: { from: string; to: string }) =>
		Boolean(row.from && row.to && row.from <= row.to);

	/**
	 * The wheel's rails: every season, then the three slots. The slots keep a
	 * rail even when nobody holds them, so an empty slot looks like a place to
	 * put a language rather than a missing row. One tone for all of them, as on
	 * the public page; the group gap does the separating.
	 */
	const ringLanes = $derived.by(() => {
		const seasons = [...blocks]
			.filter(valid)
			.sort((a, b) => (a.from < b.from ? -1 : 1))
			.map((block) => ({
				id: `block-${block.id}`,
				group: 'season' as const,
				label: block.title || 'a season',
				tone: 'var(--ink)',
				bars: [
					{
						id: block.id,
						title: block.title || 'a season',
						icon: block.icon,
						from: block.from,
						to: block.to,
					}
				]
			}));

		const slots = SLOTS.map((slot) => ({
			id: `slot-${slot}`,
			group: 'language' as const,
			label: slot,
			tone: 'var(--ink)',
			bars: assignments
				.filter((item) => item.slot === slot && valid(item))
				.sort((a, b) => (a.from < b.from ? -1 : 1))
				.map((item) => ({
					id: `${item.language}-${item.from}`,
					title: languages.find((language) => language.id === item.language)?.name ?? item.language,
					from: item.from,
					to: item.to,
				}))
		}));

		return [...seasons, ...slots];
	});

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

	/** Keep the inclusive length when one end is pushed past the other. */
	function keepSpan(row: { from: string; to: string }, end: 'from' | 'to', date: string) {
		const span = Math.max(0, countDays(row.from, row.to));
		if (end === 'from') {
			row.from = date;
			if (row.to < date) row.to = addDays(date, span - 1);
		} else {
			row.to = date;
			if (row.from > date) row.from = addDays(date, -(span - 1));
		}
	}

	/** Bring a date onto the wheel, but only when it has left the window. */
	function recenter(date: string) {
		if (date < windowFrom || date > windowTo) center = date;
	}

	function setDate(date: string) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
		const row = selected.kind === 'block' ? blocks[selected.index] : assignments[selected.index];
		if (!row) return;
		keepSpan(row, selected.end, date);
		if (selected.kind === 'block') blocks = [...blocks];
		else assignments = [...assignments];
		recenter(date);
		message = '';
	}

	/**
	 * The preset dates are absolute and land on the endpoint being edited:
	 * today is today, three months is the same day three calendar months out.
	 * They do not snap to a festival, and they do not move the other end unless
	 * the new date would cross it.
	 */
	function quick(months: number) {
		setDate(months === 0 ? today : addMonths(today, months));
	}

	function choose(kind: 'block' | 'assignment', index: number, end: 'from' | 'to') {
		selected = { kind, index, end };
		const row = kind === 'block' ? blocks[index] : assignments[index];
		recenter(row?.[end] ?? today);
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
				icon: '',
				detail: '',
				from,
				to: addDays(from, 7 * 12 - 1)
			}
		];
		selected = { kind: 'block', index: blocks.length - 1, end: 'from' };
		recenter(from);
	}

	function removeBlock(index: number) {
		blocks = blocks.filter((_, i) => i !== index);
		if (selected.kind === 'block' && selected.index >= blocks.length) {
			selected = { kind: 'block', index: Math.max(0, blocks.length - 1), end: 'from' };
		}
	}

	/** The first language holding no slot over these days, else the first. */
	function nextFree(from: string, to: string) {
		const taken = new Set(
			assignments.filter((item) => item.from <= to && from <= item.to).map((item) => item.language)
		);
		return languages.find((language) => !taken.has(language.id)) ?? languages[0];
	}

	/**
	 * Add a stretch to a slot. It follows the last stretch in that slot, keeps
	 * the same length, and takes a language nobody else holds on those days.
	 */
	function addAssignment(slot: string) {
		const same = assignments
			.filter((item) => item.slot === slot)
			.sort((a, b) => (a.from < b.from ? -1 : 1));
		const last = same.at(-1);
		const from = last ? addDays(last.to, 1) : today;
		const span = last ? Math.max(6, countDays(last.from, last.to)) : 181;
		const to = addDays(from, span - 1);
		const free = nextFree(from, to);
		if (!free) return;
		assignments = [
			...assignments,
			{
				language: free.id,
				slot: slot as Assignment['slot'],
				from,
				to
			}
		];
		selected = { kind: 'assignment', index: assignments.length - 1, end: 'from' };
		recenter(from);
		message = '';
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
		recenter(block.to);
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
				anchor={solstice}
				lanes={ringLanes}
				marks={ringMarks}
				labels={false}
				{today}
				cursor={focus}
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
				<button type="button" onclick={() => quick(1)}>in 1 month</button>
				<button type="button" onclick={() => quick(3)}>in 3 months</button>
				<button type="button" onclick={() => quick(6)}>in 6 months</button>
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
		<table class="blocks">
			<thead>
				<tr>
					<th>icon</th>
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
						<td class="icon-cell">
							<input
								class="icon-input"
								value={block.icon}
								maxlength="4"
								aria-label="icon"
								oninput={(e) => (block.icon = e.currentTarget.value)}
							/>
						</td>
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
		<p class="tag">slots</p>
		{#each SLOTS as slot (slot)}
			{@const rows = assignments
				.map((item, index) => ({ item, index }))
				.filter(({ item }) => item.slot === slot)}
			<div class="slot" class:empty={rows.length === 0} style:--slot-tone={SLOT_TONE[slot]}>
				<div class="slot-head">
					<span class="slot-name">{slot}</span>
					<button type="button" class="add-slot" onclick={() => addAssignment(slot)}>
						+ language
					</button>
				</div>

				{#if rows.length}
					<table>
						<thead>
							<tr>
								<th>language</th>
								<th>from</th>
								<th>to</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each rows as { item, index } (index)}
								<tr class:chosen={selected.kind === 'assignment' && selected.index === index}>
									<td>
										<select
											value={item.language}
											onchange={(e) => {
												item.language = e.currentTarget.value;
												assignments = [...assignments];
											}}
										>
											{#each languages as language (language.id)}
												<option value={language.id}>{language.name}</option>
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
									<td>
										<button type="button" class="remove" onclick={() => removeAssignment(index)}>remove</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/each}
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
		border-bottom: 1px dotted var(--rule);
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
		border: 1px solid var(--rule);
		background: var(--field);
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
		grid-template-columns: minmax(0, 30rem) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 2.5rem);
		border-bottom: 1px dotted var(--rule);
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
		border: 1px solid var(--rule);
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
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
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
		font-family: 'DotGothic16', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Noto Sans JP', sans-serif;
		white-space: nowrap;
	}

	.mark-detail {
		grid-column: 2;
		color: var(--faint);
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
		border-color: var(--ink);
		background: var(--ink);
		color: var(--bg);
	}

	.panel {
		border-bottom: 1px dotted var(--rule);
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
		color: var(--faint);
		padding-bottom: 0.4rem;
	}

	td {
		padding: 0.18rem 0.3rem 0.18rem 0;
		border-top: 1px dotted var(--rule);
		vertical-align: middle;
	}

	tr.chosen td {
		background: var(--wash);
	}

	td.num {
		font-variant-numeric: tabular-nums;
	}

	.blocks th:nth-child(1) {
		width: 3.4rem;
	}

	.blocks th:nth-child(3),
	.blocks th:nth-child(4) {
		width: 8rem;
	}

	.blocks th:nth-child(5),
	.blocks th:nth-child(6) {
		width: 5rem;
	}

	.icon-cell {
		padding-right: 0.5rem;
	}

	.icon-input {
		min-width: 0;
		padding: 0.1rem 0.2rem;
		text-align: center;
		font-size: 1rem;
	}

	.remove {
		border-color: transparent;
		color: var(--faint);
	}

	.add {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.8rem;
		flex-wrap: wrap;
	}

	.tag {
		margin: 0 0 0.9rem;
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		color: var(--faint);
	}

	/* A slot is a lane with its own colour, not a row in one big table. */
	.slot {
		border-left: 2px solid var(--slot-tone);
		padding: 0.1rem 0 0.9rem 1rem;
		margin-bottom: 1.5rem;
	}

	.slot:last-child {
		margin-bottom: 0;
	}

	.slot.empty {
		border-left-color: var(--rule);
	}

	.slot-head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
	}

	.slot table th:nth-child(1) {
		width: 8.5rem;
	}

	.slot table th:nth-child(2),
	.slot table th:nth-child(3) {
		width: 7.5rem;
	}

	.slot table th:nth-child(4) {
		width: 6rem;
	}

	.slot-name {
		font-size: 0.95rem;
		letter-spacing: 0.14em;
	}

	.add-slot {
		margin-left: auto;
		border-color: transparent;
		color: var(--dim);
	}

	.add-slot:hover {
		border-color: var(--ink);
		color: var(--ink);
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

		.blocks th:nth-child(5),
		.blocks td:nth-child(5) {
			display: none;
		}

		.blocks th:nth-child(1) {
			width: 2.8rem;
		}

		.blocks th:nth-child(3) {
			width: 6.5rem;
		}

		.blocks th:nth-child(6) {
			width: 4rem;
		}
	}
</style>
