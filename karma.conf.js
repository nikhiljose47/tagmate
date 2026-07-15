module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/tagmate'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'lcovonly' }],
      check: {
        global: {
          // Baseline recorded in 0.1.0. Raise these in small increments until
          // the roadmap targets (70/70/70/60) are reached.
          statements: 27,
          lines: 30,
          functions: 15,
          branches: 10,
        },
      },
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoGpu'],
    customLaunchers: {
      ChromeHeadlessNoGpu: {
        base: 'ChromeHeadless',
        flags: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--no-sandbox',
        ],
      },
    },
    restartOnFileChange: true,
  });
};
