const noop = function(){}
const path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger('controller.ws');
const _ = require('lodash')

const svcTree = require('../model/tree').init()
const svcCache = require('../model/servicecache')
const loadBalance = require('../loadbalance')


/**
 * 获取某个服务访问的url
 * 
 * ## 参数说明：
 * a: appid
 * av: app_version应用版本，如果没有提供，使用默认版本
 * s: 微服务的名称
 * 
 * 
 * @param {Object} options {a:"",av:"",s:""}
 */
exports.enter = function(ctx, next){
    logger.debug('in the url');
    ctx.websocket.send('url connected');
    ctx.websocket.on('message', function(message) {
        logger.info("message received: " + message);
        // 格式化请求报文数据
        var body = {}
        try{
            body = JSON.parse(message);
            logger.info('url', body)
        }catch(e){
            logger.error(e);
            ctx.websocket.send(JSON.stringify({status:1, msg:"JSON格式错误"}));
            return;
        }
        // 数据校验
        var keys = ['a','s'];
        if(_.keys(_.pick(_.omitBy(body,_.isNil),keys)).length < keys.length){
            ctx.websocket.send(JSON.stringify({status:1, msg:"参数缺失"}));
            return;
        }
    
        try{
            svcTree.getServices({
                app:body.a, 
                app_version:body.av, 
                service: body.s}).then(function(services){
                    logger.debug("services:" + JSON.stringify(services));
                    return loadBalance.pick(services)
                }).then(function(url){
                    logger.debug("url:" + url);
                    if(url)
                        ctx.websocket.send(JSON.stringify({status:0, url: url }));
                    else 
                        ctx.websocket.send(JSON.stringify({status:1, msg: "无法找到路由信息" }));
                });
            
        }catch(e){
            logger.error(e);
            ctx.websocket.send(JSON.stringify({status:2, msg:"获取连接URL异常"}));
            return;
        }
    });
}