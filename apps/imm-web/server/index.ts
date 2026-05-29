import express from "express";
import path from "node:path";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { executeImm } from "./sandbox.js";
import { getEngineInfo, listRuntimes } from "./immBinary.js";
import { getVscodeExtensionDownloadUrl, getVscodeExtensionInfo, listDownloads } from "./downloads.js";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const app = express();

app.use(express.json({ limit: "96kb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const engine = await getEngineInfo();
    const runtimes = await listRuntimes();
    res.json({
      ok: true,
      engine,
      runtimes,
      sandbox: {
        macOsSandboxRequested: process.env.IMM_WEB_DISABLE_OS_SANDBOX !== "1",
        maxSourceBytes: 64 * 1024,
        maxTimeoutMs: 8_000
      }
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/runtimes", async (req, res) => {
  try {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    res.json({ ok: true, runtimes: await listRuntimes(refresh) });
  } catch (error) {
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/downloads", async (req, res) => {
  const refresh = req.query.refresh === "1" || req.query.refresh === "true";
  const payload = await listDownloads(refresh);
  res.status(payload.ok ? 200 : 503).json(payload);
});

app.get("/api/vscode-extension", async (req, res) => {
  const refresh = req.query.refresh === "1" || req.query.refresh === "true";
  const payload = await getVscodeExtensionInfo(refresh);
  res.status(payload.ok ? 200 : 503).json(payload);
});

app.get("/downloads/vscode/latest.vsix", async (_req, res) => {
  try {
    res.redirect(302, await getVscodeExtensionDownloadUrl());
  } catch (error) {
    res.status(404).send(error instanceof Error ? error.message : String(error));
  }
});

app.post("/api/run", async (req, res) => {
  try {
    const result = await executeImm({
      source: req.body?.source,
      mode: "run",
      runtimeId: req.body?.runtimeId,
      trace: Boolean(req.body?.trace),
      timeoutMs: req.body?.timeoutMs
    });
    res.status(result.ok ? 200 : 422).json(result);
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/check", async (req, res) => {
  try {
    const result = await executeImm({
      source: req.body?.source,
      mode: "check",
      runtimeId: req.body?.runtimeId,
      timeoutMs: req.body?.timeoutMs
    });
    res.status(result.ok ? 200 : 422).json(result);
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

const clientDir = path.join(process.cwd(), "dist", "client");
try {
  await access(clientDir, constants.R_OK);
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && req.accepts("html")) {
      res.sendFile(path.join(clientDir, "index.html"));
      return;
    }
    next();
  });
} catch {
  // The Vite dev server serves the client during npm run dev.
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`IMM Web Runner API listening on http://127.0.0.1:${PORT}`);
});
