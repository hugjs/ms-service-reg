const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:20001/ws-url');

ws.on('open', function open() {
 console.log('connected');
 ws.send(JSON.stringify({
   a:"base",
   s:"echo"
 }));
});

ws.on('close', function close() {
 console.log('disconnected');
});

ws.on('message', function incoming(data) {
 console.log(`new message: ${data}`);
});