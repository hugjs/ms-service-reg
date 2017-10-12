
var expect = require('chai').expect
var assert = require('chai').assert
var ServicePool = require('../../src/model/servicepool')

var svcpool = ServicePool.init();
describe('model/servicepool', function() {
  describe('#init', function() {
    it('initialize a service pool', function() {
			expect(svcpool,"pool initialized").to.deep.include({"_options":{},"services":{}});
    })
  });
  describe('#actions',function(){
    it('[P1] add/size/remove',function(){
      svcpool.add('base','id1','http://192.168.1.2:8081/svc01');
      var svc = svcpool.get('base','id1');
			expect(svc.getUrl(),"parsing url")
        .to.nested.include({'hostname':'192.168.1.2','port':'8081','protocol':'http'});
      svc = null;
      assert(svcpool.size('base')===1,'size should be 1');
      svcpool.add('base','id2','https://192.168.1.3:8082/svc02');
      assert(svcpool.size('base')===2,'size should be 2 after svc02');
      svcpool.remove('base','id1');
      assert(svcpool.size('base')===1,'size should be 1 after delete');
      svc = svcpool.get('base','id2');
			expect(svc.getUrl(),"parsing url")
        .to.nested.include({'hostname':'192.168.1.3','port':'8082','protocol':'https'});
    })
  })
});