import { terrain } from './terrain.ts';
import { threeBody } from './threeBody.ts';

export const WALLPAPERS = { terrain, threeBody };

export type WallpaperName = keyof typeof WALLPAPERS;
