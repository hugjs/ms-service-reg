var noop = function(){};
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger('zk-help');
var zookeeper = require('node-zookeeper-client');

exports.addlogs = function(client, domain){
    domain = domain || '';
    client.on('connected', () => {
        try{
            setInterval(()=>{
                    client.exists("/",null, ()=>{
                        logger.debug(domain, 'check exists');
                    })
                }, 
                client.options.sessionTimeout || 2000
            );
            logger.info(domain, 'connected on ', 
                `${client.connectionManager.socket.remoteAddress}:${client.connectionManager.socket.remotePort}`);
        }catch(e){}
        
    });
    client.on('disconnected', () => {
        try{
            logger.error(domain, 'disconnected', 
                `${client.connectionManager.socket.remoteAddress}:${client.connectionManager.socket.remotePort}`);
        }catch(e){}
    })
    client.on('expired', () => {
        try{
            logger.error(domain, 'expired', 
                `${client.connectionManager.socket.remoteAddress}:${client.connectionManager.socket.remotePort}`);
        }catch(e){}
    })
}