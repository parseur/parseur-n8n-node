import { config } from '@n8n/node-cli/eslint';

// We pin patched versions of transitive dev/peer dependencies (minimatch,
// lodash, uuid, file-type) via the "overrides" field in package.json to clear
// known CVEs in the build toolchain. n8n's default lint config forbids that
// field, so we disable the rule for package.json only.
export default [
	...config,
	{
		files: ['package.json'],
		rules: {
			'@n8n/community-nodes/no-overrides-field': 'off',
		},
	},
];
