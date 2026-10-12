// The colours and face of the page's theme, for a scene that draws in them.
export interface Palette {
	ink: string;
	dark: boolean;
	// The family for small readouts drawn on the canvas.
	font: string;
}

// All in CSS px; the host has already scaled the context by `ratio`.
export interface View {
	width: number;
	height: number;
	ratio: number;
	// From an edge of the window to the centred column that holds the page's text.
	// Negative where the window is narrower than the column.
	margin: number;
}

export interface Scene {
	// What becomes of the scene behind the column of text. Absent leaves it whole.
	column?: 'dimmed' | 'hidden';
	resize(view: View): void;
	frame(context: CanvasRenderingContext2D, elapsed: number): void;
	move?(x: number, y: number): void;
}

// `still` is true for a reader who asked for reduced motion: one frame is drawn and no pointer is followed.
export type SceneFactory<S extends Scene = Scene> = (palette: Palette, still: boolean) => S;
