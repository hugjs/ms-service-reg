var request = require('request')

request.post({
    url:"http://localhost:20001/setdefault", 
    header:{
        'content-type': 'application/json'
    },
    body:JSON.stringify({
        a:'base1',
        av:'1.0.1'
    }),
},
function (error, response, body) {
    if (error) {
      return console.error('req failed:', error);
    }
    console.log('body:%s', body);
})