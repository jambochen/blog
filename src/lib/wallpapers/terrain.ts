import type { SceneFactory } from './scene.ts';
import { type Contour, contourOf, elevationOf, HIGH, LAND, type Point, surveyRoutes } from './terrainMap.ts';

// The side of one marching-squares cell, in px.
const CELL = 10;
// One pass of the scan line, and the wait before the next, in seconds.
const SWEEP = 9;
const REST = 5;
// How far the afterglow trails behind the scan line, and in how many steps it fades.
const TRAIL = 260;
const TRAIL_STEPS = 13;
const RETICLE_GRID = 24;
const RETICLE_REST = 2.5;

// Drawn like Arknights: Endfield's map: flat landmasses with hatched high ground, outlined, with dashed routes between survey points.
export const terrain: SceneFactory = (palette) => {
	const accent = palette.dark ? '255, 226, 60' : '214, 150, 0';
	const elevation = elevationOf(Math.random() * 1000);
	// Canvases of their own, so a frame costs two blits and the contours are traced only when the window changes.
	const base = document.createElement('canvas');
	const glow = document.createElement('canvas');
	let width = 0;
	let height = 0;
	let ratio = 1;
	let margin = 0;
	let clock = 0;
	// `at` is the clock's reading when the pointer last moved.
	let pointer: { x: number; y: number; at: number } | undefined;

	const paths = ({ areas, edges }: Contour) => {
		const area = new Path2D();
		const outline = new Path2D();
		for (const polygon of areas) {
			polygon.forEach(([x, y], index) => (index === 0 ? area.moveTo(x, y) : area.lineTo(x, y)));
			area.closePath();
		}
		for (const [from, to] of edges) {
			outline.moveTo(...from);
			outline.lineTo(...to);
		}
		return { area, outline };
	};

	const diamond = (context: CanvasRenderingContext2D, [x, y]: Point, size: number) => {
		context.beginPath();
		context.moveTo(x, y - size);
		context.lineTo(x + size, y);
		context.lineTo(x, y + size);
		context.lineTo(x - size, y);
		context.closePath();
	};

	const render = () => {
		// Sampled one cell beyond each edge, so outlines run off the canvas.
		const columns = Math.ceil(width / CELL) + 3;
		const rows = Math.ceil(height / CELL) + 3;
		const heights = new Float32Array(columns * rows);
		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < columns; column++) {
				heights[row * columns + column] = elevation((column - 1) * CELL, (row - 1) * CELL);
			}
		}
		const field = { heights, columns, rows };
		const land = paths(contourOf(field, LAND, CELL, [-CELL, -CELL]));
		const high = paths(contourOf(field, HIGH, CELL, [-CELL, -CELL]));
		const routes = surveyRoutes({ width, height, margin }, elevation, Math.random);
		const points = routes.flat();

		for (const canvas of [base, glow]) {
			canvas.width = width * ratio;
			canvas.height = height * ratio;
		}
		// The `!` is safe: a 2D context is only refused when the canvas already has another kind, and these two are new.
		const paper = base.getContext('2d')!;
		paper.setTransform(ratio, 0, 0, ratio, 0, 0);
		paper.fillStyle = paper.strokeStyle = palette.ink;
		paper.lineWidth = 1;

		paper.globalAlpha = 0.035;
		paper.fill(land.area);

		paper.save();
		paper.clip(high.area);
		paper.globalAlpha = 0.1;
		paper.beginPath();
		for (let offset = -height; offset < width; offset += 7) {
			paper.moveTo(offset, 0);
			paper.lineTo(offset + height, height);
		}
		paper.stroke();
		paper.restore();

		paper.globalAlpha = 0.2;
		paper.stroke(land.outline);
		paper.globalAlpha = 0.13;
		paper.stroke(high.outline);

		paper.globalAlpha = 0.28;
		paper.setLineDash([3, 6]);
		paper.beginPath();
		for (const route of routes) {
			route.forEach(([x, y], index) => (index === 0 ? paper.moveTo(x, y) : paper.lineTo(x, y)));
		}
		paper.stroke();
		paper.setLineDash([]);

		paper.font = `500 10px ${palette.font}`;
		points.forEach((point, index) => {
			paper.globalAlpha = 0.45;
			diamond(paper, point, 5);
			paper.stroke();
			paper.globalAlpha = 0.4;
			const metres = Math.round(elevation(...point) * 1000);
			paper.fillText(`PT-${String(index + 1).padStart(2, '0')}  ${metres} m`, point[0] + 10, point[1] + 3.5);
		});

		// The `!` is safe for the same reason as above.
		const light = glow.getContext('2d')!;
		light.setTransform(ratio, 0, 0, ratio, 0, 0);
		light.strokeStyle = light.fillStyle = `rgb(${accent})`;
		light.lineWidth = 1.4;
		light.stroke(land.outline);
		light.globalAlpha = 0.6;
		light.stroke(high.outline);
		light.globalAlpha = 1;
		for (const point of points) {
			diamond(light, point, 5);
			light.fill();
		}
	};

	return {
		// Dimmed behind the text, so headings stay easy to read.
		column: 'dimmed',
		resize(view) {
			({ width, height, ratio, margin } = view);
			render();
		},
		frame(context, elapsed) {
			clock += elapsed;
			context.clearRect(0, 0, width, height);
			context.drawImage(base, 0, 0, width, height);

			const phase = clock % (SWEEP + REST);
			if (phase < SWEEP) {
				const scan = (phase / SWEEP) * (width + TRAIL);
				const step = TRAIL / TRAIL_STEPS;
				for (let index = 0; index < TRAIL_STEPS; index++) {
					const left = scan - (index + 1) * step;
					if (left + step < 0 || left > width) continue;
					context.globalAlpha = (1 - index / TRAIL_STEPS) ** 2 * 0.85;
					context.drawImage(glow, left * ratio, 0, step * ratio, height * ratio, left, 0, step, height);
				}
				context.globalAlpha = 1;
				if (scan < width) {
					context.fillStyle = `rgba(${accent}, 0.45)`;
					context.fillRect(scan, 0, 1, height);
				}
			}

			const idle = pointer ? clock - pointer.at : Infinity;
			if (pointer && idle < RETICLE_REST) {
				const x = Math.floor(pointer.x / RETICLE_GRID) * RETICLE_GRID;
				const y = Math.floor(pointer.y / RETICLE_GRID) * RETICLE_GRID;
				const [size, arm] = [RETICLE_GRID * 2, 6];
				// Fades over the last part of the rest, so the box does not blink out.
				context.globalAlpha = Math.min(1, (RETICLE_REST - idle) / 0.6) * 0.5;
				context.strokeStyle = context.fillStyle = palette.ink;
				context.lineWidth = 1;
				context.beginPath();
				for (const [cx, cy, dx, dy] of [
					[x, y, 1, 1],
					[x + size, y, -1, 1],
					[x + size, y + size, -1, -1],
					[x, y + size, 1, -1],
				] as const) {
					context.moveTo(cx + dx * arm, cy);
					context.lineTo(cx, cy);
					context.lineTo(cx, cy + dy * arm);
				}
				context.stroke();
				context.font = `500 10px ${palette.font}`;
				const cell = (value: number) => String(value / RETICLE_GRID).padStart(3, '0');
				context.fillText(`${cell(x)}  ${cell(y)}`, x, y + size + 13);
				context.globalAlpha = 1;
			}
		},
		move(x, y) {
			pointer = { x, y, at: clock };
		},
	};
};
