import { describe, expect, it } from 'vitest';
import { routesFor } from './routes.ts';

describe('routesFor', () => {
	it('puts the base in front of every URL', () => {
		const routes = routesFor('/blog');
		expect(routes.home).toBe('/blog/');
		expect(routes.posts).toBe('/blog/posts');
		expect(routes.post('coding-agent/git-checkpoints')).toBe('/blog/coding-agent/git-checkpoints/');
		expect(routes.series('coding-agent')).toBe('/blog/coding-agent/');
	});

	it('reads a base with a trailing slash the same way', () => {
		expect(routesFor('/blog/').post('a')).toBe(routesFor('/blog').post('a'));
	});

	it('serves from the root when the base is `/`', () => {
		const routes = routesFor('/');
		expect(routes.home).toBe('/');
		expect(routes.post('a')).toBe('/a/');
	});
});

describe('withoutBase', () => {
	const { withoutBase } = routesFor('/blog');

	it('removes a leading base', () => {
		expect(withoutBase('/blog/posts/')).toBe('/posts/');
		expect(withoutBase('/blog')).toBe('');
	});

	it('leaves a path that only starts with the same letters', () => {
		expect(withoutBase('/blogger/')).toBe('/blogger/');
	});

	it('leaves a base that appears further in', () => {
		expect(withoutBase('/posts/blog/')).toBe('/posts/blog/');
	});

	it('changes nothing under a root base', () => {
		expect(routesFor('/').withoutBase('/posts/')).toBe('/posts/');
	});
});
