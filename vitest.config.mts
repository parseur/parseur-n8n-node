import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// n8n-workflow's ESM build uses extensionless relative imports that Node cannot
		// resolve natively. Point both the nodes' source and the tests at the CJS build so
		// there is a single copy of NodeApiError/NodeOperationError (instanceof works).
		alias: {
			'n8n-workflow': 'n8n-workflow/dist/cjs/index.js',
		},
	},
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		globals: false,
		clearMocks: true,
		coverage: {
			provider: 'v8',
			include: ['nodes/**/*.ts', 'credentials/**/*.ts'],
			reporter: ['text', 'lcov'],
		},
	},
});
