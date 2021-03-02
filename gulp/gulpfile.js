const gulp = require('gulp')
const less = require('gulp-less')
const cleanCSS = require('gulp-clean-css')
const cached = require('gulp-cached')
const changed = require('gulp-changed')
const replace = require('gulp-replace')
const gzip = require('gulp-gzip')
const argv = require('yargs').argv

let dir = argv.dir || 'dev'

const gzipOption = {
  threshold: '2kb',
  gzipOptions: {
    level: 9
  }
}

gulp.task('build', () => {
  gulp.src(['page/**/*', '!page/develop'])
    .pipe(replace(/js\/vendor\/(echarts|vue|vue\.runtime)\.js/g, 'js/vendor/$1.min.js'))
    .pipe(replace(/<!--(<link.*css">)-->/g, '$1'))
    .pipe(replace(/<!--(<script.*js"><\/script>)-->/g, '$1'))
    .pipe(changed(`../bss_fe_${dir}/html`, {
      hasChanged: changed.compareContents
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/html`))
    .pipe(gzip({
      deleteMode: `../bss_fe_${dir}/html`,
      ...gzipOption
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/html`))

  //js
  gulp.src([
    'src/js/standalone/*.js',
    'public/js/*.js',
    'public/js/*.json',
    'public/js/@(vendor)/*.js',
    '!public/js/components-doc.bundle.js'
  ])
    .pipe(changed(`../bss_fe_${dir}/public/js`, {
      hasChanged: changed.compareContents
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/js`))
    .pipe(gzip({
      deleteMode: `../bss_fe_${dir}/public/js`,
      ...gzipOption
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/js`))

  //sourceMap
  gulp.src(['public/js/*.js.map'])
    .pipe(changed(`../bss_fe_${dir}/public/js`, {
      hasChanged: changed.compareContents
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/js`))

  //css
  gulp.src(['public/css/**/*'])
    .pipe(changed(`../bss_fe_${dir}/public/css`, {
      hasChanged: changed.compareContents
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/css`))
    .pipe(gzip({
      deleteMode: `../bss_fe_${dir}/public/css`,
      ...gzipOption
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/css`))

  //image
  gulp.src('public/img/*.svg')
    .pipe(changed(`../bss_fe_${dir}/public/img`))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/img`))
    .pipe(gzip({
      deleteMode: `../bss_fe_${dir}/public/img`,
      ...gzipOption
    }))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/img`))

  gulp.src(['public/img/*/*.*', '!public/img/*.svg'])
    .pipe(changed(`../bss_fe_${dir}/public/img`))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/img`))

  //audio
  gulp.src('public/audio/*.*')
    .pipe(changed(`../bss_fe_${dir}/public/audio`))
    .pipe(gulp.dest(`../bss_fe_${dir}/public/audio`))
})

gulp.task('less', () => {
  let sources
  if (argv.custom) {
    sources = [
      'src/less/global.less'
    ]
    argv.custom.split(',').forEach(c => sources.push(`src/less/${c}.less`))
  } else {
    sources = 'src/less/*.less'
  }

  gulp.src(sources)
    .pipe(less({
      strictMath: 'on'
    }))
    .pipe(cached('less'))
    .pipe(cleanCSS())
    .pipe(gulp.dest('public/css'))
})

gulp.task('watch', ['less'], () => {
  gulp.watch('src/less/**/*', ['less'])
})

gulp.task('default', () => gulp.start('watch'))
