/**
 * 微服务信息的封装
 */
var Events  = require('events');
var Util    = require('util');
var _       = require('lodash');
var URL     = require('url-parse');
var cache   = require('./servicecache')
var cuid = require('cuid');

var eventbus = new Events.EventEmitter();
Util.inherits(Service, Events.EventEmitter);
/**
 * 微服务定义，需要扩展事件机制
 * 
 * node.on('event',function)
 * 
 * node.emit('event',data)
 * 
 * @param {object} options 
 *  options.url配置微服务的URL地址
 *  options.id 微服务的ID
 *  options.app 微服务所属应用名称
 */
function Service(options) {
    Events.EventEmitter.call(this);
    this._config = options.config;
    this._enable = false;
    this._id = options.id;     // 微服务ID
    this._app = options.app;
    this._url = null;
    this._version = options.version?options.version:-1;
    this._service_version = options.service_version;
    _.has(options,'url') && this.parse(options.url);
}

/**
 * 把URL解析成为分开的不同部分
 */
Service.prototype.parse = function(url){
    this._url = new URL(url);
    switch (this._url.protocol) {
        case 'https:':
            this._url.protocol = 'https';
            parseInt(this._url.port)>0 || (this._url.port = '443');
            break;
        case 'http:':
            this._url.protocol = 'http';
            parseInt(this._url.port)>0 || (this._url.port = '80');
            break;
        default:
            break;
    }
    return this;
}

/**
 * 停用服务
 */
Service.prototype.disable = function(traceid){
    traceid = traceid?traceid:cuid();
    if(this._enable){
        this._enable = false;
        module.exports.emit('ServiceDisabled',{service:this,traceid:traceid});
    }
    return this;
}

/**
 * 启用服务
 */
Service.prototype.enable = function(traceid){
    traceid = traceid?traceid:cuid();
    if(!this._enable){
        this._enable = true;
        module.exports.emit('ServiceEnabled',{service:this,traceid:traceid});
    }
    return this;
}

/**
 * 获取服务启用状态
 */
Service.prototype.enabled = function(){
    return this._enable;
}


/**
 * 封装为zookeeper服务节点数据
 */
Service.prototype.getServiceData = function(){
    return JSON.stringify({
        url: _.has(this._url,'href') ? this._url.href:"",
        enabled: this._enable?1:0,
        version: this._service_version,
    });
}


/**
 * 获取服务节点URL信息
 */
Service.prototype.getUrl = function(){
    return this._url.href?this._url.href:"";
}

/**
 * 获取服务节点版本信息（存储版本，不是业务逻辑版本）
 */
Service.prototype.getVersion = function(){
    return this._version;
}

module.exports = Service;

/**
 * 使得module对象支持事件的监听
 */
require('../model/events').EVENTS.forEach(function (key) {
    module.exports[key] = eventbus[key];
});
