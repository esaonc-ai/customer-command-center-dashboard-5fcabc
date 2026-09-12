const fs = require('fs');
const http = require('http');
const path = require('path');

const host = '0.0.0.0';
const port = 4173;
const root = __dirname;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function resolveWithin(baseDirectory, relativePath) {
  const base = path.resolve(root, baseDirectory);
  const candidate = path.resolve(base, relativePath);
  return candidate.startsWith(base + path.sep) ? candidate : null;
}

function resolveRequestPath(pathname) {
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/') {
    return path.join(root, 'dashboard', 'index.html');
  }
  if (pathname === '/config.json') return path.join(root, 'public', 'config.json');
  if (pathname.startsWith('/data/')) return resolveWithin('public/data', pathname.slice('/data/'.length));
  if (pathname.startsWith('/css/')) return resolveWithin('css', pathname.slice('/css/'.length));
  if (pathname.startsWith('/js/')) return resolveWithin('js', pathname.slice('/js/'.length));
  return null;
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  const filePath = resolveRequestPath(pathname);

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Unable to load page');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Customer Command Center preview: http://${host}:${port}/dashboard`);
});
