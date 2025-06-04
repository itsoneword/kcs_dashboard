/// <reference types="node" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default ({ mode }: { mode: string }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return defineConfig({
		server: {
			host: env.HOST,
			port: Number(env.PORT),
		},
		plugins: [sveltekit()]
	});
};
