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
var noop = function(){}
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
ServiceTree.prototype.getSNode = function(options){
    var appNode = this.getApp(options.app);
    if(!appNode) return false;
    if(!options.app_version) options.app_version = appNode.default();
    var vNode = appNode.child(options.app_version);
    if(!vNode) return false;
    var sNode = vNode.child(options.service);
    if(!sNode) return false;
    return sNode;

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
 * options.sid 微服务的节点ID
 * 
 */
ServiceTree.prototype.regist = function(options, cb){
    cb = cb?cb:noop;
    var keys = ['app','app_version','service','sid'];
    if(_.intersection(_.keys(options), keys).length<keys.length){
        cb({status:1, msg:"参数缺失"});
        return;
    }
    var service = pool.get(options.app, options.sid);
    if(!service) {
        logger.error('Service Tree regist failed. SID not found in pool: %s', JSON.stringify(options));
        // 清理注册树（注册树和服务池没有同步，导致的数据差异）
        Node.emit('ZombieTreeNode', options);
        cb({status:10, msg:"微服务节点信息没有在服务池中找到"});
        return;
    }

    // 初始化应用版本如果没有提供的话，直接用当前的默认版本
    var appNode = this.getApp(options.app);
    if(!appNode || appNode._type != Node.APP){
        // 先创建app节点
        appNode = this.addApp(options.app);
    }
    if(!options.app_version) options.app_version = appNode.default();

    var vNode = appNode.child(options.app_version);
    if(!vNode){
        vNode = new Node({
            id: options.app_version, 
            app: options.app,
            type: Node.APP_VERSION
        });
        appNode.add(vNode);
    }

    var sNode = vNode.child(options.service);
    if(!sNode){
        sNode = new Node({
            id: options.service, 
            app: options.app,
            type: Node.SERVICE,
        });
        vNode.add(sNode);
    }

    var node = new Node({
        id: options.sid, 
        service: service, 
        app: options.app,
        type: Node.SERVICE_NODE, 
        version: options.service_version
    }); 
    sNode.add(node);
    cb({status:0, msg:"操作成功"});

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
    var svNode = this.getSNode(options);
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
 * 添加某个app的节点
 */
ServiceTree.prototype.addApp = function(app){
    var appNode = new Node({id:app, type: Node.APP});
    this._apps.add(appNode);
    return appNode;
}


/**
 * 获得满足某些条件的服务节点数组
 * 
 * 结果中，首先自动过滤掉非激活的节点
 * 
 * @param {Object} options 查询参数
 * 
 * options.app 必填，应用名称
 * options.app_version 应用版本，默认为默认版本
 * options.service 必填，服务名称
 * 
 * ## Exceptions:
 * 
 * 如果app或者service没有传入，那么系统会抛出异常
 * 
 * @returns 返回${service}对象的集合
 * 
 */
ServiceTree.prototype.getServices = async function(options){
    // 检查系统的
    var keys = ['app','service']
    if(_.keys(_.pick(_.omitBy(options,_.isNil),keys)).length < keys.length){
        logger.error('ServiceTree.getServices missing options', options)
        throw new Error('参数错误');
    }
    var sNode = this.getSNode(options)
    if(!sNode){
        return [];
    }
    var rst = [];
    try{
        await new Promise((resolve, reject)=>{
            var i = _.keys(sNode.getChildren()).length;
            _.forEach(sNode.getChildren(),(child)=>{
                child._type == Node.SERVICE_NODE && rst.push(child._service);
                --i;
                if(i<=0) resolve();
            })
        })
    }catch(e){
        logger.error('Iter sNode._children failed. ', e);
    }
    var ret = _.remove(rst, (n)=>{
        if(n && n.enabled()) return true;
        return false;
    });
    if(ret.length>0) return ret;
    // 如果没有值，需要通过默认版本重新获取一次
    if(options.app_version) {
        options.app_version = undefined;
        return await this.getServices(options);
    } else return [];
}



/**
 * 提供模块直接访问的入口
 */
exports.regist = function(options){
    return exports.init().regist(options);
}
