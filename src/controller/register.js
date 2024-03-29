/**
 * 微服务的注册是通过zk直接连接完成注册的，需要提供一个单独的服务注册库
 * 
 * 本接口定义的是需要通过接口访问修改的相关功能，比如服务激活和关闭，等
 * 
 * [ ] 服务激活
 * [ ] 服务关闭（取消激活）
 * [ ] 把某个服务节点添加到某个App版本中（tree中）
 * [ ] 把某个服务节点从某个App版本中取消注册（tree中）
 * [ ] 设置默认版本
 * [ ] 设置ongo版本
 * 
 */
var noop = function(){}
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.relative(process.cwd(),module.id));

var coparser = require('co-body');
var _ = require('lodash');
var svcPool = require('../model/servicepool').init()
var svcTree = require('../model/tree').init()
var svcCache = require('../model/servicecache')
var loadBalance = require('../loadbalance')


/**
 * 通过接口激活某个服务节点
 * 
 * ## 参数说明：
 * a: 应用名称
 * av: app_version应用版本，如果没有提供，使用默认版本
 * s: 微服务的名称
 * sid: 微服务节点的sid
 * sv: 微服务的版本
 * 
 * ## 业务逻辑说明
 * 如果sid提供，则直接更新sid对应的服务节点的状态；
 * 如果s和sv提供，则更新某个服务下某版本的服务的所有节点的状态；
 * 
 * @param {Object} ctx.request {a:"",av:"",s:"", sid:"", sv:""}
 */
exports.activate = async function(ctx, next){
    // 格式化请求报文数据
    var body = {}
    try{
        body = await coparser.json(ctx)
        logger.info("%s, ctx.req.body: %s",ctx.traceid, JSON.stringify(body));
    }catch(e){
        logger.error(e);
        return await next();
    }
    // 数据校验
    if(!body || !body.a || (!body.s && !body.sid) || (!body.sv && !body.sid)){
        ctx.body = {status:1, msg:"参数缺失"};
        return await next();
    }
    if(body.a && body.sid){
        // 根据sid启动服务
        var svc = svcPool.get(body.a, body.sid);
        if(svc){
            svc.enable();
            ctx.body = {status:0}
        }else{
            ctx.body = {status:1,msg:"service not found"}
        }
        return await next();
    }else if(body.a && body.s && body.sv){
        var services = svcCache.getServiceWithVersion(body.a, body.s, body.sv);
        logger.debug(services);
        _.forEach(services, function(service){
            logger.debug("Enable Service: ", service._path )
            service.enable();
        })
        ctx.body = {status:0}
        return await next();
    }
    ctx.body = {status:2, msg:"系统异常，参数错误"};
    return await next();
}

/**
 * 通过接口关闭某个服务或者某版本的服务的节点
 * 
 * ## 参数说明：
 * a: appid
 * av: app_version应用版本，如果没有提供，使用默认版本
 * s: 微服务的名称
 * sv: 微服务的版本
 * sid: 微服务节点的sid
 * 
 * ## 业务逻辑说明
 * 如果sid提供，则直接更新sid对应的服务节点的状态；
 * 如果s和sv提供，则更新某个服务下某版本的服务的所有节点的状态；
 * 
 * @param {Object} options {a:"",av:"",s:"", sid:"", sv:""}
 */
exports.deactivate = async function(ctx, next){
    // 格式化请求报文数据
    var body = {}
    try{
        body = await coparser.json(ctx)
    }catch(e){
        logger.error(e);
        return await next();
    }
    // 数据校验
    if(!body || !body.a || (!body.s && !body.sid) || (!body.sv && !body.sid)){
        ctx.body = {status:1, msg:"参数缺失"};
        return await next();
    }
    if(body.a && body.sid){
        // 根据sid启动服务
        var svc = svcPool.get(body.a, body.sid);
        if(svc){
            svc.disable();
            ctx.body = {status:0}
        }else{
            ctx.body = {status:1,msg:"service not found"}
        }
        return await next();
    }else if(body.a && body.s && body.sv){
        var services = svcCache.getServiceWithVersion(body.a, body.s, body.sv);
        _.forEach(services, function(service){
            service.disable();
        })
        ctx.body = {status:0}
        return await next();
    }
    ctx.body = {status:2, msg:"系统异常，参数错误"};
    return await next();
}


/**
 * 注册服务到注册树
 * 
 * ## 参数说明：
 * a: appid
 * av: app_version应用版本，如果没有提供，使用默认版本
 * s: 微服务的名称
 * sv: 微服务的版本
 * sid: 微服务节点的sid
 * 
 * 
 * @param {Object} options {a:"",av:"",s:"", sid:"", sv:""}
 */
exports.regist = async function(ctx, next){
    // 格式化请求报文数据
    var body = {}
    try{
        body = await coparser.json(ctx)
    }catch(e){
        logger.error(e);
        return await next();
    }
    // 数据校验
    var keys = ['a','av','s','sid','sv'];
    if(_.keys(_.pick(_.omitBy(body,_.isNil),keys)).length < keys.length){
        ctx.body = {status:1, msg:"参数缺失"};
        return await next();
    }
    var prms = new Promise((resolve, reject)=>{
            svcTree.regist({
                app: body.a,
                app_version: body.av,
                service: body.s,
                sid: body.sid
            },function(rst){
                if(rst.status == 0){
                    resolve();
                }else{
                    reject(rst);
                }
            })
        });
    prms.then(function(){
        ctx.body = {status:0}
        next();
    }).catch(function(reason){
        ctx.body = reason.msg?reason:{status:1, msg:"操作失败"}
        next();
    });
}


/**
 * 从服务注册树取消某服务的注册
 * 
 * ## 参数说明：
 * a: appid
 * av: app_version应用版本，如果没有提供，使用默认版本
 * s: 微服务的名称
 * sv: 微服务的版本
 * sid: 微服务节点的sid
 * 
 * 
 * @param {Object} options {a:"",av:"",s:"", sid:"", sv:""}
 */
exports.unregist = async function(ctx, next){
    
}

/**
 * 设置应用的默认版本号
 * 
 * ## 参数说明：
 * a: appid
 * av: app_version应用版本，应用默认的版本号
 * 
 * 
 * @param {Object} options {a:"",av:""}
 */
exports.setDefault = async function(ctx, next){
    // 格式化请求报文数据
    var body = {}
    try{
        body = await coparser.json(ctx)
    }catch(e){
        logger.error(e);
        return await next();
    }
    // 数据校验
    var keys = ['a','av'];
    if(_.keys(_.pick(_.omitBy(body,_.isNil),keys)).length < keys.length){
        ctx.body = {status:1, msg:"参数缺失"};
        return await next();
    }
    var app = svcTree.getApp(body.a);
    try{
        await new Promise((resolve, reject)=>{
            app.setDefault(body.av,function(rst){
                if(rst && rst.status == 0) resolve();
                reject(rst);
            })
        })
        ctx.body = {status:0, msg:"成功"};
    }catch(e){
        ctx.body = e;
    }
    return await next();
}

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
exports.url = async function(ctx, next){
    // 格式化请求报文数据
    var body = {}
    try{
        body = await coparser.json(ctx)
        logger.info('url', body)
    }catch(e){
        logger.error(e);
        return await next();
    }
    // 数据校验
    var keys = ['a','s'];
    if(_.keys(_.pick(_.omitBy(body,_.isNil),keys)).length < keys.length){
        ctx.body = {status:1, msg:"参数缺失"};
        return await next();
    }

    try{
        var services = await svcTree.getServices({
            app:body.a, 
            app_version:body.av, 
            service: body.s});
        ctx.body = {status:0, url: await loadBalance.pick(services)};
    }catch(e){
        logger.error(e);
        ctx.body = {status:2, msg:"获取连接URL异常"};
        return await next();
    }
    return await next();
}