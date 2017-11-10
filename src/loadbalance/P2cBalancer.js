const config = require('config')
const noop = function(){}
const path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.relative(process.cwd(),module.id));

const P2cBalancer = require('load-balancers').P2cBalancer

/**
 * 
 */
exports.pick = async function(services){
    const balancer = new P2cBalancer(services.length);
    const service = services[balancer.pick()];
    return service.getUrl();
}