import type { SceneFactory } from './scene';

// The system lives in the bottom right corner, clear of the text. Its radius follows the side margin between these bounds, in px.
const MIN_RADIUS = 48;
const MAX_RADIUS = 150;
const EDGE_GAP = 28;
const STEP = 0.002;
// Simulated time per second of real time.
const PACE = 0.5;
// Keeps a close pass from flinging a body out at an unbounded speed.
const SOFTENING = 0.06;
const TRAIL_LENGTH = 900;
// A body this many units out has left the corner; the system starts again from new positions.
// The bodies start about one unit from the centre, and the corner's radius is two units.
const ESCAPE = 2.6;
const FADE_BANDS = 12;

interface Body {
	x: number;
	y: number;
	vx: number;
	vy: number;
	trail: [number, number][];
}

// The Three-Body Problem: three equal masses under gravity, whose paths never repeat.
export const threeBody: SceneFactory = (theme) => {
	let bodies: Body[] = [];
	let width = 0;
	let height = 0;

	const reset = () => {
		const turn = Math.random() * Math.PI * 2;
		bodies = [0, 1, 2].map((index) => {
			const angle = turn + (index / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
			const radius = 0.7 + Math.random() * 0.6;
			const speed = 0.45 + Math.random() * 0.25;
			return {
				x: radius * Math.cos(angle),
				y: radius * Math.sin(angle),
				vx: -speed * Math.sin(angle),
				vy: speed * Math.cos(angle),
				trail: [],
			};
		});
		// Without this the whole system would drift off the page.
		for (const key of ['x', 'y', 'vx', 'vy'] as const) {
			const mean = bodies.reduce((sum, body) => sum + body[key], 0) / bodies.length;
			for (const body of bodies) body[key] -= mean;
		}
	};

	const accelerate = (step: number) => {
		for (const body of bodies) {
			for (const other of bodies) {
				if (other === body) continue;
				const [dx, dy] = [other.x - body.x, other.y - body.y];
				const pull = step / (dx * dx + dy * dy + SOFTENING * SOFTENING) ** 1.5;
				body.vx += dx * pull;
				body.vy += dy * pull;
			}
		}
	};

	return {
		resize(nextWidth, nextHeight) {
			[width, height] = [nextWidth, nextHeight];
			if (bodies.length === 0) reset();
		},
		frame(context, elapsed) {
			for (let time = 0; time < elapsed * PACE; time += STEP) {
				// Leapfrog: half a kick, a full drift, half a kick. It keeps the energy steady over long runs.
				accelerate(STEP / 2);
				for (const body of bodies) {
					body.x += body.vx * STEP;
					body.y += body.vy * STEP;
				}
				accelerate(STEP / 2);
			}
			if (bodies.some((body) => Math.hypot(body.x, body.y) > ESCAPE)) reset();

			const margin = (width - theme.textWidth) / 2;
			const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, margin / 2 - EDGE_GAP / 2));
			const unit = radius / 2;
			const [centreX, centreY] = [width - EDGE_GAP - radius, height - EDGE_GAP - radius];
			const place = (x: number, y: number): [number, number] => [centreX + x * unit, centreY + y * unit];

			context.clearRect(0, 0, width, height);
			context.strokeStyle = context.fillStyle = theme.ink;
			context.lineWidth = 1;
			for (const body of bodies) {
				body.trail.push([body.x, body.y]);
				if (body.trail.length > TRAIL_LENGTH) body.trail.shift();

				// Stroked in bands of equal opacity: one stroke per segment would be several thousand a frame.
				const band = Math.ceil(body.trail.length / FADE_BANDS);
				for (let start = 0; start < body.trail.length - 1; start += band) {
					context.globalAlpha = ((start + band) / body.trail.length) * 0.3;
					context.beginPath();
					body.trail.slice(start, start + band + 1).forEach(([x, y], index) => {
						if (index === 0) context.moveTo(...place(x, y));
						else context.lineTo(...place(x, y));
					});
					context.stroke();
				}
				context.globalAlpha = 0.55;
				context.beginPath();
				context.arc(...place(body.x, body.y), 2.5, 0, Math.PI * 2);
				context.fill();
			}
			context.globalAlpha = 1;
			return true;
		},
	};
};
