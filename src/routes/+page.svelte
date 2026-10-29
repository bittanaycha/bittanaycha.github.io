<script lang="ts">
	import { asset } from '$app/paths';
	import PebbleField, { type PlatePebble } from '#lib/components/PebbleField.svelte';

	// Placed by hand: a few big shapes, a few small ones, and enough paper
	// between them that the connectors have somewhere to wander.
	const pebbles: PlatePebble[] = [
		{ src: asset('photos/jungle.jpg'), x: 0.29, y: 0.16, r: 0.215, seed: 11 },
		{ src: asset('photos/cat.jpg'), x: 0.74, y: 0.18, r: 0.13, seed: 23 },
		{ src: asset('photos/kingfisher.jpg'), x: 0.62, y: 0.4, r: 0.112, seed: 31 },
		{ src: asset('photos/seedlings.jpg'), x: 0.24, y: 0.52, r: 0.172, seed: 47 },
		{ src: asset('photos/leopard.jpg'), x: 0.71, y: 0.62, r: 0.148, seed: 59 },
		{ src: asset('photos/hamster.jpg'), x: 0.3, y: 0.8, r: 0.113, seed: 71 },
		{ src: asset('photos/cactus.jpg'), x: 0.68, y: 0.87, r: 0.092, seed: 83 }
	];

	const links: [number, number][] = [
		[0, 1],
		[1, 2],
		[2, 4],
		[4, 3],
		[3, 5],
		[5, 6],
		[4, 6]
	];

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
	<PebbleField {pebbles} {links} cell={2} />

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
</main>
