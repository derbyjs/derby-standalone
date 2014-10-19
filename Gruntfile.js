module.exports = function (grunt) {

  // load all npm grunt tasks
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    derby_views: {
      default: {
        options:{
          cwd: 'example'
        },
        files: {
          'views.js': ['views/templates.html']
        }
      }
    },
    watch: {
      css: {
        files: 'example/views/templates.html',
        tasks: ['derby_views'],
        options: {
          livereload: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-derby-views');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['derby_views', 'watch']);

};
