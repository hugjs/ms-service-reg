
var expect = require('chai').expect
var service = require('../../src/model/service')
describe('model/service', function() {
  describe('#Parsing', function() {
    it('[P1] parsing http://localhost:801/test/path', function() {
      var svc = new service({app:'base',id:'123',url:"http://localhost:801/test/path"});
			expect(svc.getUrl(),"parsing url").to.nested.include({'hostname':'localhost','port':'801','protocol':'http'});
			expect(svc.enabled(), "Initial enabled status expeced false").to.be.false;
			expect(svc.enable().enabled(),"After svc.enable(), getting enabled status expected true").to.be.true;
    });
    it('parsing https://localhost/test/path', function() {
      var svc = new service({app:'base',id:'123',url:"https://localhost/test/path"});
			expect(svc.getUrl(),"parsing url").to.nested.include({'hostname':'localhost','port':'443','protocol':'https'});
			expect(svc.enabled(), "Initial enabled status expeced false").to.be.false;
			expect(svc.enable().enabled(),"After svc.enable(), getting enabled status expected true").to.be.true;
    });
  });
});