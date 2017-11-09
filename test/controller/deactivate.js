var request = require('request')

request.post({
    url:"http://localhost:20001/deactivate", 
    header:{
        'content-type': 'application/json'
    },
    body:JSON.stringify({
        a:'base1',
        // sid:"cj9rvc2xp0000ugqmwoy0qmk1", 
        s:"common", 
        sv:"0.0.1"
    }),
},
function (error, response, body) {
    if (error) {
      return console.error('req failed:', error);
    }
    console.log('body:%s', body);
})