<script lang="ts">
	let {
		label,
		value = $bindable(),
		min = 0,
		max = 1,
		step = 0.01,
		format = (v: number) => String(v)
	}: {
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		format?: (value: number) => string;
	} = $props();

	// SSR and hydration have to agree on the id, so it comes from Svelte rather
	// than Math.random().
	const id = $props.id();
</script>

<div class="field">
	<div class="field-head">
		<label for={id}>{label}</label>
		<output for={id}>{format(value)}</output>
	</div>

	<input {id} type="range" {min} {max} {step} bind:value />
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	label {
		font-family: var(--mono);
		font-size: 0.6875rem;
		letter-spacing: 0.04em;
		color: var(--ink-dim);
	}

	output {
		font-family: var(--mono);
		font-size: 0.6875rem;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	input[type='range'] {
		width: 100%;
		height: 1.15rem;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 1px;
		background: var(--rule-strong);
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 0.7rem;
		height: 0.7rem;
		margin-top: -5px;
		border-radius: 999px;
		background: var(--ink);
		box-shadow: 0 0 0 1px var(--paper-deep);
	}

	input[type='range']::-moz-range-track {
		height: 1px;
		background: var(--rule-strong);
	}

	input[type='range']::-moz-range-thumb {
		width: 0.7rem;
		height: 0.7rem;
		border: none;
		border-radius: 999px;
		background: var(--ink);
		box-shadow: 0 0 0 1px var(--paper-deep);
	}
</style>
