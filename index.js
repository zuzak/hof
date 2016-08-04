'use strict';

const _ = require('lodash');
const path = require('path');
const http = require('http');
const https = require('https');
const hof = require('hof');
const express = require('express');
const churchill = require('churchill');
const router = require('./lib/router');
const serveStatic = require('./lib/serve-static');
const sessionStore = require('./lib/sessions');
const settings = require('./lib/settings');
const defaults = require('./lib/defaults');
const logger = require('./lib/logger');
const cookieParser = require('cookie-parser');

const middleware = hof.middleware;
const i18nFuture = hof.i18n;

module.exports = class App {
  constructor(options) {
    this.validateOptions(options);
    this.options = Object.assign({}, defaults, options);

    this._started = false;
    this._app = express();
    this.initTranslations();
    this.applyMiddleware();
    this.addLogger();
  }

  initTranslations() {
    this.i18n = i18nFuture({
      path: path.resolve(this.options.caller, this.options.translations) + '/__lng__/__ns__.json'
    });
    this.i18n.on('ready', () => this.applyI18nDependentMiddleware());
  }

  addLogger() {
    if (this.options.env !== 'test' && this.options.env !== 'ci') {
      this.options.logger = logger(this.options);
      this.use(churchill(this.options.logger));
    }
  }

  validateOptions(options) {
    if (!options || !options.routes || !options.routes.length) {
      throw new Error('Must be called with a list of routes')
    }

    options.routes.forEach(route => {
      if (!route.steps) {
        throw new Error('Each route must define a set of one or more steps');
      }
    })
  }

  initRedis() {
    this.redisClient = sessionStore(this._app, this.options);
  }

  applyMiddleware() {
    this.initRedis();
    this.parseCookies();
    serveStatic(this._app, this.options);
    settings(this._app, this.options);
    this.use(middleware.cookies());
  }

  parseCookies() {
    this._app.use(cookieParser(this.options.session.secret, {
      path: '/',
      httpOnly: true,
      secure: this.options.protocol === 'https'
    }));
  }

  applyI18nDependentMiddleware() {
    if (this.options.getCookies === true) {
      this._app.get('/cookies', (req, res) => res.render('cookies', this.i18n.translate('cookies')));
    }
    if (this.options.getTerms === true) {
      this._app.get('/terms-and-conditions', (req, res) => res.render('terms', this.i18n.translate('terms')));
    }
  }

  addRoutes() {
    this.options.routes.forEach(route => {
      const routeConfig = Object.assign({}, {route}, this.options);
      this.use(router(routeConfig));
    });
  }

  catchErrors() {
    // this.use(middleware.notFound({
    //   logger: this.options.logger,
    //   translate: this.i18n.translate.bind(this.i18n),
    // }));
    //
    // this.use(middleware.errors({
    //   translate: this.i18n.translate.bind(this.i18n),
    //   debug: this.options.env === 'development'
    // }));
  }

  use(middleware) {
    this._app.use(middleware);
  }

  start(cb) {
    cb = cb || _.noop;
    this.addRoutes();
    this.catchErrors();
    if (this._started) {
      // this.options.logger.warn('App already started, exiting.');
      return false;
    }
    this._server = this.options.protocol === 'https'
      ? https.createServer(this._app)
      : http.createServer(this._app);
    this._server.listen(this.options.port, this.options.host, () => {
      this._started = true;
      cb();
    });
  }

  stop(cb) {
    cb = cb || _.noop;
    // this.redisClient.quit();
    this._server.close(() => {
      this._started = false;
    });
  }
}
