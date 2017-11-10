var request = require('request')

request.post({
    url:"http://localhost:20001/url", 
    header:{
        'content-type': 'application/json'
    },
    body:JSON.stringify({
        a:'base',
        av:'1.0.0',
        s:'common'
    }),
},
function (error, response, body) {
    if (error) {
      return console.error('req failed:', error);
    }
    console.log('body:%s', body);
})