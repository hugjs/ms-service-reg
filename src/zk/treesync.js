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

const RETRY_TIME = 3

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
        logger.info("ChildAdded: %s added to %s", _.get(data,'child._id'), _.get(data,'parent._path'));
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
                    logger.debug("%s exists, no change.", data.child._path);
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
        logger.info("ChildRemoved: %s removed from %s", _.get(data,'child._id'), _.get(data,'parent._path'));
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
    
    Node.on('TrySetDefault',function(data){
        logger.debug('TrySetDefault: %s', JSON.stringify(data)) ;
        if(_.intersection(_.keys(data),['app','current','newvalue']).length<3){
            logger.error('Node data fail. TrySetDefault event data=%s should contains %s',
            JSON.stringify(data), 
            JSON.stringify(['app','current','newvalue']));
            return;
        }
        // data.times用户控制重试次数，默认重试3次
        data.times = data.times?data.times:1;
        // 把值设置到zk中
        var path = Util.format("%s/%s/_default", self._root, data.app._id);
        // stat参数需要根据类型分别处理，create的时候是path，setData的时候是Stat
        var proc = function(error, stat){
            if (error) {
                logger.error(
                    'Failed to TrySetDefault: %s to %s due to: %s.',
                    path, data.newvalue,
                    JSON.stringify(error)
                );
                // retry if needed
                if(data.times<RETRY_TIME){
                    ++data.times;
                    Node.emit('TrySetDefault', data);
                }else{
                    data.status = 1;
                    Node.emit('DefaultSetDone', data);
                    logger.error(
                        'Retry all Failed to TrySetDefault: %s to %s',
                        path, data.newvalue
                    );
                }
                return;
            }
            data.status = 0;
            Node.emit('DefaultSetDone', data);
            logger.info(
                'TrySetDefault Success: %s to %s.',
                path, data.newvalue
            );
        };
        self.zkclient.exists(path, function(err, stat){
            if(stat){
                self.zkclient.setData(path,
                    new Buffer(data.newvalue), 
                    _.has(data, ['current.version'])?data.current.version:-1,
                    proc
                );
            }else{
                self.zkclient.create(path, 
                    new Buffer(data.newvalue), 
                    proc)
            }
        })
    });

    Node.on('ZombieTreeNode',function(data){
        var path = Util.format("%s/%s/%s/%s/%s", 
            self._root, data.app, data.app_version, data.service, data.sid);
        logger.info("ZombieTreeNode ", path);
        self.zkclient.remove(path, -1,
            function(){
            },
            function(err, stat){
                if(err){
                    logger.error(
                        'Remove zombie node failed: %s due to: %s.',
                        path,
                        err
                    );
                    return;
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
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got sync watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.sync(event.path);
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
            if(!apps || apps.length == 0){
                cb();
                return;
            }
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
    self._tree.getApp(app) || self._tree.addApp(app);
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
            if(!versions || versions.length == 0){
                cb();
                return;
            }
            versions.forEach(function(version) {
                // 如果是默认的_default _ongo的话，单独进行同步
                if( ['_default'].indexOf(version) >= 0){
                    self.syncAppDefault(app, version,function(){
                        if(++count>=versions.length){
                            count = null;
                            versions = null;
                            cb();
                        }
                    })
                    return;
                }
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
 * app->app_version下面的App版本的信息
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
            if(!services || services.length == 0){
                cb();
                return;
            }
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
 * app->app_version->service下面的服务SID的信息
 */
ZkTreeSync.prototype.syncservice = function(app, version, service, cb){
    cb = cb?cb:noop;
    logger.debug('syncservice: %s, %s, %s', app, version, service);
    var self = this;
    var path = Util.format("%s/%s/%s/%s", self._root, app, version, service);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncservice watcher event: %s', JSON.stringify(event));
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
            if(!sids || sids.length == 0){
                cb();
                return;
            }
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
 * app->app_version->service->service_version下面的服务节点内容
 * service节点下面直接跟sid节点，提高系统的查找效率
 * 某个服务版本的服务的查找，放到服务列表里面通过过滤的方式进行，因为这个是个低频操作
 */
ZkTreeSync.prototype.syncserviceversion = function(app, version, service, service_version, cb){
    cb = cb?cb:noop;
    logger.debug('syncserviceversion: %s, %s, %s', app, version, service);
    var self = this;
    var path = Util.format("%s/%s/%s/%s", self._root, app, version, service);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncserviceversion watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.syncserviceversion(app, version, service);
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
            if(!sids || sids.length == 0){
                cb();
                return;
            }
            sids.forEach(function(node) {
                self._tree.regist({
                    app:app,
                    app_version: version,
                    service: service,
                    service_version: service_version,
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
 * app->_default
 * 同步app下特殊信息的信息，比如app的默认版本
 */
ZkTreeSync.prototype.syncAppDefault = function(app, prop, cb){
    cb = cb?cb:noop;
    logger.debug('syncAppDefault: %s, %s' , app, prop);
    var self = this;
    var path = Util.format("%s/%s/%s", self._root, app, prop);
    path && this.zkclient.getData(
        path,
        function (event) {
            logger.info('Got syncAppDefault watcher event: %s', JSON.stringify(event));
            // 节点删除的时候，需要同步删除节点信息
            var appNode = self._tree.getApp(app);
            if(event.type === zookeeper.Event.NODE_DELETED){
                // 设置app节点下属性的值设置为undefined
                appNode[prop] = undefined;
            }else {
                // 设置app节点下新的值
                self.syncAppDefault(app, prop);
            }
        },
        function (error, data, stat) {
            if (error) {
                cb();
                logger.error('Error occurred when getting data: %s.', error);
                return;
            }
            logger.debug(
                'Service Node: %s has data: %s, version: %d',
                path,
                data ? data.toString() : undefined,
                stat.version
            );
            if(data){
                var appNode = self._tree.getApp(app);
                appNode[prop] = {value: data.toString(), version: stat.version};
            }
            cb();
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
