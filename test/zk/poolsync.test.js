
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var util = require('util');
var expect = require('chai').expect
var assert = require('chai').assert
var pool = require('../../src/model/servicepool').init();
var poolsync = require('../../src/zk/poolsync')
var zookeeper = require('node-zookeeper-client');

var client = zookeeper.createClient('192.168.8.3:2181,192.168.8.3:2182');

var ROOT = '/TEST_MICRO/services'

var options = {zk:{
    url:'192.168.8.3:2181,192.168.8.3:2182'
},root:ROOT};

var syncer = null;

describe('zk/poolsync', function() {
    this.timeout(10000);
    before(function(done) {
        syncer = poolsync.init(options,function(){
            client.connect();
            client.once('connected', done);
        });
    });
    describe('#ops', function() {
      it('[P1] basic operations', function(done) {
        logger.debug('connected');
        client.mkdirp(
            ROOT + '/base/service01',new Buffer('{"url":"https://192.168.8.2:80/pth01","enabled":1}'),
            zookeeper.CreateMode.PERSISTENT, function(err, p){
            logger.debug('mkdirp done')
            if(err) done(err);
            assert(err == null, 'zookeeper mkdirp got error: ' + util.format('%s',err));
            setTimeout(function(){
                var svc = pool.get('base','service01');
                logger.debug('service data after add: %s',JSON.stringify(svc));
                assert(svc != null, util.format('service %s:%s not found', 'base','service01'));
                expect(svc.getUrl(),"verify service info just added").to.nested.include({'hostname':'192.168.8.2','port':'80','protocol':'https'});
                svc = null;
                done();
            },200);
        })
      })
    });
    after(function(done){
        client.remove(ROOT + '/base/service01',function(err0){
            assert(err0 == null, 'zookeeper remove got error: ' + util.format('%s',err0));
            client.remove(ROOT + '/base',function(){
                client.close();
                done();
            })
            setTimeout(function(){
                var svc = pool.get('base','service01');
                assert(svc == null, 'verify the service is removed when node deleted');
            },100);
        });
    });
});