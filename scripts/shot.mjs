#!/usr/bin/env node
// Screenshots a page of the running dev server in headless Chrome, at a width a
// desktop window cannot be shrunk to, and fails when the page scrolls sideways.
//
//   node scripts/shot.mjs /about/ --width 375 --dark
//   node scripts/shot.mjs / --t 2.6        the wallpaper as it is 2.6 s in
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const BASE = 'http://localhost:4321/blog';

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		width: { type: 'string', default: '375' },
		height: { type: 'string', default: '800' },
		dark: { type: 'boolean', default: false },
		t: { type: 'string' },
		out: { type: 'string' },
	},
});
const path = positionals[0] ?? '/';
const [width, height] = [Number(values.width), Number(values.height)];
const theme = values.dark ? 'dark' : 'light';
const url = BASE + path + (values.t ? `${path.includes('?') ? '&' : '?'}t=${values.t}` : '');
const out = values.out ?? join(tmpdir(), `shot-${width}-${theme}.png`);

const profile = mkdtempSync(join(tmpdir(), 'shot-profile-'));
const chrome = spawn(
	process.env.CHROME ?? 'google-chrome',
	['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'],
	{ stdio: ['ignore', 'ignore', 'pipe'] },
);
const close = () => {
	chrome.kill();
	rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
};

try {
	// Chrome picks the port and says which on stderr.
	const port = await new Promise((resolve, reject) => {
		let log = '';
		chrome.stderr.on('data', (chunk) => {
			log += chunk;
			const found = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
			if (found) resolve(found[1]);
		});
		chrome.on('exit', () => reject(new Error(`Chrome exited before it listened:\n${log}`)));
	});
	const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
	const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
	await new Promise((resolve) => socket.addEventListener('open', resolve));

	let sent = 0;
	const replies = new Map();
	const events = new Map();
	socket.addEventListener('message', ({ data }) => {
		const message = JSON.parse(data);
		if (message.id) replies.get(message.id)?.(message);
		else events.get(message.method)?.(message.params);
	});
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++sent;
			replies.set(id, ({ result, error }) => (error ? reject(new Error(`${method}: ${error.message}`)) : resolve(result)));
			socket.send(JSON.stringify({ id, method, params }));
		});
	const once = (method) => new Promise((resolve) => events.set(method, resolve));

	await send('Page.enable');
	await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
	await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
	const loaded = once('Page.loadEventFired');
	const { errorText } = await send('Page.navigate', { url });
	if (errorText) throw new Error(`${url}: ${errorText}. Is the dev server running?`);
	await loaded;
	// Web fonts and the wallpaper's first frames arrive after the load event.
	await new Promise((resolve) => setTimeout(resolve, 1500));

	const { result } = await send('Runtime.evaluate', {
		expression: 'JSON.stringify({ page: document.documentElement.scrollWidth, window: innerWidth })',
		returnByValue: true,
	});
	const measured = JSON.parse(result.value);
	const { data } = await send('Page.captureScreenshot', { format: 'png' });
	writeFileSync(out, Buffer.from(data, 'base64'));

	console.log(`${out}  ${url}  ${width}x${height} ${theme}`);
	if (measured.page > measured.window) {
		console.error(`The page scrolls sideways: it is ${measured.page}px wide in a ${measured.window}px window.`);
		process.exitCode = 1;
	}
} finally {
	close();
}
