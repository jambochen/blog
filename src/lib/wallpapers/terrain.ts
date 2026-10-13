import type { SceneFactory } from './scene.ts';
import { contourLabels, contourOf, elevationOf, INDEX_EVERY, INTERVAL, LAND, type Point, surveyRoutes } from './terrainMap.ts';

// The side of one marching-squares cell, in px.
const CELL = 8;
// One pass of the scan line, and the wait before the next, in seconds.
const SWEEP = 9;
const REST = 5;
// How far the afterglow trails behind the scan line, and in how many steps it fades.
const TRAIL = 260;
const TRAIL_STEPS = 13;

// Drawn like a topographic sheet: a contour line at every interval of height, each fifth one heavier and numbered,
// the sea left blank, and dashed routes between survey points.
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

	const outline = (edges: [Point, Point][]) => {
		const path = new Path2D();
		for (const [from, to] of edges) {
			path.moveTo(...from);
			path.lineTo(...to);
		}
		return path;
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
		const summit = heights.reduce((highest, height) => Math.max(highest, height), 0);
		const coast = outline(contourOf(field, LAND, CELL, [-CELL, -CELL]).edges);
		const plain = new Path2D();
		const index = new Path2D();
		const indexLines: { level: number; edges: [Point, Point][] }[] = [];
		for (let step = 1; step * INTERVAL < summit; step++) {
			const level = step * INTERVAL;
			const { edges } = contourOf(field, level, CELL, [-CELL, -CELL]);
			if (step % INDEX_EVERY === 0) {
				index.addPath(outline(edges));
				indexLines.push({ level, edges });
			} else plain.addPath(outline(edges));
		}
		const routes = surveyRoutes({ width, height, margin }, elevation, Math.random);
		const points = routes.flat();
		const labels = contourLabels(indexLines, { width, height, margin }, points);

		for (const canvas of [base, glow]) {
			canvas.width = width * ratio;
			canvas.height = height * ratio;
		}
		// The `!` is safe: a 2D context is only refused when the canvas already has another kind, and these two are new.
		const paper = base.getContext('2d')!;
		paper.setTransform(ratio, 0, 0, ratio, 0, 0);
		paper.fillStyle = paper.strokeStyle = palette.ink;
		paper.font = `500 10px ${palette.font}`;

		paper.lineWidth = 1;
		paper.globalAlpha = 0.14;
		paper.stroke(plain);
		paper.globalAlpha = 0.3;
		paper.lineWidth = 1.3;
		paper.stroke(index);
		paper.globalAlpha = 0.42;
		paper.lineWidth = 1.6;
		paper.stroke(coast);
		paper.lineWidth = 1;

		paper.textAlign = 'center';
		paper.textBaseline = 'middle';
		for (const { at, angle, level } of labels) {
			const text = String(Math.round(level * 1000));
			paper.save();
			paper.translate(...at);
			paper.rotate(angle);
			// The line is broken under its number, as on a printed sheet.
			paper.globalCompositeOperation = 'destination-out';
			paper.globalAlpha = 1;
			const gap = paper.measureText(text).width + 8;
			paper.fillRect(-gap / 2, -6, gap, 12);
			paper.globalCompositeOperation = 'source-over';
			paper.globalAlpha = 0.5;
			paper.fillText(text, 0, 0.5);
			paper.restore();
		}
		paper.textAlign = 'start';
		paper.textBaseline = 'alphabetic';

		paper.globalAlpha = 0.28;
		paper.setLineDash([3, 6]);
		paper.beginPath();
		for (const route of routes) {
			route.forEach(([x, y], index) => (index === 0 ? paper.moveTo(x, y) : paper.lineTo(x, y)));
		}
		paper.stroke();
		paper.setLineDash([]);

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
		light.stroke(coast);
		light.stroke(index);
		light.globalAlpha = 0.45;
		light.lineWidth = 1;
		light.stroke(plain);
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
		},
	};
};
