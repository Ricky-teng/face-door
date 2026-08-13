import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import crypto from "crypto";


const __dirname =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const dataDir =
  process.env.DATA_DIR ||
  __dirname;

const dataFile =
  path.join(dataDir, "data.json");

const distDir =
  path.join(__dirname, "..", "dist");


// ========================================
// Storage
// ========================================

function loadStore() {

  if (!fs.existsSync(dataFile)) {
    return { people: [], logs: [] };
  }

  try {

    return JSON.parse(
      fs.readFileSync(dataFile, "utf-8")
    );

  } catch (error) {

    console.error("讀取資料失敗", error);

    return { people: [], logs: [] };

  }

}


function saveStore(store) {

  fs.writeFileSync(
    dataFile,
    JSON.stringify(store, null, 2)
  );

}


let store = loadStore();


// ========================================
// Recognizer (Python / InsightFace)
// ========================================

const RECOGNIZER_URL =
  process.env.RECOGNIZER_URL ||
  "http://127.0.0.1:5001";


async function callRecognizer(image) {

  const response =
    await fetch(
      `${RECOGNIZER_URL}/embed`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({ image })

      }
    );

  if (!response.ok) {

    throw new Error(
      `辨識服務錯誤: ${response.status}`
    );

  }

  return response.json();

}


function cosineSimilarity(a, b) {

  let dot = 0;

  let normA = 0;

  let normB = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {

    dot += a[i] * b[i];

    normA += a[i] * a[i];

    normB += b[i] * b[i];

  }

  if (
    normA === 0 ||
    normB === 0
  ) {

    return 0;
  }

  return (
    dot /
    (
      Math.sqrt(normA) *
      Math.sqrt(normB)
    )
  );

}


function matchPerson(liveEmbedding) {

  let bestMatch = null;

  for (
    const person of store.people
  ) {

    if (
      !Array.isArray(person.embeddings) ||
      person.embeddings.length === 0
    ) {

      continue;
    }

    let total = 0;

    let count = 0;

    for (
      const embedding
      of person.embeddings
    ) {

      if (
        !Array.isArray(embedding) ||
        embedding.length !==
          liveEmbedding.length
      ) {

        // 舊模型留下、維度不同的特徵值，跳過不比對
        continue;
      }

      total +=
        cosineSimilarity(
          liveEmbedding,
          embedding
        );

      count++;

    }

    if (count === 0) {
      continue;
    }

    const score = total / count;

    if (
      !bestMatch ||
      score > bestMatch.score
    ) {

      bestMatch = {
        name: person.name,
        score
      };

    }

  }

  return bestMatch;

}


// ========================================
// App
// ========================================

const app = express();

app.use(express.json({ limit: "50mb" }));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}


// ========================================
// Auth
// ========================================

const APP_PASSWORD =
  process.env.APP_PASSWORD || "";


function requireAuth(req, res, next) {

  if (!APP_PASSWORD) {

    // 沒設定密碼（本機／區網開發模式）時直接放行
    next();

    return;
  }

  const authHeader =
    req.headers.authorization || "";

  const token =
    authHeader.replace(
      /^Bearer\s+/i,
      ""
    );

  if (token !== APP_PASSWORD) {

    res.status(401).json({
      error: "未授權"
    });

    return;
  }

  next();

}


app.use("/api", requireAuth);


// ========================================
// People
// ========================================

app.get("/api/people", (req, res) => {

  res.json(store.people);

});


async function embedPhotos(photos) {

  const embeddings = [];

  for (const photo of photos) {

    const result =
      await callRecognizer(photo);

    if (result.faces === 1) {

      embeddings.push(
        result.embedding
      );

    }

  }

  return embeddings;

}


app.post("/api/people", async (req, res) => {

  const { name, photos, photo } =
    req.body;

  if (
    !name ||
    !Array.isArray(photos) ||
    photos.length === 0
  ) {

    res.status(400).json({
      error: "缺少姓名或照片"
    });

    return;
  }

  let embeddings;

  try {

    embeddings =
      await embedPhotos(photos);

  } catch (error) {

    console.error(
      "辨識服務呼叫失敗",
      error
    );

    res.status(502).json({
      error: "辨識服務無法連線"
    });

    return;
  }

  if (embeddings.length === 0) {

    res.status(400).json({
      error:
        "沒有任何照片成功偵測到單一人臉"
    });

    return;
  }

  const person = {

    id: crypto.randomUUID(),

    name,

    embeddings,

    photo: photo || null,

    createdAt: new Date().toISOString()

  };

  store.people.push(person);

  saveStore(store);

  res.status(201).json({
    ...person,
    addedCount: embeddings.length
  });

});


app.patch("/api/people/:id", async (req, res) => {

  const person =
    store.people.find(
      p => p.id === req.params.id
    );

  if (!person) {

    res.status(404).json({
      error: "找不到該人員"
    });

    return;
  }

  const { name, photos, photo } =
    req.body;

  let embeddings = [];

  if (
    Array.isArray(photos) &&
    photos.length > 0
  ) {

    try {

      embeddings =
        await embedPhotos(photos);

    } catch (error) {

      console.error(
        "辨識服務呼叫失敗",
        error
      );

      res.status(502).json({
        error: "辨識服務無法連線"
      });

      return;
    }

    if (embeddings.length === 0) {

      res.status(400).json({
        error:
          "沒有任何照片成功偵測到單一人臉"
      });

      return;
    }

  }

  if (name) {
    person.name = name;
  }

  person.embeddings.push(
    ...embeddings
  );

  if (photo && !person.photo) {
    person.photo = photo;
  }

  saveStore(store);

  res.json({
    ...person,
    addedCount: embeddings.length
  });

});


app.delete("/api/people/:id", (req, res) => {

  const exists =
    store.people.some(
      p => p.id === req.params.id
    );

  if (!exists) {

    res.status(404).json({
      error: "找不到該人員"
    });

    return;
  }

  store.people =
    store.people.filter(
      p => p.id !== req.params.id
    );

  saveStore(store);

  res.status(204).end();

});


// ========================================
// Recognize
// ========================================

app.post("/api/recognize", async (req, res) => {

  const { image } = req.body;

  if (!image) {

    res.status(400).json({
      error: "缺少 image"
    });

    return;
  }

  let embedResult;

  try {

    embedResult =
      await callRecognizer(image);

  } catch (error) {

    console.error(
      "辨識服務呼叫失敗",
      error
    );

    res.status(502).json({
      error: "辨識服務無法連線"
    });

    return;
  }

  if (embedResult.faces !== 1) {

    res.json({
      faces: embedResult.faces,
      match: null
    });

    return;
  }

  const match =
    matchPerson(
      embedResult.embedding
    );

  res.json({
    faces: 1,
    detScore: embedResult.detScore,
    match
  });

});


// ========================================
// Logs
// ========================================

app.get("/api/logs", (req, res) => {

  res.json(store.logs);

});


app.post("/api/logs", (req, res) => {

  const { name, success, score } =
    req.body;

  const log = {

    id: crypto.randomUUID(),

    name,

    success: !!success,

    score:
      typeof score === "number"
        ? score
        : null,

    time: new Date().toISOString()

  };

  store.logs.unshift(log);

  if (store.logs.length > 200) {

    store.logs =
      store.logs.slice(0, 200);

  }

  saveStore(store);

  res.status(201).json(log);

});


app.delete("/api/logs", (req, res) => {

  store.logs = [];

  saveStore(store);

  res.status(204).end();

});


// ========================================
// SPA fallback (production)
// ========================================

if (fs.existsSync(distDir)) {

  app.use((req, res) => {

    res.sendFile(
      path.join(distDir, "index.html")
    );

  });

}


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {

  console.log(
    `FaceGuard 後端已啟動：http://localhost:${PORT}`
  );

});
