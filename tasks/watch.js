'use strict';

/**
 * The watch target is useful when you're building something OUTSIDE of kraken,
 * since the kraken dev tools already do this when requests come in.
 * But I have a project which reuses the client side Javascript via node-webkit,
 * and this target helps keep them up to date outside a running kraken server.
 **/
module.exports = function watch(grunt) {
    // Load task
    grunt.loadNpmTasks('grunt-contrib-watch');

    // Options
    return {
        build: {
            files: ['public/js/**/*.js','public/templates/**/*.dust'],
            tasks: ['i18n', 'uglify:debug', 'browserify:debug', 'copyto:build']
        }
    };
};
