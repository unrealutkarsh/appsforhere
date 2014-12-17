'use strict';
var fs = require('fs');

module.exports = function (grunt) {

    // Load the project's grunt tasks from a directory
    require('grunt-config-dir')(grunt, {
        configDir: require('path').resolve('tasks')
    });

    grunt.registerTask('native-deps', function () {
        var packageInfo = JSON.parse(fs.readFileSync('.heroku/package.json').toString());
        for (var pk in packageInfo.herokuDependencies) {
            packageInfo.dependencies[pk] = packageInfo.herokuDependencies[pk];
        }
        fs.writeFileSync('.heroku/package.json', JSON.stringify(packageInfo));
        delete packageInfo.herokuDependencies;
    });

    // Register group tasks
    grunt.registerTask('build', [ 'jshint', 'less', 'uglify:build', 'browserify:build', 'i18n', 'copyto:build' ]);
    grunt.registerTask('debug', [ 'jshint', 'less', 'uglify:debug', 'browserify:debug', 'i18n', 'copyto:build' ]);
    grunt.registerTask('test', [ 'jshint', 'mochacli' ]);
    grunt.registerTask('package', [ 'clean:package', 'build', 'copyto:package' ]);
    grunt.registerTask('heroku', [ 'clean:heroku', 'build', 'copyto:heroku', 'native-deps' ]);

};
