/**
 * 微服务的注册是通过zk直接连接完成注册的，需要提供一个单独的服务注册库
 * 
 * 本接口定义的是需要通过接口访问修改的相关功能，比如服务激活和关闭，等
 * 
 * [ ] 服务激活
 * [ ] 服务关闭（取消激活）
 * [ ] 设置默认版本
 * [ ] 设置ongo版本
 * 
 */
var version = require("@lqb/lib").version


/**
 * 通过接口激活某个服务节点
 * 
 * @param {Object} options {app:"",service:"",sversion:""}
 */
function activate(options){

}

/**
 * 通过接口关闭某个服务节点
 * 
 * app: appid
 * service: 服务节点ID
 * sversion: 微服务的版本
 * 
 * @param {Object} options {app:"",service:"", sversion:""}
 */
function deactivate(options){
    
}
    
    
