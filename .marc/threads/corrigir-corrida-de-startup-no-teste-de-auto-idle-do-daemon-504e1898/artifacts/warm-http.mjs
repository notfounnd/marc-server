import http from 'node:http';

const server = http.createServer((_request, response) => response.end('warmup'));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
await response.text();
await new Promise((resolve) => server.close(resolve));

