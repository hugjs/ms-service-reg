/**
 * 统一资源载入
 */
var noop = function(){};
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Events  = require('events');
var Util    = require('util');

var poolsync = require('./poolsync');
var treesync = require('./treesync')

var eventbus = new Events.EventEmitter();

/**
 * 
 * 通过zookeeper来管理注册表的统一资源管理入口，可以用这个类来监听zk的整体同步状态
 * 
 * ## 事件 
 * 
 * ### ready
 * 
 * 服务节点池和服务注册树同步完成，后面就可以进行服务注册和管理等操作了。
 * 
 * @param {*} options 
 * options.root 根目录，不包含services和apps。如，/MICRO/services请输入/MICRO后面两个自动添加
 * 
 * options.apps 服务注册表的根节点，默认为apps
 * 
 * options.services 服务节点池的根节点，默认为services
 * 
 * options.zk zookeeper的连接信息。zk.url是连接地址，目前不支持其他参数
 * 
 */
function ZooKeeper(options){
    treesync.once('ready', function(){
        logger.debug("treesync ready");
        module.exports.emit('ready');
    });
    poolsync.once('ready',function(){
        logger.debug("poolsync ready");
        treesync.init({
            zk:{
                url:options.zk.url
            }, 
            root: options.root + (options.apps?options.apps:'/apps')
        });
    });
    poolsync.init({
        zk:{
            url:options.zk.url
        },
        root: options.root + (options.services?options.services:'/services')
    });
}

// 支持事件模型
Util.inherits(ZooKeeper, Events.EventEmitter);

/**
 * 初始化服务列表对象，如果已经存在就直接返回
 */
exports.init = function(options){
    logger.info('initializing zookeeper: %s', JSON.stringify(options));
    if( !ZooKeeper.singleton ) {
        ZooKeeper.singleton = new ZooKeeper(options);
    }
    return ZooKeeper.singleton;
}


/**
 * 使得module对象支持时间的监听
 */
require('../model/events').EVENTS.forEach(function (key) {
    module.exports[key] = eventbus[key];
});
