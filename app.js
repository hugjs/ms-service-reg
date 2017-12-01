
var noop = function(){}
var config = require('config')
var path = require('path');
var log4js = require('log4js');
const logger = require('@log4js-node/log4js-api').getLogger("app.enter");
require("./log")
const Koa = require('koa');
const websockify = require('koa-websocket');
const app = websockify(new Koa());
var router = require(config.get("path.router"))
var wsrouter = require(config.get("path.router") + "/ws")
var wsCtrl = require('./src/controller/ws')


// 注册http服务路由
app.use(router.routes())
.use(router.allowedMethods());

// 注册websocket服务路由
app.ws
.use(wsCtrl.enter);
 
app.listen(config.get("server.port"));

logger.info('listening to ', config.get("server.port"))