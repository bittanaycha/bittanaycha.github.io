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
	let googleQuery = $state('');
	let wiki = $state<HTMLInputElement>();
	let wikiQuery = $state('');

	// A search that opened its answer in another tab has nothing left to ask, so
	// the field goes back to empty. The clear waits for the next task: the browser
	// builds the form's entry list right after the submit event, and a field
	// emptied in the handler would submit nothing.
	function clearAfterSubmit(
		field: HTMLInputElement | HTMLTextAreaElement | undefined,
		clear: () => void
	) {
		if (!field?.value) return;
		setTimeout(clear, 0);
	}

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

	// Enter sends the prompt, Shift+Enter starts a new line, the same bargain
	// every chat box makes.
	function onPromptKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		if (prompt.trim()) promptForm?.requestSubmit();
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
			onsubmit={() => clearAfterSubmit(google, () => (googleQuery = ''))}
		>
			<label class="eyebrow" for="q-google">google</label>
			<input
				id="q-google"
				name="q"
				type="search"
				autocomplete="off"
				spellcheck="false"
				bind:this={google}
				bind:value={googleQuery}
			/>
			<button type="submit" aria-label="Search Google"><span aria-hidden="true">↵</span></button>
		</form>

		<form
			class="search"
			action="https://en.wikipedia.org/w/index.php"
			method="get"
			target="_blank"
			rel="noreferrer"
			onsubmit={() => clearAfterSubmit(wiki, () => (wikiQuery = ''))}
		>
			<label class="eyebrow" for="q-wikipedia">wikipedia</label>
			<input
				id="q-wikipedia"
				name="search"
				type="search"
				autocomplete="off"
				spellcheck="false"
				bind:this={wiki}
				bind:value={wikiQuery}
			/>
			<button type="submit" aria-label="Search Wikipedia"><span aria-hidden="true">↵</span></button>
		</form>

		<!-- DeepSeek's landing page sends a prompt handed over with `autosend=1`;
		     the chat app reads `q` alongside it and sends once the message is in
		     the box. -->
		<form
			class="search search--prompt"
			action="https://chat.deepseek.com/"
			method="get"
			target="_blank"
			rel="noreferrer"
			bind:this={promptForm}
			onsubmit={() => clearAfterSubmit(promptField, () => (prompt = ''))}
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
			<input type="hidden" name="autosend" value="1" />
			<input type="hidden" name="source" value="landing" />
			<span class="sr-only" id="q-deepseek-hint"
				>Enter sends the prompt straight away; Shift and Enter starts a new line.</span
			>
			<button type="submit" aria-label="Send to DeepSeek" title="Send now"
				><span aria-hidden="true">↑</span></button
			>
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

		<!-- Both papers publish a masthead. The Guardian's is drawn in one ink like
		     the glyphs; Libération's diamond only reads in its own red, so that
		     one keeps its colours. They are one group: a narrow card moves both
		     to a second line rather than stranding Libération under a full row. -->
		<div class="channel-group">
			<a
				class="channel channel--mark"
				href="https://www.theguardian.com/"
				target="_blank"
				rel="noreferrer"
				title="The Guardian"
				aria-label="The Guardian"
			>
				<svg class="wordmark" viewBox="0 0 1704.102 300" aria-hidden="true">
					<path d="M110.461 71.542H75.359l.198-37.48L23.6 41.795v28.954L0 74.318v23.005h24.392l-.198 100.942c.171 3.631 6.002 36.387 41.447 34.307 40.206-2.357 43.63-6.939 47.198-9.321-.283.295 0-19.632 0-19.632l-21.814.596s-12.295-.793-14.279-14.478c-.077.01-.396-92.018-.396-92.018l34.111.198V71.542zM185.968 0l-70.154 10.065.1 13.386 18.641 8.33.198 175.209-17.65 6.941.199 14.377 86.067.099v-14.278l-17.352-7.537.1-103.619s9.817-4.362 23.4-4.362c13.584 0 19.831 8.726 19.831 14.081v94.199l-15.865 7.039v14.478h85.869v-13.881l-17.65-8.628V99.702s.398-33.713-38.671-32.028c-23.769.143-40.605 7.635-57.163 20.724 0-.049 0-88.299.1-88.398zM447.632 154.134c1.992-34.57-1.622-89.688-71.378-86.381-68.355 3.24-76.985 55.529-76.564 89.325 3.928 54.608 32.086 74.908 84.979 75.725 41.788-1.403 56.932-23.418 56.932-23.418v-14.794s-19.633 5.889-40.245 5.748c-48.798-.333-48.239-46.205-48.239-46.205h94.515zm-94.655-18.37s-.289-22.283 4.155-36.433c3.545-11.291 10.715-15.019 18.983-15.031 13.772-.021 17.215 7.702 18.763 17.19 2.228 13.653 1.861 32.16 1.71 32.311l-43.611 1.963z" />
					<path d="M580.064 194.494h-62.271s-9.32-.992-9.717-10.512 6.346-11.898 6.346-11.898 13.288 3.967 27.169 3.967 68.418-5.752 68.418-52.95c0-21.441-16.855-33.713-16.855-33.713l30.156 8.08-.509-30.983-43.53 8.031s-22.606-8.229-38.671-8.229c-10.808 0-66.537 4.284-68.569 53.21-1.435 34.542 27.717 47.432 27.52 47.432-.199 0-27.765 17.055-27.963 38.275-.191 20.43 23.139 26.703 24.874 27.141.074.003.114.012.112.028l-.112-.028c-2.239-.067-37.967 6.646-37.963 31.759.003 23.996 39.663 35.696 81.705 35.894 42.042.199 88.249-11.701 88.249-61.477s-48.389-44.027-48.389-44.027zm-39.86-109.368c19.336-.1 19.435 19.93 19.534 28.358v14.974s2.578 26.971-17.849 27.07c-20.425.099-19.83-15.667-19.83-27.07v-17.65s-1.189-25.583 18.145-25.682zm.1 195.834c-28.756 0-39.067-11.7-39.067-23.004s7.04-15.964 7.04-15.964l62.369-.099s12.396 1.386 12.396 12.295c-.001 16.762-13.983 26.772-42.738 26.772zM698.457 67.376l-70.203 10.908v13.684l18.046 8.726v88.249s.938 43.338 43.432 43.828c34.506.396 51.759-23.6 51.759-23.6v23.203l68.021-8.132V211.75l-17.382-10.035V67.776l-69.875 10.908v13.089l18.443 9.32v94.2s-4.759 3.966-20.029 5.155c-15.27 1.19-22.211-13.286-22.211-13.286l-.001-119.786zM823.864 78.691s33.515-12.2 61.14-12.2 67.59 9.395 67.59 43.751v95.215l17.108 8.974v11.359s-12.199 6.59-30.148 6.59c-17.95 0-33.515-9.115-33.515-22.857-3.901.07-5.321 22.578-47.397 22.578-49.08 0-45.294-43.471-45.294-44.312s-1.412-32.451 34.356-39.265c35.337-6.73 51.744-9.395 51.744-9.395l-.172-31.972s-2.913-19.352-19.601-19.212c-16.687.141-16.547.281-16.547.281l-11.778 32.112h-27.625l.139-41.647zm76.915 119.825v-43.189s-35.199-3.155-35.268 25.03c-.051 21.22 13.284 23.698 19.352 23.698 6.943-.444 11.55-2.887 15.916-5.539zM1041.498 65.93l-68.57 10.797V91.03l17.669 8.413v106.153l-16.407 8.414v13.461h90.309V214.57l-21.596-8.694.141-87.643s13.742-5.469 27.624-5.469c13.883 0 20.755 1.542 20.755 1.542V68.451s-29.388-9.205-50.202 31.832c-.003.143.277-34.353.277-34.353zM1177.379 13.625v13.882l17.248 8.273v37.582s-12.058-5.75-26.643-5.75c-14.584 0-74.182 2.244-75.863 84.138-1.685 81.893 61.98 80.771 61.42 80.771s29.167.842 42.629-16.547c-.07 0-.141 16.477-.141 16.477l67.382-8.203v-13.322l-16.198-8.273-.14-199.964-69.694 10.936zm17.179 81.193v106.433s-5.56 2.805-15.916 2.805c-16.843 0-31.093-11.461-30.992-48.379.091-32.251 4.797-57.59 18.903-64.225 14.101-6.633 27.35 2.477 28.005 3.366zM1340.198 28.805c0 15.819-12.838 28.656-28.656 28.656-15.819 0-28.656-12.837-28.656-28.656 0-15.818 12.837-28.656 28.656-28.656 15.818 0 28.656 12.837 28.656 28.656zm-1.19 37.778l-71.195 10.114v13.684l18.642 9.123v106.295l-17.055 7.734v14.478h85.671v-13.882l-16.261-7.934.198-139.612zM1371.508 78.515s33.517-12.199 61.141-12.199c27.625 0 67.591 9.395 67.591 43.751v95.215l17.108 8.975v11.357s-12.2 6.592-30.149 6.592-33.516-9.115-33.516-22.858c-3.9.07-5.32 22.577-47.396 22.577-49.08 0-45.293-43.47-45.293-44.312 0-.841-1.411-32.45 34.356-39.263 35.336-6.731 51.744-9.396 51.744-9.396l-.173-31.972s-2.912-19.352-19.6-19.211-16.547.28-16.547.28l-11.779 32.112h-27.624l.137-41.648zm76.917 119.825v-43.19s-35.199-3.154-35.269 25.031c-.051 21.218 13.284 23.698 19.353 23.698 6.94-.443 11.55-2.889 15.916-5.539zM1589.873 66.187l-70.004 11.106V90.58l18.839 8.924v107.088l-17.252 6.941v14.874h85.671v-14.675l-15.866-7.537V102.677s8.527-3.967 21.021-3.967c12.495 0 22.211 5.553 22.211 17.848v89.637l-17.578 8.638-.073 13.176h87.258V213.93l-17.054-7.139v-99.354s1.189-39.662-39.068-39.662-57.907 21.219-57.907 21.219l-.198-22.807z" />
					</svg>
			</a>

			<a
				class="channel channel--mark"
				href="https://www.liberation.fr/"
				target="_blank"
				rel="noreferrer"
				title="Libération"
				aria-label="Libération"
			>
				<svg class="wordmark" viewBox="0 0 272 100" aria-hidden="true">
					<path fill="#E91845" d="M0.5,49.7L136,0.6l135.5,49.1L136,99.4L0.5,49.7" />
					<path fill="none" stroke="#434242" stroke-width="0.11" d="M217.1,76.4h8.7V81h-8.7V76.4z" />
					<path fill="#454545" d="M221.4,78.7" />
					<path fill="none" stroke="#434242" stroke-width="0.11" d="M221.4,78.7" />
					<path fill="#454545" d="M77.2,77.1" />
					<path fill="none" stroke="#434242" stroke-width="0.11" d="M77.2,77.1" />
					<path fill="#454545" d="M175.9,19.6" />
					<path fill="none" stroke="#434242" stroke-width="0.11" d="M175.9,19.6" />
					<path fill="#1B1B1F" stroke="#1B1B1F" stroke-width="0.11" d="M218.2,26.6l-3.1-2.6l-5.6-1.8v9.3h-3.2 v-1.6c0-6.4-4.3-8.4-9.6-7.7h-0.4c-4.3,0-9.4,2.2-9.4,8.5v0.8h-3.8v-19h-8.5v3.4h-3.7v-2.3l-8,3v5.7h-2.2v3.8h-3.9 c-1.7-3.2-5.3-4.1-8.5-4.1H148c-1.6,0-3.4,0.3-4.9,1.1c-4.6-2.9-7.4-0.1-8.8,2.8l-0.1-0.1v-3.2H123v35.1h-9v15c0,2.6-3.7,2.7-3.7,0 V51.5h11.4V30.9c0-6.4-5.1-8.5-9.5-8.5h-1.1v-2.1H111l6.5-8.5h-7l-4.1,8.5v3.4c-2.2,1.3-3.9,3.5-3.9,7.2v2.5h-4.1v-1.9 c0.6-10.9-8.8-11.1-11.8-4.8V11.8H65.1v61.6h-8.8V11.9h-9.9V81h40.2v-2.8c1.9,5.1,11.8,4.6,11.8-6V72h4.1v0.6 c-1.8,6.7,4.9,8.8,9.2,8.8c0,0,10.5,0.8,10-7.6v-6.6h1.3v13.9h11.3V29.8h0.1c0.8-1.1,2.5-1.1,4.4,0.3v9.8h7.7v-8.4 c0-2.6,3.7-2.7,3.7,0v10.4c-7.7,4.8-11.5,6.3-11.4,12.2v21.7c0,5.6,6.9,8.1,11.4,2.5v2.8h7.8V68.7h5.2v7.4c0,6.7,6.3,6,11.8,3.6v1.4 h8.5V70.2h3.8v2.3c0,6.4,5.2,8.9,10.6,9.1c1.9,0.1,6.9,0.1,8.7-3.5v-7.9h3.2V81h20.9V31.4C230.4,20.7,220.5,20.5,218.2,26.6z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M42.9,10.1h8.8v60.6h10v7.6H42.9V10.1z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M82.9,23.7c2.3-6.2,11.4-5.9,11.4,4.8v40.6C94,80.4,84.3,81,82.9,74.7v3.4h-8.7v-68h8.7V23.7" />
					<path fill="#1B1B1F" stroke="#1B1B1F" stroke-width="0.11" d="M86.2,70.2c0,2.6-3.4,2.7-3.4,0v-42 c0-2.7,3.4-2.6,3.4,0V70.2z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M109.7,55.1h7.7v14.7 c0,6.4-5.1,8.8-9.5,8.8h-0.3c-4.3,0-9.4-2.5-9.4-8.8V28.1c0-6.4,5.1-8.6,9.4-8.6h0.3c4.4,0,9.5,2.2,9.5,8.6v20.7H106v21.4 c0,2.7,3.7,2.6,3.7,0V55.1L109.7,55.1z" />
					<path fill="#1B1B1F" stroke="#1B1B1F" stroke-width="0.11" d="M106.1,43.5V28.2c0-2.7,3.7-2.6,3.7,0 v15.3H106.1" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M105.4,16.7h4.5l5.1-6h-6.7L105.4,16.7z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M129.7,27c1.6-2.8,3.4-1.2,6,1.4 c2.5,2.6,8.1-4.3,3.3-7.8c-4.8-3.4-7.8-0.4-9.3,2.6l-0.1-0.2v-3H121v58.1h8.7V27z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M134.1,69.4V51.1 c-0.1-6,3.7-7.5,11.4-12.3V27.9c0.1-2.9-3.7-2.6-3.7,0v9h-7.7v-9.2c0-6.4,5.1-8.5,9.4-8.5h0.3c4.4,0,9.5,2.2,9.5,8.5v50.4h-7.8 v-2.8c-4.5,5.6-11.3,3.8-11.4-2.5V69.4z" />
					<path fill="#1B1B1F" stroke="#1B1B1F" stroke-width="0.11" d="M142.2,51.3c0-2.6,2.5-4,3.3-4.5v23.3 c0,2.6-3.3,2.7-3.3,0V51.3" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M165.9,26.5h2.2V20h-2.2l0.1-8.9l-8,2.7 V20h-2.2v6.5h2.2v47.2c0,6.2,6.8,5.2,10.4,3.5v-5.3c-1.5,0-2.3-1.5-2.3-3.8C165.9,66.6,165.9,43.2,165.9,26.5z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M171.1,20h7.9v58.1h-7.9V20z M171.1,10.2 h8.4v7.2h-8.4V10.2z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M202.3,55.1v14.7c0,6.4-5,8.7-9.3,8.7 h-0.3c-4.4,0-9.6-2.4-9.6-8.7V28.1c0-6.4,5.1-8.6,9.5-8.6h0.3c4.3,0,9.4,2.2,9.4,8.6V55.1L202.3,55.1z" />
					<path fill="#1B1B1F" stroke="#1B1B1F" stroke-width="0.11" d="M194.5,70c0,2.6-3.7,2.7-3.7,0V28 c0-2.7,3.7-2.6,3.7,0V70" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M218.4,78.3V28.2c0-2.6-3.5-2.7-3.5,0 v50.1h-8.7V20h8.7v3.8c2.3-6.1,11.4-5.9,11.4,4.8v49.6L218.4,78.3L218.4,78.3z" />
					<path fill="#FFFFFF" stroke="#1B1B1F" stroke-width="1.093" d="M61.7,10.1h8.2v7.3h-8.2V10.1z M61.7,20 h8v58.3h-8V20z" />
					</svg>
			</a>
		</div>
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
