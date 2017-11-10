/**
 * 
 */
const config = require('config')
const noop = function(){}
const path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.relative(process.cwd(),module.id));

let balancer = null;

try{
    balancer = require(config.has('loadbalance')?'./'+config.get('loadbalance'):"./P2cBalancer")
}catch(e){
    logger.error('load balancer failed.', e);
    balancer = require('./P2cBalancer');
}

exports.pick = async function(services){
    return await balancer.pick(services);
}