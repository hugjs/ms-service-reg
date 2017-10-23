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
var version = require("@lqb/lib").version


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
 * @param {Object} options {a:"",av:"",:"", sid:"", sv:""}
 */
function activate(options){

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
function deactivate(options){
    
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
function regist(options){
    
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
function unregist(options){
    
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
function setDefault(options){

}
