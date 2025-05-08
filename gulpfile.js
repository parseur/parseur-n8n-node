const path = require('path');
const { task, src, dest, parallel } = require('gulp');
const fs = require('fs');

function getNodeDirs() {
	const nodesPath = path.resolve('dist', 'nodes');
	if (!fs.existsSync(nodesPath)) return [];

	return fs
		.readdirSync(nodesPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => path.join(nodesPath, dirent.name));
}

function copyIconsToAllNodes(done) {
	const source = path.resolve('icons', '*.{png,svg}');
	const nodeDirs = getNodeDirs();

	if (nodeDirs.length === 0) {
		console.warn('No node directories found in dist/nodes');
		return done();
	}

	const copyTasks = nodeDirs.map((nodeDir) => {
		return function copyToDir() {
			return src(source).pipe(dest(nodeDir));
		};
	});

	return parallel(...copyTasks)(done);
}

function copyIconsToCredentials() {
	const source = path.resolve('icons', '*.{png,svg}');
	const destination = path.resolve('dist', 'credentials');
	return src(source).pipe(dest(destination));
}

task('build:icons', parallel(copyIconsToAllNodes, copyIconsToCredentials));