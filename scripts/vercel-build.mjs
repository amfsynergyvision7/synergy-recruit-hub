// Packages the Vite/TanStack Start build output into Vercel's Build Output API v3
// format directly, bypassing Vercel's zero-config framework auto-detection entirely
// (which does not recognize this app's client/server split output).
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, ".vercel", "output");

console.log("[vercel-build] running vite build...");
execSync("npx vite build", { stdio: "inherit", cwd: root });

console.log("[vercel-build] assembling .vercel/output...");
rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "static"), { recursive: true });
mkdirSync(path.join(out, "functions", "index.func"), { recursive: true });

// Static assets straight from the client build
cpSync(path.join(root, "dist", "client"), path.join(out, "static"), { recursive: true });

// Server bundle + its assets, plus a thin Node.js request/response adapter
const funcDir = path.join(out, "functions", "index.func");
cpSync(path.join(root, "dist", "server"), funcDir, { recursive: true });

writeFileSync(
  path.join(funcDir, "index.mjs"),
  `import server from "./server.js";

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const url = \`\${proto}://\${host}\${req.url}\`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const request = new Request(url, { method: req.method, headers, body });
  const response = await server.fetch(request, {}, {});

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  }
  res.end();
}
`
);

writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
    },
    null,
    2
  )
);

writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2
  )
);

console.log("[vercel-build] done.");
