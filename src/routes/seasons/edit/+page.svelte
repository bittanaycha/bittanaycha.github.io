<script lang="ts">
	import Ring from '#lib/components/Ring.svelte';
	import { marksBetween, localDate } from '#lib/calendar';
	import {
		KINDS,
		SLOTS,
		addDays,
		weeks as countWeeks,
		type Assignment,
		type Block,
		type Language
	} from '#lib/plan-rules';
	import { goto } from '$app/navigation';

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

	let problems = $state<string[]>([]);
	let message = $state('');
	let saving = $state(false);

	const DEFAULT_DOSE: Record<string, string> = {
		running: 'as the plan says',
		music: '20 min a day',
		study: 'one chapter a week'
	};

	const systems = ['all', 'astronomical', 'meteorological', 'celtic', 'sekki', 'ko'] as const;
	let system = $state<(typeof systems)[number]>('all');

	const windowFrom = $derived(blocks.map((b) => b.from).sort()[0] ?? today);
	const windowTo = $derived(blocks.map((b) => b.to).sort().at(-1) ?? addDays(today, 365));

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
		const found = marksBetween(middle - 70 * 86_400_000, middle + 70 * 86_400_000, undefined);
		return found
			.filter((mark) => system === 'all' || mark.system === system)
			.map((mark) => ({ ...mark, gap: Math.abs(new Date(`${mark.date}T12:00:00Z`).getTime() - middle) }))
			.sort((a, b) => a.gap - b.gap)
			.slice(0, 10)
			.sort((a, b) => (a.date < b.date ? -1 : 1));
	});

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

	function choose(kind: 'block' | 'assignment', index: number, end: 'from' | 'to') {
		selected = { kind, index, end };
	}

	function addBlock(kind: (typeof KINDS)[number]) {
		const last = blocks
			.filter((block) => block.kind === kind)
			.map((block) => block.to)
			.sort()
			.at(-1);
		const from = last ? addDays(last, 1) : today;
		blocks = [
			...blocks,
			{
				id: `${kind}-${Date.now().toString(36)}`,
				kind,
				title: `a ${kind} season`,
				detail: '',
				dose: DEFAULT_DOSE[kind],
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
	function addAssignment() {
		const busy = new Set(
			assignments.filter((item) => item.to >= today && item.from <= today).map((item) => item.language)
		);
		const free = languages.find((language) => !busy.has(language.id)) ?? languages[0];
		if (!free) return;
		const taken = new Set(
			assignments.filter((item) => item.to >= today && item.from <= today).map((item) => item.slot)
		);
		const slot = SLOTS.find((candidate) => !taken.has(candidate)) ?? 'tertiary';
		assignments = [
			...assignments,
			{
				language: free.id,
				slot,
				from: today,
				to: addDays(today, 364),
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
</script>

<svelte:head>
	<title>edit the plan - bittanaycha</title>
	<meta name="description" content="Set the year: the language slots, the seasons, their dates and lengths." />
</svelte:head>

<main class="edit">
	<header class="now">
		<div>
			<p class="tag">seasons / edit</p>
			<h1>the plan</h1>
			<p class="line">
				Languages hold slots; everything else is a season you name and date. Click the ring
				to set a date.
			</p>
		</div>
		<div class="actions">
			<button type="button" onclick={save} disabled={saving}>{saving ? 'saving' : 'save'}</button>
			<a href="/seasons">back</a>
		</div>
	</header>

	{#if message}<p class="ok">{message}</p>{/if}
	{#if problems.length}
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
				{today}
				onpick={setDate}
			/>
		</div>

		<div class="side">
			<p class="tag">
				picking {selected.end === 'from' ? 'the start' : 'the end'} of
				{selected.kind === 'block'
					? (blocks[selected.index]?.title ?? 'nothing')
					: (languages.find((language) => language.id === assignments[selected.index]?.language)
							?.name ?? 'nothing')}
			</p>

			<div class="field">
				<label for="date">date</label>
				<input id="date" type="date" value={focus} oninput={(e) => setDate(e.currentTarget.value)} />
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
		<p class="tag">blocks</p>
		<table>
			<thead>
				<tr>
					<th>kind</th>
					<th>title</th>
					<th>start</th>
					<th>end</th>
					<th>weeks</th>
					<th>dose</th>
					<th>target</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each blocks as block, index (block.id)}
					<tr class:chosen={selected.kind === 'block' && selected.index === index}>
						<td>
							<select value={block.kind} onchange={(e) => (block.kind = e.currentTarget.value as Block['kind'])}>
								{#each KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
							</select>
						</td>
						<td><input value={block.title} oninput={(e) => (block.title = e.currentTarget.value)} /></td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'block' && selected.index === index && selected.end === 'from'} onclick={() => choose('block', index, 'from')}>
								{block.from}
							</button>
						</td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'block' && selected.index === index && selected.end === 'to'} onclick={() => choose('block', index, 'to')}>
								{block.to}
							</button>
						</td>
						<td class="num">{lengthOf(block)}</td>
						<td><input value={block.dose} oninput={(e) => (block.dose = e.currentTarget.value)} /></td>
						<td><input value={block.target} oninput={(e) => (block.target = e.currentTarget.value)} /></td>
						<td>
							<button type="button" class="remove" onclick={() => removeBlock(index)}>remove</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="add">
			{#each KINDS as kind (kind)}
				<button type="button" onclick={() => addBlock(kind)}>+ {kind}</button>
			{/each}
		</div>
	</section>

	<section class="panel">
		<p class="tag">language slots - one primary, one secondary, the rest tertiary</p>
		<table>
			<thead>
				<tr>
					<th>language</th>
					<th>slot</th>
					<th>from</th>
					<th>to</th>
					<th>dose</th>
					<th>target</th>
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
								{#each SLOTS as slot (slot)}<option value={slot}>{slot}</option>{/each}
							</select>
						</td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'assignment' && selected.index === index && selected.end === 'from'} onclick={() => choose('assignment', index, 'from')}>
								{item.from}
							</button>
						</td>
						<td>
							<button type="button" class="date" class:active={selected.kind === 'assignment' && selected.index === index && selected.end === 'to'} onclick={() => choose('assignment', index, 'to')}>
								{item.to}
							</button>
						</td>
						<td><input value={item.dose} oninput={(e) => (item.dose = e.currentTarget.value)} /></td>
						<td><input value={item.target} oninput={(e) => (item.target = e.currentTarget.value)} /></td>
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
		<p class="tag">languages</p>
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
</main>

<style>
	@font-face {
		font-family: 'Nothing';
		src: url('/fonts/nothing-font-5x7.otf') format('opentype');
		font-weight: 400;
		font-style: normal;
		font-display: block;
	}

	:global(html),
	:global(body) {
		background: #000;
		background-image: none;
	}

	:global(.sea),
	:global(.ship) {
		display: none;
	}

	:global(.deck) {
		max-width: none;
		padding: 1rem clamp(1rem, 4vw, 3rem) 0;
	}

	main {
		font-family: 'Nothing', ui-monospace, monospace;
		color: #fff;
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

	.tag {
		margin: 0;
		font-size: 0.66rem;
		letter-spacing: 0.22em;
		color: rgb(255 255 255 / 0.45);
	}

	.now {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1.5rem;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1rem;
	}

	.line {
		color: rgb(255 255 255 / 0.7);
		margin: 0;
		max-width: 46rem;
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
