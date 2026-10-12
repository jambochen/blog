import type { SceneFactory } from './scene.ts';
import { advance, type Body, exchange, spawn } from './threeBodySystem.ts';

// The system lives in the bottom right corner, clear of the text. Its radius follows the side margin between these bounds, in px.
const MIN_RADIUS = 48;
const MAX_RADIUS = 150;
const EDGE_GAP = 28;
// Simulated time per second of real time.
const PACE = 0.5;
const TRAIL_LENGTH = 900;
const FADE_BANDS = 12;

// The Three-Body Problem: three equal masses under gravity, whose paths never repeat.
export const threeBody: SceneFactory = (palette) => {
	let system = spawn(Math.random);
	// A body thrown in is a new object, so it starts with no trail.
	const trails = new WeakMap<Body, [number, number][]>();
	let width = 0;
	let height = 0;
	let margin = 0;

	return {
		// Sits in a corner beside long text; where the screen leaves no margin, the scene is not seen at all.
		column: 'hidden',
		resize(view) {
			({ width, height, margin } = view);
		},
		frame(context, elapsed) {
			advance(system, elapsed * PACE);
			system = exchange(system, elapsed, Math.random);

			const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, margin / 2 - EDGE_GAP / 2));
			const unit = radius / 2;
			const [centreX, centreY] = [width - EDGE_GAP - radius, height - EDGE_GAP - radius];
			const place = (x: number, y: number): [number, number] => [
				centreX + (x - system.centre[0]) * unit,
				centreY + (y - system.centre[1]) * unit,
			];

			context.clearRect(0, 0, width, height);
			context.strokeStyle = context.fillStyle = palette.ink;
			context.lineWidth = 1;
			for (const body of system.bodies) {
				const trail = trails.get(body) ?? [];
				trails.set(body, trail);
				trail.push([body.x, body.y]);
				if (trail.length > TRAIL_LENGTH) trail.shift();

				// Stroked in bands of equal opacity: one stroke per segment would be several thousand a frame.
				const band = Math.ceil(trail.length / FADE_BANDS);
				for (let start = 0; start < trail.length - 1; start += band) {
					context.globalAlpha = ((start + band) / trail.length) * 0.3 * body.opacity;
					context.beginPath();
					trail.slice(start, start + band + 1).forEach(([x, y], index) => {
						if (index === 0) context.moveTo(...place(x, y));
						else context.lineTo(...place(x, y));
					});
					context.stroke();
				}
				context.globalAlpha = 0.55 * body.opacity;
				context.beginPath();
				context.arc(...place(body.x, body.y), 2.5, 0, Math.PI * 2);
				context.fill();
			}
			context.globalAlpha = 1;
		},
	};
};
