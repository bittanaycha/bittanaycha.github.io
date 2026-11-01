<script lang="ts">
	let {
		label,
		options,
		value = $bindable(),
		columns
	}: {
		label: string;
		options: { value: string; label: string; title?: string }[];
		value: string;
		/** Render as a grid of `columns` instead of a wrapped inline row. */
		columns?: number;
	} = $props();

	// Radio groups are scoped by name, so it has to be unique per instance
	// rather than per label — two controls could share a label on one page.
	const group = $props.id();
</script>

<fieldset class="seg">
	<legend class="eyebrow">{label}</legend>

	<div
		class="row"
		class:grid={columns !== undefined}
		style={columns ? `grid-template-columns: repeat(${columns}, minmax(0, 1fr));` : undefined}
	>
		{#each options as option (option.value)}
			<label class="opt" class:on={value === option.value} title={option.title}>
				<input type="radio" name={group} bind:group={value} value={option.value} class="sr-only" />
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.seg {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	legend {
		padding: 0;
		margin-bottom: 0.5rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.row.grid {
		display: grid;
	}

	.opt {
		cursor: pointer;
		border: 1px solid var(--rule);
		padding: 0.375rem 0.625rem;
		text-align: center;
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--ink-dim);
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.opt:hover {
		border-color: var(--rule-strong);
		color: var(--ink);
	}

	.opt.on {
		border-color: var(--accent);
		background: color-mix(in oklab, var(--accent) 10%, transparent);
		color: var(--accent);
	}

	.opt:has(input:focus-visible) {
		outline: 1px dashed var(--accent);
		outline-offset: 3px;
	}
</style>
