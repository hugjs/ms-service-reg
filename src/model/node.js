/**
 * 服务树节点的封装，用于保存服务树基本信息
 * 
 * 节点类型结构如下：
 * /DIR/APP/APP_VERSION/SERVICE/SERVICE_NODE
 * 
 * @module
 */

var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Events  = require('events');
var Util    = require('util');
var _       = require('lodash');
var URL     = require('url-parse');

const DELIMITER = "/"
const PATH_DEFAULT = "v_default"
const PATH_ONGO = "v_ongo"

// Event types
var TYPES = {
  DIR : 0,          // 前缀目录
  APP : 1,          // 应用名称
  APP_VERSION : 2,  // 应用版本
  SERVICE : 3,      // 服务名称
  SERVICE_NODE : 4, // 服务节点信息
};

/**
 * 全局的事件通过这个事件管理对象管理
 * 事件的数据，会包含相对多的信息
 * 
 */
var eventbus = new Events.EventEmitter();

Util.inherits(Node, Events.EventEmitter);
/**
 * 服务树节点，需要扩展事件机制
 * 
 * ```
 * node.on('event',function)
 * 
 * node.emit('event',data)
 * ```
 * 
 * ## 事件说明
 * ### ChildAdded
 * 模块事件，添加了孩子节点，事件数据：`{parent: node, child: node}`
 * ### AddedToParent
 * 添加到了某个父节点，事件的数据是父节点的ID
 * ### ChildRemoved
 * 模块事件，孩子节点从父节点删除了，事件数据：`{parent: node, child: node}`
 * ### RemovedFromParent
 * 节点从某个父节点移除了
 * ### TrySetDefault
 * 模块事件，尝试设置某个APP的默认版本成功，这个时候，本地对象的default信息被设置
 * 
 * 事件数据： `{app:'base', current:{value, version}, newvalue:'', opsid:''}`
 * ### DefaultSetDone
 * 默认版本设置完成
 * 
 * 事件数据：`{app:'base', current:{value, version}, newvalue:'', opsid:'', status:0, msg:''}`
 * 
 * 当status=0表示设置成功，否则失败
 * ### TrySetOngo
 * 模块事件，尝试设置某个APP的部署中版本成功，这个时候，本地对象的ongo信息被设置
 * 
 * 事件数据: `{app: appNode,opsid:''}`
 * ### SetOngoDone
 * 模块事件，部署中的版本更新状态更新
 * 
 * 事件数据: `{app: appNode,opsid:'',status:0, msg:'失败原因'}`
 * 
 * 当status=0表示设置成功，否则失败
 * 
 * @param {object} options 
 *  options.id 微服务的ID
 *  options.path 节点路径，方便跟踪和同步.根节点才需要设置，子节点在添加到父节点的时候自动维护
 *  options.parent 父节点
 *  options.app 微服务所属应用名称
 *  options.version 微服务版本
 *  options.weight 微服务权重，在负载均衡的时候使用
 */
function Node(options) {
    Events.EventEmitter.call(this);
    this._config = options.config;
    this._id = options.id;     // 微服务ID, 或者节点的名称
    this._type = options.type;
    this._path = options.path;
    this._children = {};
    switch (this._type) {
      case TYPES.SERVICE_NODE:
        this._service = options.service?options.service:null;
        this._weight = options.weight?options.weight:1;
        this._version = options.version?options.version:'0.0.1';
      case TYPES.SERVICE:
      case TYPES.APP_VERSION:
      case TYPES.APP:
        this._app = options.app;
        break;
      case TYPES.DIR:
        this._path = options.path? options.path: DELIMITER;
        break;
      default:
        break;
    }
    return this;
}

/**
 * 添加孩子节点
 */
Node.prototype.add = function(node){
  logger.debug('Adding %s to %s', node._id, this._id)
  if(this._children[node._id]){
    delete this._children[node._id];
  }
  // 添加子节点的时候自动设置path
  node._path = this._path + DELIMITER + node._id;
  // node._parent = this;
  this._children[node._id]=node;
  module.exports.emit('ChildAdded',{parent: this, child: node});
  node.emit('AddedToParent', this._id);
  return this;
}

/**
 * 删除一个孩子节点。
 * 
 * 删除的时候，如果有子节点，先删除子节点，再删除本节点。
 * 
 * 删除的目的是去掉对象引用
 */
Node.prototype.remove = function(id, cb){
  logger.debug('Removing %s from %s', id, this._id);
  var child = this._children[id];
  if(!child) return this;
  if(Object.keys(child.getChildren()).length>0){
    var keys = Object.keys(child.getChildren());
    for(var i = 0; i < keys.length; ++i){
      child.remove(keys[i]);
    }
  }
  child.emit('RemovedFromParent');
  delete this._children[id];
  module.exports.emit('ChildRemoved', {parent: this, child: child});
  // 通知这个节点已经被删除, 从zk删除的时候，一定要注意可能需要重试
  return this;
}

/**
 * 获取节点的所有子节点
 */
Node.prototype.getChildren = function(){
  return this._children;
}

/**
 * 获得某个子节点
 */
Node.prototype.child = function(id){
  return this._children[id];
}

/**
 * 获得app的当前默认版本
 */
Node.prototype.default = function(){
  return _.has(this,['_default', 'value'])?this._default.value:null;
}

/**
 * 设置默认版本
 */
Node.prototype.setDefault = function(value){
  if(this._type == TYPES.APP) {
    module.exports.emit('TrySetDefault', {app: this, current: this._default, newvalue: value});
  }
}

/**
 * 获得app的当前部署中的版本
 */
Node.prototype.ongo = function(){
  return _.has(this,['_ongo', 'value'])?this._ongo.value:null;
}

/**
 * 设置当前部署版本
 */
Node.prototype.setOngo = function(value){
  if(_.has(this,['_ongo','value'])) {
    this._ongo.value = value;
    module.exports.emit('TrySetOngo', {app: this, current: this._ongo, newvalue: value});
  }else return false;
}


/**
 * 清空当前部署版本
 */
Node.prototype.unsetOngo = function(value){
  if(_.has(this,['_ongo','value'])) {
    this._ongo.value = value;
    this.emit('TrySetOngo', {current: this._ongo, newvalue: value});
  }else return false;
}

module.exports = Node;
Object.keys(TYPES).forEach(function (key) {
  module.exports[key] = TYPES[key];
});

/**
 * 使得module对象支持事件的监听
 */
require('../model/events').EVENTS.forEach(function (key) {
    module.exports[key] = eventbus[key];
});
