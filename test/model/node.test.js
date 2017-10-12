const logger = require('@log4js-node/log4js-api').getLogger();
var expect = require('chai').expect
var Node = require('../../src/model/node')

describe('model/node', function() {
	var root = new Node({id:'apps', type:Node.DIR}); 
	it('[P1] adding && removing noti', function(){
		var appNode = new Node({id:'base', type: Node.APP});
		root.add(appNode);
		expect(root.getChildren().base).to.deep.include({_id:'base'})
		var vNode = new Node({id:'0.0.2', app:'base', type: Node.APP_VERSION});
		appNode.add(vNode);
		var snNode = new Node({id:'service', app:'base', type: Node.SERVICE, service:{_id:'service'}})
		vNode.add(snNode);
		var sNode = new Node({id:'service01', app:'base', type: Node.SERVICE_NODE, service:{_id:'service01',_url:{host:'192.168.1.2'}}})
		snNode.add(sNode);
		expect(snNode.getChildren().service01).to.deep.include({_id:'service01'})
	});
	it('[P1] removing', function(){
		Node.on('ChildRemoved',function(data){
			logger.debug('%s removed from %s', data.child._id, data.parent._id);		
			setTimeout(function(){expect(data.child._children, 'check child node has no child').to.deep.equal({})},10);		
		})
		root.remove('base');
	});
});
