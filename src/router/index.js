
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.relative(process.cwd(),module.id));
var Router = require('koa-router');
var router = new Router();
var registerCtrl = require('../controller/register')
var cuid = require('cuid');
var coparser = require('co-body');

// error handling 
router.use(async (ctx,next) => {
    try{
        ctx.traceid = await cuid();
        logger.info("%s, ctx.request: %s",ctx.traceid, JSON.stringify(ctx.request));
        // logger.info("%s, ctx.request.body: %s",ctx.traceid, ctx.req.body);
        await next();
        logger.info("%s, reps: %s",ctx.traceid, JSON.stringify(ctx.body?ctx.body:""));
    }catch(e){
        logger.error("%s, error: %o",ctx.traceid, e);
    }
});

// check sign 
router.use(async (ctx,next) => {
    // check sign here
    logger.debug("%s, check sign", ctx.traceid);
    await next();
});

router.post('/regist', registerCtrl.regist);
router.post('/activate', registerCtrl.activate);
router.post('/deactivate', registerCtrl.deactivate);
router.post('/setdefault', registerCtrl.setDefault);
router.post('/url', registerCtrl.url);

module.exports = router;