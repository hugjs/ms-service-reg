/**
 * 
 * 1. 微服务路由缓存
 * 
 * 用途：通过API请求，快速定位微服务节点集群。供负载均衡服务使用。
 * 
 * KEY=md5(app/app_version/service)， base/0.1.1/user
 * Value=service对象 {}
 * 
 * 需要注意的是，key里面只需要确定app名称、app版本、服务名称，就可以生成这个目录。
 * 
 * 在服务注册（新建某个版本下面的某个微服务名称）的时候添加，在服务离线的时候删除（默认不删除）
 * 
 * 2. 微服务版本缓存
 * 
 * 用途：上线或者下线某个微服务版本的时候用于快速定位。供灰度发布等逻辑使用。
 * 
 * KEY=md5(app/service/service_version) base/user/0.1.1
 * value=[sids]
 * 
 * 在服务注册的时候添加，每一个单独的微服务节点的注册操作，都在这个数组里面进行缓存。
 * 
 */
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Node = require('./node');
var _ = require('lodash');
var crypto = require('crypto');

const DELIMITER = "/";

/**
 * KEY=md5(app/app_version/service)， base/0.1.1/user
 * Value=service 注册树节点对象Node
 */
var route_cache = {};

/**
 * KEY=md5(app/app_version/service)， base/0.1.1/user
 * Value=service 服务节点的数组
 */
var service_version_cache = {};

/**
 * 当节点信息被添加的时候，更新缓存
 */
Node.on('ChildAdded',function(data){
    // 节点被添加了，并且，当前被添加的节点是服务类型
    if(_.has(data,['parent','_id']) && _.has(data,['child','_id']) && data.child._type == Node.SERVICE){
        var key = _.join([data.child._app, data.parent._id, data.child._id], DELIMITER);
        var key_md5 = crypto.createHash('md5').update(key).digest('hex');
        route_cache[key_md5] = data.child;
    }
    if(_.has(data,['parent','_id']) && _.has(data,['child','_id']) && data.child._type == Node.SERVICE_NODE){
        var key = _.join([data.parent._app, data.child._version, data.parent._id], DELIMITER);
        var key_md5 = crypto.createHash('md5').update(key).digest('hex');
        if(!service_version_cache[key_md5]) service_version_cache[key_md5] = {};
        service_version_cache[key_md5][data.child._id] = data.child;
    }
    logger.debug('route_cache: ' + JSON.stringify(route_cache))
    logger.debug('service_version_cache: ' + JSON.stringify(service_version_cache))
});

/**
 * 当节点信息被删除的时候，更新缓存
 */
Node.on('ChildRemoved',function(data){
    if(_.has(data,['parent','_id']) && _.has(data,['child','_id']) && data.child._type == Node.SERVICE){
        var key = _.join([data.child._app, data.parent._id, data.child._id], DELIMITER);
        var key_md5 = crypto.createHash('md5').update(key).digest('hex');
        route_cache[key_md5] = undefined;
    }
    if(_.has(data,['parent','_id']) && _.has(data,['child','_id']) && data.child._type == Node.SERVICE_NODE){
        var key = _.join([data.parent._app, data.child._version, data.parent._id], DELIMITER);
        var key_md5 = crypto.createHash('md5').update(key).digest('hex');
        if(_.has(service_version_cache,[key_md5, data.child._id]))
            service_version_cache[key_md5][data.child._id] = undefined;
    }

});

/**
 * 获得某个微服务的所有节点
 */
exports.getServiceNodes = function(app, app_version, service){
    var key_md5 = crypto.createHash('md5').update(_.join([app, app_version, service], DELIMITER)).digest('hex');
    if(_.has(route_cache, key_md5)) return route_cache[key_md5];
    else return null;
}

/**
 * 获得某个版本的微服务的所有节点，可以跨不同app的版本
 */
exports.getServiceNodes = function(app, service, service_version){
    var key_md5 = crypto.createHash('md5').update(_.join([app, service, service_version], DELIMITER)).digest('hex');
    if(_.has(route_cache, key_md5)) return route_cache[key_md5];
    else return null;
}

