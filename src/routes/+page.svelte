<script lang="ts">
	import { resolve } from '$app/paths';

	let google = $state<HTMLInputElement>();
	let wikipedia = $state<HTMLInputElement>();

	// `/` jumps to the first field from anywhere on the page, the way a browser
	// search bar does. Ignored while something else is already focused.
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.isContentEditable)) return;
		event.preventDefault();
		google?.focus();
	}
</script>

<svelte:window on:keydown={onKeydown} />

<main class="home">
	<section class="searches" aria-label="Search">
		<form
			class="search"
			action="https://www.google.com/search"
			method="get"
			target="_blank"
			rel="noreferrer"
		>
			<label class="eyebrow" for="q-google">google</label>
			<input
				id="q-google"
				name="q"
				type="search"
				autocomplete="off"
				spellcheck="false"
				bind:this={google}
			/>
			<button type="submit" aria-label="Search Google"><span aria-hidden="true">↵</span></button>
		</form>

		<form
			class="search"
			action="https://en.wikipedia.org/w/index.php"
			method="get"
			target="_blank"
			rel="noreferrer"
		>
			<label class="eyebrow" for="q-wikipedia">wikipedia</label>
			<input
				id="q-wikipedia"
				name="search"
				type="search"
				autocomplete="off"
				spellcheck="false"
				bind:this={wikipedia}
			/>
			<button type="submit" aria-label="Search Wikipedia"><span aria-hidden="true">↵</span></button>
		</form>
	</section>

	<section class="channels" aria-label="YouTube">
		<span class="eyebrow">youtube</span>
		<a class="channel" href="https://www.youtube.com/" target="_blank" rel="noreferrer" title="Open YouTube">
			<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.9 12 4.9 12 4.9s-6 0-7.7.4A2.7 2.7 0 0 0 2.4 7.2 28.3 28.3 0 0 0 2 12a28.3 28.3 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.7.4 7.7.4s6 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9A28.3 28.3 0 0 0 22 12a28.3 28.3 0 0 0-.4-4.8Z"
				/>
				<path class="mark-cut" d="M10.2 15.3V8.7L15.8 12l-5.6 3.3Z" />
			</svg>
			<span>youtube</span>
		</a>
	</section>

	<p class="elsewhere">
		<a href={resolve('/plate')}>plate <span aria-hidden="true">↗</span></a>
		a dithering studio
	</p>
</main>
