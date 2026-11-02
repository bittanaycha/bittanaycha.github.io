<script lang="ts">
	import { onMount } from 'svelte';

	let ship = $state<HTMLDivElement>();
	let docked: Element | null = null;
	let sailing = $state(false);
	let at = { x: 0, y: 0 };

	const DOCK_X = -26;
	const DOCK_Y = -24;

	function moveTo(x: number, y: number) {
		at = { x, y };
		ship?.style.setProperty('--x', `${Math.round(x)}px`);
		ship?.style.setProperty('--y', `${Math.round(y)}px`);
	}

	/** Three fading pixels behind the hull, on the water it just left. */
	function wake() {
		for (let i = 0; i < 3; i += 1) {
			const dot = document.createElement('span');
			dot.className = 'wake';
			dot.style.left = `${Math.round(at.x + 6 + i * 9)}px`;
			dot.style.top = `${Math.round(at.y + 22 + (i % 2) * 3)}px`;
			dot.style.animationDelay = `${i * 90}ms`;
			document.body.appendChild(dot);
			setTimeout(() => dot.remove(), 1500);
		}
	}

	/** Sail to the island's top-right corner and bob there. */
	function sailTo(island: Element) {
		if (!ship || island === docked) return;
		docked = island;
		wake();
		const box = island.getBoundingClientRect();
		moveTo(box.right + DOCK_X, box.top + DOCK_Y);
		sailing = false;
		requestAnimationFrame(() => (sailing = true));
	}

	onMount(() => {
		const first = document.querySelector('.island');
		if (first && ship) {
			const box = first.getBoundingClientRect();
			moveTo(box.right + DOCK_X, box.top + DOCK_Y);
		}

		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		/* Moored: the hull tacks a little against the current instead of
		   sitting frozen at the corner. */
		const tack = still
			? 0
			: window.setInterval(() => {
					if (!docked) return;
					const box = docked.getBoundingClientRect();
					const dx = Math.round((Math.random() - 0.5) * 22);
					const dy = Math.round((Math.random() - 0.5) * 6);
					moveTo(box.right + DOCK_X + dx, box.top + DOCK_Y + Math.max(dy, -3));
				}, 2800);

		const over = (event: PointerEvent) => {
			const target = event.target as Element | null;
			const island = target?.closest('.island');
			if (island) sailTo(island);
		};

		let frame = 0;
		const follow = () => {
			if (!docked) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => docked && sailTo(docked));
		};

		document.addEventListener('pointerover', over, { passive: true });
		window.addEventListener('scroll', follow, { passive: true });
		window.addEventListener('resize', follow);

		return () => {
			document.removeEventListener('pointerover', over);
			window.removeEventListener('scroll', follow);
			window.removeEventListener('resize', follow);
			cancelAnimationFrame(frame);
			window.clearInterval(tack);
		};
	});
</script>

<div class="ship" class:sailing bind:this={ship} aria-hidden="true">
	<span class="bob">
		<svg viewBox="0 0 18 13" width="38" height="28" shape-rendering="crispEdges">
			<!-- pennant and mast -->
			<rect x="11" y="1" width="3" height="1" fill="var(--ink)" />
			<rect x="10" y="1" width="1" height="9" fill="#8fa3ff" />
			<!-- sail -->
			<rect x="10" y="2" width="1" height="1" fill="var(--ink)" />
			<rect x="9" y="3" width="3" height="1" fill="var(--ink)" />
			<rect x="8" y="4" width="5" height="1" fill="var(--ink)" />
			<rect x="7" y="5" width="7" height="1" fill="var(--ink)" />
			<rect x="6" y="6" width="9" height="1" fill="var(--ink)" />
			<!-- hull -->
			<rect x="3" y="10" width="12" height="1" fill="var(--accent)" />
			<rect x="2" y="11" width="14" height="1" fill="var(--accent)" />
			<rect x="4" y="12" width="10" height="1" fill="var(--accent-deep)" />
			<rect x="15" y="9" width="2" height="1" fill="var(--ink)" />
		</svg>
	</span>
</div>

<style>
	.ship {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 40;
		pointer-events: none;
		transform: translate3d(var(--x, 82vw), var(--y, 78vh), 0);
		transition: transform 900ms cubic-bezier(0.45, 0.05, 0.35, 1);
		will-change: transform;
	}

	.bob {
		display: block;
		animation: bob 2.6s ease-in-out infinite;
	}

	svg {
		display: block;
		filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.45));
	}

	.ship.sailing .bob {
		animation:
			bob 2.6s ease-in-out infinite,
			lean 900ms ease-in-out;
	}

	@keyframes bob {
		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}
		50% {
			transform: translateY(-3px) rotate(2deg);
		}
	}

	@keyframes lean {
		0% {
			transform: rotate(0);
		}
		30% {
			transform: rotate(-8deg);
		}
		100% {
			transform: rotate(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ship {
			transition: none;
		}
		.bob {
			animation: none;
		}
	}
</style>
