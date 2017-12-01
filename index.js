
const config = require('config')
const noop = function(){}
const path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger("app.index");
require('./log')

const strg = require("./src/" + config.get('storage.name'))

strg.once('ready',function(){
    logger.info('Storage Ready.....');
    require("./app.js")
    logger.info('Web API Listening on Port %s .....', config.get("server.port"));
})
strg.init(config.get('storage.options'))