'use strict';


module.exports = function clean(grunt) {
	// Load task
	grunt.loadNpmTasks('grunt-contrib-clean');

	// Options
	return {
	    tmp: 'tmp',
	    build: '.build/templates',
        package: ['.package/*','!.package/.git','!.package/process.json'],
        heroku: ['.heroku/*','!.heroku/.git','!.heroku/process.json','!.heroku/config/production.*']
	};
};
