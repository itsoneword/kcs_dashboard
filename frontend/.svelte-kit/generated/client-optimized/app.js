import * as client_hooks from '../../../src/hooks.client.js';


export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13')
];

export const server_loads = [];

export const dictionary = {
		"/": [3],
		"/admin": [4],
		"/coach": [5],
		"/coach/evaluations/[id]": [6],
		"/dashboard": [7],
		"/debug": [8],
		"/evaluations": [9],
		"/evaluations/[id]": [10],
		"/lead": [11],
		"/login": [12,[],[2]],
		"/reports": [13]
	};

export const hooks = {
	handleError: client_hooks.handleError || (({ error }) => { console.error(error) }),
	init: client_hooks.init,
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';