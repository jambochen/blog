export interface Theme {
	ink: string;
	dark: boolean;
	// The family for small readouts drawn on the canvas.
	font: string;
	// Width of the centred column that holds the page's text, in px.
	textWidth: number;
}

export interface Scene {
	resize(width: number, height: number): void;
	// Draws one frame and reports whether another is needed; a scene at rest lets the loop stop.
	frame(context: CanvasRenderingContext2D, elapsed: number): boolean;
	move?(x: number, y: number): void;
}

export type SceneFactory = (theme: Theme) => Scene;
