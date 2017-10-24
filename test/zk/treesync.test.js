
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var util = require('util');
var expect = require('chai').expect
var assert = require('chai').assert
var zk = require('../../src/zk')
var zookeeper = require('node-zookeeper-client');

// var client = zookeeper.createClient('192.168.8.3:2181,192.168.8.3:2182');

var ROOT = '/TEST_MICRO/apps'

var tree = require('../../src/model/tree').init({root:ROOT});

describe('zk/treesync',function(){
    this.timeout(10000);
    before(function(done){
        zk.once('ready',done);
        zk.init({zk:{
            url:'192.168.8.3:2181,192.168.8.3:2182'
        },root:'/TEST_MICRO'});
    })
    describe('verify treesync is working good', function(){
        var pool = require('../../src/model/servicepool').init();
        before(function(done){
            // 先注册好两个服务
            pool.add('base','service01','http://192.168.1.2:8081/svc01',"0.1.1");
            pool.add('base','service02','http://192.168.1.3:8081/svc02',"0.1.2");
            done();
        });
        it('[P1] basic operations',function(){
                assert(tree.regist({
                    app:'base',
                    app_version: '0.1.1',
                    service: 'user',
                    service_version: '0.1.1',
                    sid: 'service01',
                })==true, 'Appending existing service');
                assert(tree.regist({
                    app:'base',
                    app_version: '0.1.1',
                    service: 'user',
                    service_version: '0.1.3',
                    sid: 'service03',
                })==false, 'Appending none existing service');
                tree.getApp('base').setDefault("0.1.1");
                logger.debug("base app data: " + JSON.stringify(tree.getApp('base')));
                setTimeout(function(){
                    assert(
                        tree.getApp('base').default()=="0.1.1",
                        "Setting application's default version");
                },3000)
                
        });
        after(function(){
            // 取消两个服务的注册
            // pool.remove('base','service01');
            // pool.remove('base','service02');
        });
    })
})
