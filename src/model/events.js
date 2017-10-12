
/**
 * 模块级事件默认支持的方法
 * 
 * 定义部分：
 * ```
 * var eventbus = new Events.EventEmitter();
 * 
 * require('../model/events').EVENTS.forEach(function (key) {
 *  module.exports[key] = eventbus[key];
 * });
 * ```
 * 模块内部使用：
 * ```
 * module.exports.emit('ChildAdded',{parent: this, child: node});
 * ```
 * 模块引用方式使用：
 * ```
 * node.emit('eventname',{data:1});
 * node.on('eventname',function(data){});
 * node.once('eventname',function(data){});
 * 
 * ```
 * 
 */
exports.EVENTS = ['emit', 'on', 'once', 'removeListener'];