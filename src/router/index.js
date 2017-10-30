
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger(path.relative(process.cwd(),module.id));
var Router = require('koa-router');
var router = new Router();
var registerCtrl = require('../controller/register')
var cuid = require('cuid');

// error handling 
router.use(async (ctx,next) => {
    try{
        ctx.traceid = await cuid();
        logger.info("%s, ctx.request: %s",ctx.traceid, JSON.stringify(ctx.request));
        await next();
        logger.info("%s, reps: %s",ctx.traceid, JSON.stringify(ctx.body?ctx.body:""));
    }catch(e){
        logger.error("%s, error: %s",ctx.traceid, JSON.stringify(e));
    }
});

// check sign 
router.use(async (ctx,next) => {
    // check sign here
    logger.debug("%s, check sign", ctx.traceid);
    await next();
});

router.post('/activate', registerCtrl.activate);

module.exports = router;