import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "store.json");

function loadStore() {
  try {
    const t = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(t);
    if (j && typeof j === "object" && j.collections) return j;
  } catch {
    // ignore
  }
  return { collections: {}, updatedAt: null };
}

function saveStore(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_, res) => res.json({ ok: true, service: "pharmacy-sync" }));

app.get("/api/sync/:key", (req, res) => {
  const d = loadStore();
  res.json(d.collections[req.params.key] ?? null);
});

app.put("/api/sync/:key", (req, res) => {
  const d = loadStore();
  d.collections[req.params.key] = req.body;
  d.updatedAt = new Date().toISOString();
  saveStore(d);
  res.json({ ok: true });
});

app.post("/api/sync/bulk", (req, res) => {
  const d = loadStore();
  const cols = req.body?.collections;
  if (cols && typeof cols === "object") {
    Object.assign(d.collections, cols);
  }
  d.updatedAt = new Date().toISOString();
  saveStore(d);
  res.json({ ok: true });
});

app.get("/api/sync/bulk", (_, res) => {
  const d = loadStore();
  res.json({ collections: d.collections, updatedAt: d.updatedAt });
});

const PORT = Number(process.env.PORT) || 3847;
app.listen(PORT, () => {
  console.log(`Pharmacy sync server http://127.0.0.1:${PORT}`);
});
