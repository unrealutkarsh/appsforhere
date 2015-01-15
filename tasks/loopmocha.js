'use strict';

var nconf = require('nconf');

module.exports = function loopmocha(grunt) {
  nconf.env()
    .argv();
  // Load task
  grunt.loadNpmTasks('grunt-loop-mocha');
  // Options
  return {
    "src": ["<%=loopmocha.basedir%>/spec/*.js"],
    "basedir": process.cwd() + "/" + "functional",
    "options": {
      "mocha": {
        "reportLocation": grunt.option("reportLocation") || "<%=loopmocha.basedir%>/report",
        "timeout": grunt.option("timeout") || 600000,
        "grep": grunt.option("grep") || 0,
        "debug": grunt.option("debug") || 0,
        "reporter": grunt.option("reporter") || "spec"
      },
      "nemoData": {
        "autoBaseDir": "<%=loopmocha.basedir%>"
        ,"targetBrowser": nconf.get("TARGET_BROWSER") || "phantomjs"
        
        
        ,"targetBaseUrl": "http://localhost:1337"
        
      },
      "iterations": [{
        "description": "default"
      }]
    },
    "local": {
      "src": "<%=loopmocha.src%>"
    }
  };
};
