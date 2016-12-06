'use strict';

const request = require('supertest-as-promised');
const bootstrap = require('../../');
const controllers = require('hof-controllers');
const path = require('path');
const appConfig = {
  foo: 'bar',
  bar: 'baz'
};

let baseControllerCalled = false;
class CustomBaseController extends controllers.base {
  constructor(options) {
    baseControllerCalled = true;
    super(options);
  }
}

let stepControllerOptions = null;
let stepControllerCalled = false;
class CustomStepController extends CustomBaseController {
  constructor(options) {
    stepControllerCalled = true;
    stepControllerOptions = options;
    super(options);
  }
}

describe('bootstrap()', () => {

  it('must be given a list of routes', () =>
    (() => bootstrap()).should.Throw('Must be called with a list of routes')
  );

  it('routes must each have a list of one or more steps', () =>
    (() => bootstrap({
      routes: [{}]
    })).should.Throw('Each route must define a set of one or more steps')
  );

  it('requires the path to fields argument to be valid', () =>
    (() => bootstrap({
      fields: 'not_a_valid_path',
      routes: [{
        steps: {},
      }]
    })).should.Throw('Cannot find fields at ' + path.resolve(__dirname, '../../test/not_a_valid_path'))
  );

  it('requires the path to the route fields argument to be valid', () =>
    (() => bootstrap({
      fields: '',
      routes: [{
        steps: {},
        fields: 'not_a_valid_path'
      }]
    })).should.Throw('Cannot find route fields at ' + path.resolve(__dirname, '../../test/not_a_valid_path'))
  );

  it('requires the path to the views argument to be valid', () =>
    (() => bootstrap({
      views: 'not_a_valid_path',
      routes: [{
        steps: {}
      }]
    })).should.Throw('Cannot find views at ' + path.resolve(__dirname, '../../test/not_a_valid_path'))
  );

  it('requires the path to the route views argument to be valid', () =>
    (() => bootstrap({
      routes: [{
        steps: {},
        views: 'not_a_valid_path',
      }]
    })).should.Throw('Cannot find route views at ' + path.resolve(__dirname, '../../test/not_a_valid_path'))
  );

  it('uses the route fields as the path', () =>
    (() => bootstrap({
      routes: [{
        views: path.resolve(__dirname, '../apps/app_1/views'),
        steps: {},
        fields: 'fields'
      }]
    })).should.not.Throw()
  );

  it('uses the name to find a path to the fields', () =>
    (() => bootstrap({
      routes: [{
        views: path.resolve(__dirname, '../apps/app_1/views'),
        name: 'app_1',
        steps: {}
      }]
    })).should.not.Throw()
  );

  describe('with valid routes and steps', () => {

    it('returns the bootstrap interface object', () =>
      bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      }).should.have.all.keys('server', 'stop', 'start', 'use')
    );

    it('starts the service and responds successfully', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });
      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(200);
    });

    it('accepts multiple routes', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }, {
          views: path.resolve(__dirname, '../apps/app_2/views'),
          steps: {
            '/two': {}
          }
        }]
      });
      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .then(() =>
          request(bs.server)
            .get('/two')
            .set('Cookie', ['myCookie=1234'])
            .expect(200)
        );
    });

    it('serves the correct view on request', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }, {
          views: path.resolve(__dirname, '../apps/app_2/views'),
          steps: {
            '/two': {}
          }
        }]
      });
      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>one</div>\n'))
        .then(() =>
          request(bs.server)
            .get('/two')
            .set('Cookie', ['myCookie=1234'])
            .expect(200)
            .expect(res => res.text.should.eql('<div>two</div>\n'))
        );
    });

    it('looks up a view from the route directory', () => {
      const bs = bootstrap({
        views: path.resolve(__dirname, '../apps/common/views'),
        routes: [{
          views: path.resolve(__dirname, '../apps/app_2/views'),
          steps: {
            '/common': {}
          }
        }]
      });
      return request(bs.server)
        .get('/common')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>from app 2</div>\n'));
    });

    it('falls back to common views if view not found in route views', () => {
      const bs = bootstrap({
        views: path.resolve(__dirname, '../apps/common/views'),
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/common': {}
          }
        }]
      });
      return request(bs.server)
        .get('/common')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>from common</div>\n'));
    });

    it('looks up from hof-template-partials if not found in any supplied views dir', () => {
      const bs = bootstrap({
        views: path.resolve(__dirname, '../apps/common/views'),
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/step': {}
          }
        }]
      });
      return request(bs.server)
        .get('/step')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.contain('<div class="content">'));
    });

    it('serves a view on request to an optional baseUrl', () => {
      const bs = bootstrap({
        routes: [{
          baseUrl: '/app_1',
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });
      return request(bs.server)
        .get('/app_1/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>one</div>\n'));
    });

    it('serves a view on request to an optional param', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          params: '/:action?',
          steps: {
            '/one': {}
          }
        }]
      });
      return request(bs.server)
        .get('/one/param')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>one</div>\n'));
    });

    it('can instantiate a custom base controller for the app', () => {
      const bs = bootstrap({
        baseController: CustomBaseController,
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });
      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(() =>
           baseControllerCalled.should.equal(true)
        );
    });

    it('does not start the service if start is false', () => {
      const bs = bootstrap({
        start: false,
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });

      return should.equal(bs.server, null);
    });

    it('starts the service when start is called', () => {
      const bs = bootstrap({
        start: false,
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });

      bs.start();

      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>one</div>\n'));
    });

    it('merges start options with the bootstrap config', () => {
      const bs = bootstrap({
        start: false,
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });

      bs.start({
        port: '8001',
        host: '1.1.1.1'
      });

      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(200)
        .expect(res => res.text.should.eql('<div>one</div>\n'));
    });

    it('stops the service when stop is called', done => {
      const bs = bootstrap({
        start: false,
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });

      bs.start({
        port: '8002'
      }).then(() => {
        bs.stop().then(() => {
          require('request')('http://localhost:8002', err => {
            err.should.be.instanceof(Error);
            err.code.should.equal('ECONNREFUSED');
            done();
          });
        });
      });
    });

    it('serves static resources from /public', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });
      return request(bs.server)
        .get('/public/test.js')
        .set('Cookie', ['myCookie=1234'])
        .expect(200);
    });

    it('returns a 404 if the resource does not exist', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {}
          }
        }]
      });
      return request(bs.server)
        .get('/public/not-here.js')
        .set('Cookie', ['myCookie=1234'])
        .expect(404);
    });

    it('returns a 200 for successful shallow health check', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {}
        }]
      });
      return request(bs.server)
        .get('/healthz/ping')
        .set('Cookie', ['myCookie=1234'])
        .expect(200);
    });

    it('can instantiate a custom controller for the route', () => {
      const bs = bootstrap({
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {
              controller: CustomStepController
            }
          }
        }]
      });
      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(() =>
          stepControllerCalled.should.equal(true)
        );
    });

    it('can pass the app config to a custom controller', () => {
      const bs = bootstrap({
        appConfig: appConfig,
        routes: [{
          views: path.resolve(__dirname, '../apps/app_1/views'),
          steps: {
            '/one': {
              controller: CustomStepController
            }
          }
        }]
      });
      return request(bs.server)
        .get('/one')
        .set('Cookie', ['myCookie=1234'])
        .expect(() =>
          stepControllerOptions.appConfig.should.deep.equal(appConfig)
        );
    });

  });

});
