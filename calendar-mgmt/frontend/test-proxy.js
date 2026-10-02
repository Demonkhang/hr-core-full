const http = require('http');
const data = JSON.stringify({username: 'admin', password: 'Admin@123', remember_me: false});
const req = http.request({
  hostname: 'localhost',
  port: 5174,
  path: '/api/hr/auth/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)}
}, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => { console.log(res.statusCode, body); });
});
req.write(data);
req.end();
