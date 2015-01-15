'use strict';


module.exports = function mochacli(grunt) {
	// Load task
	grunt.loadNpmTasks('grunt-mocha-cli');

	// Options
	return {
        src: ['test/**/*.js'],
        options: {
            timeout: 6000,
            'check-leaks': true,
            // No idea where these come from, but not us.
            'globals': ['cptable','channel'],
            ui: 'bdd',
            reporter: 'spec'
        }
	};
};
