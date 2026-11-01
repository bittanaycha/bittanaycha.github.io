<script lang="ts">
	import { onMount } from 'svelte';
	import { inkSets, type InkSet } from '#lib/plate/inks';

	let { value = $bindable() }: { value: InkSet } = $props();

	const MAX_COLOURS = 4;

	let colours = $derived([value.base, ...value.inks]);

	// The native colour input is only created after mount. Hydrating one makes
	// Svelte reset `value` to an empty string as part of its input handling,
	// which Chrome rejects for `type="color"` and logs a warning for. Creating
	// it client-side skips the hydration path entirely — and since the input
	// is transparent on top of the swatch, nothing flashes.
	let mounted = $state(false);
	onMount(() => (mounted = true));

	function choose(set: InkSet) {
		value = { ...set, inks: [...set.inks] };
	}

	function edit(next: Partial<InkSet>) {
		value = { ...value, id: 'custom', name: 'custom stack', note: 'Edited by hand.', ...next };
	}

	function setColour(index: number, hex: string) {
		if (index === 0) {
			edit({ base: hex });
			return;
		}

		const inks = [...value.inks];
		inks[index - 1] = hex;
		edit({ inks });
	}

	function addInk() {
		if (colours.length >= MAX_COLOURS) return;
		// New drums start as a mid-tone, so the effect is visible immediately
		// instead of adding a second pile of paper.
		edit({ inks: [...value.inks, '#b04a2e'] });
	}

	function removeInk(index: number) {
		if (value.inks.length <= 1) return;
		edit({ inks: value.inks.filter((_, i) => i !== index - 1) });
	}

	const labels = ['paper', 'ink one', 'ink two', 'ink three'];
</script>

<fieldset class="inks">
	<legend class="eyebrow">Ink stack</legend>

	<div class="sets">
		{#each inkSets as set (set.id)}
			{@const active = value.id === set.id}
			<button
				type="button"
				onclick={() => choose(set)}
				aria-pressed={active}
				class="set"
				class:on={active}
				title={set.note}
			>
				<span class="strip">
					{#each [set.base, ...set.inks] as colour, i (i)}
						<span class="band" style="background:{colour}"></span>
					{/each}
				</span>
				<span class="set-name" class:on={active}>{set.name}</span>
			</button>
		{/each}
	</div>

	<div class="drums">
		{#each colours as colour, i (i)}
			<div class="drum">
				<label class="drum-label" title={labels[i] ?? `ink ${i}`}>
					<span class="drum-swatch" style="background:{colour}"></span>
					{#if mounted}
						<input
							type="color"
							value={colour}
							oninput={(event) => setColour(i, event.currentTarget.value)}
							class="drum-input"
							aria-label="Colour for {labels[i] ?? `ink ${i}`}"
						/>
					{/if}
				</label>
				{#if i > 0 && colours.length > 2}
					<button
						type="button"
						onclick={() => removeInk(i)}
						class="drum-remove"
						title="Remove this ink"
					>
						−
					</button>
				{/if}
				<span class="drum-name">{labels[i] ?? `ink ${i}`}</span>
			</div>
		{/each}

		{#if colours.length < MAX_COLOURS}
			<button type="button" onclick={addInk} class="drum-add" title="Overprint another ink">
				+drum
			</button>
		{/if}
	</div>
</fieldset>

<style>
	.inks {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	legend {
		padding: 0;
		margin-bottom: 0.5rem;
	}

	.sets {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.375rem;
	}

	.set {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		border: 1px solid var(--rule);
		padding: 0.5rem;
		text-align: left;
		background: none;
		color: inherit;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.set:hover {
		border-color: var(--rule-strong);
	}
	.set.on {
		border-color: var(--accent);
		background: color-mix(in oklab, var(--accent) 10%, transparent);
	}

	.strip {
		display: flex;
		height: 1rem;
		width: 100%;
		overflow: hidden;
		border-radius: 1px;
	}
	.band {
		flex: 1;
	}

	.set-name {
		font-family: var(--mono);
		font-size: 0.6875rem;
		color: var(--ink-dim);
	}
	.set-name.on {
		color: var(--accent);
	}

	.drums {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}

	.drum {
		position: relative;
		flex: 1;
	}

	.drum-label {
		position: relative;
		display: block;
		cursor: pointer;
	}

	.drum-swatch {
		display: block;
		height: 2.5rem;
		width: 100%;
		border: 1px solid var(--rule);
		border-radius: 1px;
	}

	.drum-input {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2.5rem;
		width: 100%;
		cursor: pointer;
		opacity: 0;
	}

	.drum-remove {
		position: absolute;
		top: -0.375rem;
		right: -0.375rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		border: 1px solid var(--rule);
		background: var(--paper-deep);
		font-family: var(--mono);
		font-size: 0.625rem;
		line-height: 1;
		color: var(--ink-dim);
		cursor: pointer;
	}
	.drum-remove:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.drum-name {
		display: block;
		margin-top: 0.25rem;
		font-family: var(--mono);
		font-size: 0.625rem;
		color: color-mix(in oklab, var(--ink-dim) 80%, transparent);
	}

	.drum-add {
		flex: 1;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed var(--rule);
		border-radius: 1px;
		background: none;
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--ink-dim);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.drum-add:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
