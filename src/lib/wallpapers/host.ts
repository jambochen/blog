import type { Scene, SceneFactory, View } from './scene.ts';

interface Options {
	// Builds the scene anew when the page changes theme, since a scene reads the palette when it is built.
	followTheme?: boolean;
}

// Runs a scene on a canvas that covers the window. Returns the scene first built; with
// `followTheme` a theme change puts another in its place.
export function mountScene<S extends Scene>(
	canvas: HTMLCanvasElement,
	factory: SceneFactory<S>,
	{ followTheme = false }: Options = {},
): S | undefined {
	const context = canvas.getContext('2d');
	if (!context) return undefined;

	const root = document.documentElement;
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let scene: S;
	let running = false;
	let last = 0;

	const frame = (now: number) => {
		// Capped, so a tab that comes back after a pause does not leap ahead.
		const elapsed = Math.min((now - last) / 1000, 0.05);
		last = now;
		scene.frame(context, elapsed);
		running = !still && !document.hidden;
		if (running) requestAnimationFrame(frame);
	};

	// The loop stops when the tab is hidden, and starts again from here.
	const wake = () => {
		if (running) return;
		running = true;
		last = performance.now();
		requestAnimationFrame(frame);
	};

	const view = (): View => {
		const style = getComputedStyle(root);
		const column = parseFloat(style.getPropertyValue('--column')) * parseFloat(style.fontSize);
		return {
			width: innerWidth,
			height: innerHeight,
			ratio: devicePixelRatio || 1,
			margin: (innerWidth - column) / 2,
		};
	};

	const resize = () => {
		const next = view();
		canvas.width = next.width * next.ratio;
		canvas.height = next.height * next.ratio;
		context.setTransform(next.ratio, 0, 0, next.ratio, 0, 0);
		scene.resize(next);
		wake();
	};

	const build = () => {
		const style = getComputedStyle(root);
		scene = factory(
			{
				ink: style.getPropertyValue('--ink').trim(),
				dark: root.dataset.theme === 'dark',
				font: `${style.getPropertyValue('--font-ui').trim()}, sans-serif`,
			},
			still,
		);
		if (scene.column) canvas.dataset.column = scene.column;
		else delete canvas.dataset.column;
		resize();
		return scene;
	};

	const first = build();
	addEventListener('resize', resize);
	document.addEventListener('visibilitychange', wake);
	if (followTheme) new MutationObserver(build).observe(root, { attributeFilter: ['data-theme'] });
	if (!still) {
		addEventListener(
			'pointermove',
			(event) => {
				scene.move?.(event.clientX, event.clientY);
				wake();
			},
			{ passive: true },
		);
	}
	return first;
}
