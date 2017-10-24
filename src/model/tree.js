/**
 * 微服务的注册树
 * 
 * /MICRO/apps/app/version/serviceA
 * 
 * 本模块保存了微服务注册树数据
 * 
 * @module 
 * 
 */
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Events  = require('events');
var Util    = require('util');
var _       = require('lodash');

var Node = require('../model/node');
var cache = require('./servicecache')
var pool = require('./servicepool').init();

var ROOT = '/MICRO/apps'

/**
 * 微服务的注册树对象定义，单例
 * 
 * ## 事件说明
 * ### NewNode
 * 新增了一个节点
 * 
 * @param {*} options 预留，暂时不需要
 */
function ServiceTree(options){
    options     = options || {};
    this._options   = options;
    this._root = options.root?options.root:ROOT;
    /**
     * {'app1':{'trading001':{'trading001_node1':ServiceObj}}}
     */
    this._apps = new Node({id:'apps',type:Node.DIR, path: this._root});
    logger.debug('ServiceTree initialized');
}

// 支持事件模型
Util.inherits(ServiceTree, Events.EventEmitter);

/**
 * 初始化微服务的注册树，如果已经存在就直接返回
 */
exports.init = function(options){
    if( !ServiceTree.singleton ) {
        ServiceTree.singleton = new ServiceTree(options);
    }
    return ServiceTree.singleton;
}

/**
 * 
 * 获取某个版本的某微服务的注册节点，所有这个版本的微服务都是注册在这个下面的
 * 
 * @param options {object} 服务注册信息
 * 
 * options.app_version 注册的app的版本
 * 
 * options.app app名称
 * 
 * options.service 微服务的名称
 * 
 * options.service_version 微服务的版本号
 *
 * 
 */
ServiceTree.prototype.getSVNode = function(options){
    var appNode = this.getApp(options.app);
    if(!appNode) return false;
    if(!options.app_version) options.app_version = appNode.default();
    var vNode = appNode.child(options.app_version);
    if(!vNode) return false;
    var sNode = vNode.child(options.service);
    if(!sNode) return false;
    var svNode = vNode.child(options.service_version);
    if(!svNode) return false;
    return svNode;

}

/**
 * 
 * 注册一个微服务
 * 
 * @param options {object} 服务注册信息
 * 
 * options.app_version 注册的app的版本
 * 
 * options.app app名称
 * 
 * options.service 微服务的名称
 * 
 * options.service_version 微服务的版本号
 * 
 * options.sid 微服务的节点ID
 * 
 */
ServiceTree.prototype.regist = function(options){
    var service = pool.get(options.app, options.sid);
    if(!service) {
        logger.debug('tree: %s', JSON.stringify(this._apps));
        logger.error('Service Tree regist failed. SID not found in pool: %s', options.sid);
        return false;
    }
    // 初始化应用版本如果没有提供的话，直接用当前的默认版本
    var appNode = this.getApp(options.app);
    if(!appNode || appNode._type != Node.APP){
        // 先创建app节点
        appNode = new Node({id:options.app, type: Node.APP})
        this._apps.add(appNode);
    }
    if(!options.app_version) options.app_version = appNode.default();

    var vNode = appNode.child(options.app_version);
    if(!vNode){
        vNode = new Node({
            id: options.app_version, 
            type: Node.APP_VERSION
        });
        appNode.add(vNode);
    }


    // 判断微服务版本号与当前的服务版本号是否一致，如果不一致，直接失败
    var sNode = vNode.child(options.service);
    if(!sNode){
        sNode = new Node({
            id: options.service, 
            type: Node.SERVICE
        });
        vNode.add(sNode);
    }

    var node = new Node({
        id: options.sid, 
        service: service, 
        type: Node.SERVICE_NODE, 
        version: options.service_version
    }); 
    sNode.add(node);
    return true;

}

/**
 * 
 * 取消一个微服务的注册
 * 
 * @param options {object} 服务注册信息
 * 
 * options.app_version 注册的app的版本
 * 
 * options.app app名称
 * 
 * options.service 微服务的名称
 * 
 * options.service_version 微服务的版本号
 * 
 * options.sid 微服务的节点ID
 * 
 */
ServiceTree.prototype.unregist = function(options){
    var svNode = this.getSVNode(options);
    if(!svNode) return false;
    svNode.remove(options.sid);
    return true;
}


/**
 * 获得某个app的节点
 */
ServiceTree.prototype.getApp = function(app){
    return this._apps.child(app);
}

/**
 * 提供模块直接访问的入口
 */
exports.regist = function(options){
    return exports.init().regist(options);
}

/**
 * 
 */
