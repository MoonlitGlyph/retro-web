# rusty-web

Install dependencies and start the Vite development server:

```sh
cd rusty-web
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

The interface expects the Rusty-ROM service at the same origin. It reads
`GET /api/health` for collection status and sends ROM uploads to
`POST /api/roms` as a multipart field named `file`. Until the Rust service is
running, the page still renders, but status and upload requests will report
that the service is unavailable.

When the Rusty-ROM service runs on another local port, set its address before
starting Vite:

```sh
RUSTY_ROM_API=http://127.0.0.1:3000 npm run dev
```

Create a production bundle with:

```sh
npm run build
```
