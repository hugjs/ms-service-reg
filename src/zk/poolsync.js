/**
 * 同步zookeeper的services节点到本地内存
 * 每个微服务都需要在/services/app/下面注册
 * 
 * 单例模式
 */
var noop = function(){};
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.basename(module.id));
var Events  = require('events');
var Util    = require('util');
var zookeeper = require('node-zookeeper-client');

var svcpool = require('../model/servicepool');

const ROOT = '/MICRO/services'

var eventbus = new Events.EventEmitter();


/**
 * 服务列表对象定义
 * 
 * @param {*} options 
 */
function ZkPoolSync(options){
    options     = options || {};
    var self = this;
    self._options   = options;
    
    /**
     * 初始化服务池
     */
    self.pool = svcpool.init();
    
    self.root = options.root? options.root:ROOT;

    /**
     * zookeeper client
     */
    self.zkclient = null;
    
    self.zkclient = zookeeper.createClient(options.zk.url); // init zookeeper client
    self.zkclient.once('connected', function () {
        logger.info('Connected to ZooKeeper.');
        // 初始化根目录
        self.zkclient.exists(self.root, 
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
                    self.syncroot(self.root, function(){module.exports.emit('ready');});
                } else {
                    self.zkclient.mkdirp(self.root, 
                        zookeeper.CreateMode.PERSISTENT, 
                        function(err0, p){
                            if (err0) {
                                logger.error('Failed to mkdirp: %s due to: %s: ', path, err0.stack);
                            } else {
                                logger.debug('Path: %s is successfully created.', p);
                                self.syncroot(self.root, function(){ module.exports.emit('ready');});
                            }
                        }
                    )
                }
        })
        
    });
    
    self.zkclient.connect();
}

// 支持事件模型
Util.inherits(ZkPoolSync, Events.EventEmitter);

/**
 * 初始化服务列表对象，如果已经存在就直接返回
 */
exports.init = function(options, cb){
    if( !ZkPoolSync.singleton ) {
        ZkPoolSync.singleton = new ZkPoolSync(options);
    }
    cb && cb();
    return ZkPoolSync.singleton;
}

/**
 * 开始同步
 */
ZkPoolSync.prototype.syncroot = function(path, cb){
    cb = cb?cb:noop;
    logger.debug('ZkPoolSync sync root: %s' , path);
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
            // TODO 遍历节点
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
 * 同步某个应用节点，app下面是service
 * @param app {string} 应用名称
 */
ZkPoolSync.prototype.syncapp = function(app, cb){
    cb = cb?cb:noop;
    logger.debug('ZkPoolSync sync app: %s' , app);
    var self = this;
    var path = self.root + "/" + app;
    logger.debug(path);
    path && this.zkclient.getChildren(
        path,
        function (event) {
            logger.info('Got syncapp watcher event: %s', JSON.stringify(event));
            event.type === zookeeper.Event.NODE_DELETED || self.syncapp(app);
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
            // 遍历节点并创建服务节点
            var count = 0;
            services.forEach(function(service){
                self.syncservice(app, service, function(){
                    if(++count>=services.length){
                        count = null;
                        services = null;
                        cb();
                    }
                });
            });
        }
    );
}

/**
 * 同步服务内容
 */
ZkPoolSync.prototype.syncservice = function(app, service,cb){
    cb = cb?cb:noop;
    logger.debug('ZkPoolSync sync syncservice: %s, %s' , app, service);
    var self = this;
    var path = self.root + "/" + app + "/" + service;
    logger.debug(path);
    path && this.zkclient.getData(
        path,
        function (event) {
            logger.info('Got syncservice watcher event: %s', JSON.stringify(event));
            // 节点删除的时候，需要同步删除节点信息
            if(event.type === zookeeper.Event.NODE_DELETED)
                self.pool.remove(app,service);
            else self.syncservice(app, service);
        },
        function (error, data, stat) {
            if (error) {
                cb();
                logger.error('Error occurred when getting data: %s.', error);
                return;
            }
            if(data){
                self.pool.add(app, service, data, stat.version)
            }
            logger.debug(
                'Service Node: %s has data: %s, version: %d',
                path,
                data ? data.toString() : undefined,
                stat.version
            );
            cb();
        }
    );
}

/**
 * 使得module对象支持时间的监听
 */
require('../model/events').EVENTS.forEach(function (key) {
    module.exports[key] = eventbus[key];
});
