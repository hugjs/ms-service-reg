/**
 * 微服务池管理
 * 
 * /MICRO/services/app/serviceA
 * 
 * 本模块提供了对注册树的封装，每一个微服务以对象的方式进行了封装，然后被统一引用到了微服务树中。
 * 
 * 用以达到一个地方删除，多个地方删除的目的。
 * 
 * @module @lqb/servicereg
 * 
 */
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Events  = require('events');
var Util    = require('util');
var _       = require('lodash');

var service = require('../model/service');

/**
 * 服务池对象定义，单例
 * 
 * @param {*} options 
 */
function ServicePool(options){
    options     = options || {};
    this._options   = options;
    /**
     * 用于存储微服务的基本信息，key是微服务ID，value是微服务的相关数据，以对象存储（../model/service），方便引用和统一处理
     * 
     * {'app1':'{trading001':ServiceObj}}
     * 
     */
    this.services = {};
    logger.debug('Service Pool initialized');
}

// 支持事件模型
Util.inherits(ServicePool, Events.EventEmitter);

/**
 * 初始化服务列表对象，如果已经存在就直接返回
 */
exports.init = function(options){
    if( !ServicePool.singleton ) {
        ServicePool.singleton = new ServicePool(options);
    }
    return ServicePool.singleton;
}
/**
 * 往微服务列表里面增加一个微服务备用
 * @param app {string} 应用名称
 * @param id {string} 微服务ID
 * @param url {string} 微服务访问URL
 * @param version {string} 数据节点的版本号
 */
ServicePool.prototype.add = function(app, id, url, version){
    // 先查询有没有，如果有，就更新
    var svc = this.get(app, id);
    if(svc && svc._id === id){
        svc.parse(url);
        version && (svc._version = version);
        return svc;
    }
    svc = new service({app:app, id:id, url:url, version:version});
    if(svc && svc._id === id){
        if(!_.has(this.services, app)){
            this.services[app] = {};
        }
        this.services[app][id] = svc;
    }
    logger.debug("After add %s: %s: %s", app, id, JSON.stringify(this.services));
    return svc;
}

/**
 * 从微服务列表里面删除一个微服务
 * 
 * @param id {string} 微服务的ID
 */
ServicePool.prototype.remove = function(app, id){
    var svc = this.get(app, id);
    if(svc && svc._id === id){
        svc._enable = false; // 防止有其他引用, 不再调用disable()防止同步被触发
        this.services[app][id] = undefined;
    }
    logger.debug("After delete %s: %s: %s", app, id, JSON.stringify(this.services));
    return this;
}

/**
 * 获取某个服务ID对应的服务对象数据
 * 
 * @param id {string} 微服务的ID
 */
ServicePool.prototype.get = function(app, id){
    var service = this.services[app]?this.services[app][id]:null;
    try{
        if(service) return service;
        return null;
    }catch(e){
        return null;
    }
}

/**
 * 获取服务列表的大小
 */
ServicePool.prototype.size = function(app){
    return Object.keys(this.services[app]).length;
}
