'use strict';


module.exports = function browserify(grunt) {
	// Load task
	grunt.loadNpmTasks('grunt-browserify');

	// Options
	return {
		build: {
			files: {
		    // This is run after uglify, so they're already in the target dir.
		    '.build/js/app.js': ['.build/js/app.js'],
		    '.build/js/sell/sell_bundle.js': ['.build/js/sell/sell_bundle.js']
            },
			options: {}
		}
	};
};
