<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { almanac, stamp } from '#lib/sun';
	import AlmanacIcon from '#lib/components/AlmanacIcon.svelte';

	const strips = {
		marseille: asset('strips/marseille.webp'),
		wigginton: asset('strips/home.webp')
	} as const;

	let google = $state<HTMLInputElement>();

	// Rise, set and the moon are computed in the browser: the page is
	// prerendered, so a build-time "today" would be the deploy's today.
	let almanacData = $state<ReturnType<typeof almanac> | null>(null);

	onMount(() => {
		almanacData = almanac(new Date());
	});

	let prompt = $state('');
	let promptForm = $state<HTMLFormElement>();
	let promptField = $state<HTMLTextAreaElement>();

	// Prompts run to several lines. The field grows to the height of its own
	// content, up to the max-height in the stylesheet, where it scrolls instead.
	function grow() {
		if (!promptField) return;
		promptField.style.height = 'auto';
		promptField.style.height = `${promptField.scrollHeight}px`;
	}

	$effect(() => {
		prompt;
		grow();
	});

	// The serif loads after the first paint and its metrics are not the
	// fallback's, so measure again once it is in.
	$effect(() => {
		document.fonts?.ready.then(grow);
	});

	// Enter hands the prompt over, Shift+Enter starts a new line, the same
	// bargain every chat box makes.
	function onPromptKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		promptForm?.requestSubmit();
	}

	// `/` jumps to the first field from anywhere on the page, the way a browser
	// search bar does. Ignored while something else is already focused.
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
			return;
		event.preventDefault();
		google?.focus();
	}
</script>

<svelte:window on:keydown={onKeydown} onresize={grow} />

<main class="home">
	<section class="searches island" aria-label="Search">
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
			/>
			<button type="submit" aria-label="Search Wikipedia"><span aria-hidden="true">↵</span></button>
		</form>

		<!-- DeepSeek reads `?q=` on load and prefills the chat box with it. -->
		<form
			class="search search--prompt"
			action="https://chat.deepseek.com/"
			method="get"
			target="_blank"
			rel="noreferrer"
			bind:this={promptForm}
		>
			<label class="whale-label" for="q-deepseek" title="Ask DeepSeek">
				<svg class="whale" viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45"
					/>
				</svg>
				<span class="sr-only">deepseek</span>
			</label>
			<textarea
				id="q-deepseek"
				name="q"
				rows="1"
				autocomplete="off"
				spellcheck="false"
				aria-describedby="q-deepseek-hint"
				bind:this={promptField}
				bind:value={prompt}
				onkeydown={onPromptKeydown}
			></textarea>
			<span class="sr-only" id="q-deepseek-hint">Enter sends, shift and enter starts a new line</span>
			<button type="submit" aria-label="Ask DeepSeek"><span aria-hidden="true">↵</span></button>
		</form>
	</section>

	<section class="channels island" aria-label="Elsewhere">
		<a
			class="channel"
			href="https://www.youtube.com/"
			target="_blank"
			rel="noreferrer"
			title="YouTube"
			aria-label="YouTube"
		>
			<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.9 12 4.9 12 4.9s-6 0-7.7.4A2.7 2.7 0 0 0 2.4 7.2 28.3 28.3 0 0 0 2 12a28.3 28.3 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.7.4 7.7.4s6 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9A28.3 28.3 0 0 0 22 12a28.3 28.3 0 0 0-.4-4.8Z"
				/>
				<path class="mark-cut" d="M10.2 15.3V8.7L15.8 12l-5.6 3.3Z" />
			</svg>
		</a>

		<a
			class="channel"
			href="https://github.com/bittanaycha"
			target="_blank"
			rel="noreferrer"
			title="GitHub"
			aria-label="GitHub"
		>
			<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
				/>
			</svg>
		</a>
	</section>

	{#if almanacData}
		<div class="sun-group">
			<div class="sun-tag island" style:--plate={`url('${asset('dithers/sun.webp')}')`}>
				<AlmanacIcon kind="sun" />
				<span class="eyebrow">sun</span>
			</div>

			{#each almanacData.days as day (day.place.id)}
			<div class="place island place--{day.place.id}">
				<img
					class="place-photo"
					src={strips[day.place.id as keyof typeof strips]}
					alt=""
					width="984"
					height="300"
				/>
				<span class="place-name">{day.place.name}</span>

				<span class="place-times">
					<span class="place-time">
						<span class="eyebrow">rise</span>
						<span class="almanac-num">{day.rise}</span>
					</span>
					<span class="place-time">
						<span class="eyebrow">set</span>
						<span class="almanac-num">{day.set}</span>
					</span>
					<span class="place-time">
						<span class="eyebrow">day</span>
						<span class="almanac-num">{day.length}</span>
					</span>
				</span>
			</div>
			{/each}
		</div>

		<section
			class="moon island"
			aria-label="Moon"
			style:--plate={`url('${asset('dithers/moon.webp')}')`}
		>
			<div class="almanac-title">
				<AlmanacIcon kind="moon" />
				<span class="eyebrow">moon</span>
			</div>

			<div class="moon-row">
				<span class="moon-phase">{almanacData.moon.name}</span>
				<span class="almanac-num">{Math.round(almanacData.moon.lit * 100)}%</span>
			</div>

			<dl class="moon-next">
				<dt>full</dt>
				<dd>{stamp(almanacData.moon.nextFull)}</dd>
				<dd class="moon-name">{almanacData.moon.fullName}</dd>
				<dt>new</dt>
				<dd>{stamp(almanacData.moon.nextNew)}</dd>
			</dl>
		</section>

	{/if}

	<img
		class="margin-plate margin-plate--deer"
		src={asset('animals/deer.webp' as 'animals/deer.webp')}
		alt=""
		aria-hidden="true"
		loading="lazy"
	/>
	<img
		class="margin-plate margin-plate--swift"
		src={asset('animals/swift.webp' as 'animals/deer.webp')}
		alt=""
		aria-hidden="true"
		loading="lazy"
	/>
</main>
