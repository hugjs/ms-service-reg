/**
 * 同步zookeeper的版本树到本地内存，这个类只负责同步，并且监听所有节点的变化并负责更新到内存
 * 
 * 每个微服务都需要在/apps/app/下面注册
 * 
 * 单例模式
 */
var noop = function(){};
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Events  = require('events');
var Util    = require('util');
var _       = require('lodash');
var zookeeper = require('node-zookeeper-client');

var svcpool = require('../model/servicepool');
var svctree = require('../model/tree');

var Node = require('../model/node')

const ROOT = '/MICRO/apps'

var eventbus = new Events.EventEmitter();

/**
 * 服务列表对象定义
 * 
 * @param {*} options 
 */
function ZkTreeSync(options){
    options     = options || {};
    var self = this;
    self._options   = options;
    
    /**
     * 初始化服务池
     */
    self._pool = svcpool.init();
    
    self._root = options.root? options.root:ROOT;
    self._tree = svctree.init({root:self._root});

    /**
     * zookeeper client
     */
    self.zkclient = null;
    
    self.zkclient = zookeeper.createClient(options.zk.url); // init zookeeper client
    self.zkclient.once('connected', function () {
        logger.info('Connected to ZooKeeper.');
        // 开始监听事件
        self.listen();
        // 初始化根目录
        self.zkclient.exists(self._root, 
            function(){},
            function(err, stat){
                if(err){
                    logger.error(
                        'Failed to check existence of node: %s due to: %s.',
                        path,
                        err
                    );
                    return;
                }
                if (stat) {
                    self.sync(self._root, function(){module.exports.emit('ready');});
                    
                } else {
                    self.zkclient.mkdirp(self._root, 
                        zookeeper.CreateMode.PERSISTENT, 
                        function(err0, p){
                            if (err0) {
                                logger.error('Failed to mkdirp: %s due to: %s: ', path, err0.stack);
                            } else {
                                logger.debug('Path: %s is successfully created.', p);
                                self.sync(self._root, function(){module.exports.emit('ready');});
                            }
                        }
                    )
                }
        })
        
    });
    
    self.zkclient.connect();
}

// 支持事件模型
Util.inherits(ZkTreeSync, Events.EventEmitter);

/**
 * 监听注册树节点的变化
 */
ZkTreeSync.prototype.listen = function(){
    var self = this;
    // 某一个节点被添加到了父节点中，需要在zk中创建
    Node.on('ChildAdded',function(data){
        logger.debug('zk/treesync ChildAdded: %s', JSON.stringify(data)) ;
        if(!_.has(data, ['child','_path'])){
            logger.error('Node data fail. ChildAdded event data should contains path');
            return;
        }
        self.zkclient.exists(data.child._path, 
            function(){
            },
            function(err, stat){
                if(err){
                    logger.error(
                        'Failed to check existence of node: %s due to: %s.',
                        data.child._path,
                        err
                    );
                    return;
                }
                if (stat) {
                    // 如果节点已经存在，默认不做操作
                    logger.debug(JSON.stringify(stat));
                } else {
                    var version = "";
                    // 特定情况下，需要写入节点数据，默认为空
                    self.zkclient.create(data.child._path, new Buffer(version),
                        zookeeper.CreateMode.PERSISTENT, 
                        function(err0, p){
                            if (err0) {
                                logger.error('Failed to create: %s due to: %s: ', data.child._path, err0.stack);
                            } else {
                                logger.debug('Path: %s is successfully created.', p);
                            }
                        }
                    )
                }
        })
    });

    Node.on('ChildRemoved',function(data){
        logger.debug('zk/treesync ChildRemoved: %s', JSON.stringify(data)) ;
        if(!_.has(data, ['child','_path'])){
            logger.error('Node data fail. ChildRemoved event data should contains path');
            return;
        }
        self.zkclient.exists(data.child._path, 
            function(){
            },
            function(err, stat){
                if(err){
                    logger.error(
                        'Failed to check existence of node: %s due to: %s.',
                        data.child._path,
                        err
                    );
                    return;
                }
                if (stat) {
                    // 如果节点已经存在，默认不做操作
                } else {
                    var version = "";
                    // 特定情况下，需要写入节点数据，默认为空
                    self.zkclient.create(data.child._path, new Buffer(version),
                        zookeeper.CreateMode.PERSISTENT, 
                        function(err0, p){
                            if (err0) {
                                logger.error('Failed to create: %s due to: %s: ', data.child._path, err0.stack);
                            } else {
                                logger.debug('Path: %s is successfully created.', p);
                            }
                        }
                    )
                }
        })
    });
}

/**
 * 把服务器中持久化下来的注册信息同步到本地节点中
 */
ZkTreeSync.prototype.sync = function(path, cb){
    cb = cb?cb:noop;
    logger.debug('ZkTreeSync sync root: %s' , path);
    var self = this;
    logger.debug(path);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncroot watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.syncroot(event.path);
        },
        function (error, apps, stat) {
            if (error) {
                logger.error(
                    'Failed to list children of node: %s due to: %s.',
                    path,
                    error
                );
                return;
            }
            logger.debug('Children of node: %s are: %j.', path, apps);
            // 遍历节点
            var count = 0;
            apps.forEach(function(app) {
                self.syncapp(app, function(){
                    if(++count>=apps.length){
                        count = null;
                        apps = null;
                        cb();
                    }
                });
            }, this);
        }
    );
}

/**
 * 把服务器中持久化下来的注册信息同步到本地节点中
 */
ZkTreeSync.prototype.syncapp = function(app, cb){
    cb = cb?cb:noop;
    logger.debug('ZkTreeSync sync syncapp: %s' , app);
    var self = this;
    var path = Util.format("%s/%s", self._root, app);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncapp watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.syncapp(app);
        },
        function (error, versions, stat) {
            if (error) {
                logger.error(
                    'Failed to list children of node: %s due to: %s.',
                    path,
                    error
                );
                return;
            }
            logger.debug('Children of node: %s are: %j.', path, versions);
            // 遍历节点
            var count = 0;
            versions.forEach(function(version) {
                self.syncversion(app, version, function(){
                    if(++count>=versions.length){
                        count = null;
                        versions = null;
                        cb();
                    }
                });
            }, this);
        }
    );
}

/**
 * 把服务器中持久化下来的注册信息同步到本地节点中
 */
ZkTreeSync.prototype.syncversion = function(app, version, cb){
    cb = cb?cb:noop;
    logger.debug('ZkTreeSync sync syncversion: %s, %s' , app, version);
    var self = this;
    var path = Util.format("%s/%s/%s", self._root, app, version);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncversion watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.syncversion(app, version);
        },
        function (error, services, stat) {
            if (error) {
                logger.error(
                    'Failed to list children of node: %s due to: %s.',
                    path,
                    error
                );
                return;
            }
            logger.debug('Children of node: %s are: %j.', path, services);
            // 遍历节点
            var count = 0;
            services.forEach(function(service) {
                self.syncservice(app, version, service, function(){
                    if(++count>=services.length){
                        count = null;
                        services = null;
                        cb();
                    }
                });
            }, this);
        }
    );
}


/**
 * 同步服务下面的服务节点内容
 */
ZkTreeSync.prototype.syncservice = function(app, version, service, cb){
    cb = cb?cb:noop;
    logger.debug('ZkTreeSync sync syncservice: %s, %s, %s', app, version, service);
    var self = this;
    var path = Util.format("%s/%s/%s/%s", self._root, app, version, service);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncversion watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.syncservice(app, version, service);
        },
        function (error, sids, stat) {
            if (error) {
                logger.error(
                    'Failed to list children of node: %s due to: %s.',
                    path,
                    error
                );
                return;
            }
            logger.debug('Children of node: %s are: %j.', path, sids);
            // 遍历节点
            var count = 0;
            sids.forEach(function(node) {
                self._tree.regist({
                    app:app,
                    app_version: version,
                    service: service,
                    sid: node,
                });
                if(++count>=sids.length){
                    count = null;
                    sids = null;
                    cb();
                }
            }, this);
        }
    );
}

/**
 * 初始化服务列表对象，如果已经存在就直接返回
 */
exports.init = function(options, cb){
    if( !ZkTreeSync.singleton ) {
        ZkTreeSync.singleton = new ZkTreeSync(options);
    }
    cb && cb();
    return ZkTreeSync.singleton;
}


/**
 * 使得module对象支持时间的监听
 */
require('../model/events').EVENTS.forEach(function (key) {
    module.exports[key] = eventbus[key];
});
