
const logger = require('@log4js-node/log4js-api').getLogger(module.id);
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
        it('[P1] basic operations',function(){
                assert(tree.regist({
                    app:'base',
                    app_version: '0.1.1',
                    service: 'user',
                    service_version: '0.1.2',
                    sid: 'service01',
                })==true, 'Appending existing service');
                assert(tree.regist({
                    app:'base',
                    app_version: '0.1.1',
                    service: 'user',
                    service_version: '0.1.2',
                    sid: 'service02',
                })==false, 'Appending none existing service');
        });
    })
})
