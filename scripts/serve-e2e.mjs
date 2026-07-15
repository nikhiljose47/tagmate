import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number.parseInt(process.env.PORT ?? '8788', 10);
const root = resolve('dist/browser');
const index = join(root, 'index.csr.html');
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host}`).pathname);
  const candidate = resolve(root, `.${normalize(pathname)}`);
  const isWithinRoot = candidate === root || candidate.startsWith(`${root}\\`) || candidate.startsWith(`${root}/`);
  const file = isWithinRoot && existsSync(candidate) && (await stat(candidate)).isFile() ? candidate : index;

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`E2E static server listening on http://127.0.0.1:${port}`);
});
