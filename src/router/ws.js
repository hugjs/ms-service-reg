
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.relative(process.cwd(),module.id));
var Router = require('koa-router');
var router = new Router();
var wsCtrl = require('../controller/ws')

router.post('/ws-url', wsCtrl.enter);

module.exports = router;