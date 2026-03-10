const express = require("express");
const path = require("path");
const fs = require("fs");
const { OpenAI } = require("openai"); // 🌟 OpenAI 추가

require("dotenv").config();

// 기존 내부 LLM 로직
const { generateOnce, chatOnce, generateScenarioContext } = require("./llm/generate");

const app = express();
const PORT = process.env.PORT || 3001;

// 🌟 OpenAI API 초기화
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// 🌟 [핵심 추가] 변환된 이미지 파일들을 화면(프론트)에서 볼 수 있게 정적 폴더로 개방합니다.
app.use("/images", express.static(path.join(__dirname, "data_generated", "images")));

/** =========================================================
 * 🌟 사고 사례 JSON 데이터 서버 메모리에 미리 로드
 * ========================================================= */
let accidentData = [];
try {
  const dataDir = path.join(__dirname, 'data_generated');
  const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f.startsWith('cases_'));
  if (jsonFiles.length > 0) {
    const latestJson = jsonFiles.sort().reverse()[0]; 
    const rawData = fs.readFileSync(path.join(dataDir, latestJson), 'utf-8');
    accidentData = JSON.parse(rawData);
    console.log(`✅ 사고 사례 데이터 로드 완료: ${latestJson} (총 ${accidentData.length}건)`);
  } else {
    console.log("⚠️ data_generated 폴더에 사고 사례 JSON 파일이 없습니다.");
  }
} catch (e) {
  console.log("⚠️ 사고 사례 데이터 로드 실패:", e.message);
}

/** Windows 파일명 금지 문자/공백 처리 */
function safeFilename(s = "") {
  return String(s)
    .trim()
    .replace(/[\\\/:\*\?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

/** YYYYMMDD_HHMMSS */
function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// 위험유형코드 + 트리거 코드 정렬
function makeScenarioId(riskType, triggers) {
  const riskMap = {
    "추락": "A",
    "협착·끼임": "B",
    "낙하·비래": "C",
    "충돌·접촉": "D",
    "감전·화재": "E",
    "붕괴·전도": "F",
  };

  const triggerMap = {
    "급박한 일정/압박": "T1",
    "반복·익숙함(늘 하던 일)": "T2",
    "PPE 불편/귀찮음": "T3",
    "소통 부재/신호 혼선": "T4",
    "정리정돈 미흡/통로 장애": "T5",
    "시야 제한/사각지대": "T6",
    "야간·피로·집중저하": "T7",
    "장비 혼재/동선 겹침": "T8",
  };

  const r = riskMap[riskType] ?? "X";
  const t = (triggers || []).map((x) => triggerMap[x] || "T?").sort();
  return `${r}-${t.join("")}`; 
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(dir, filename, obj) {
  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify(obj, null, 2),
    "utf-8"
  );
}

/** 1) 사전 설문 제출 저장 */
app.post("/api/submit", (req, res) => {
  const payload = req.body;
  const riskType = Array.isArray(payload?.incident?.riskType) ? payload.incident.riskType[0] : payload?.incident?.riskType;
  const triggers = payload?.incident?.triggers;
  const scenarioId = makeScenarioId(riskType, triggers);
  const dataDir = path.join(__dirname, "data");
  ensureDir(dataDir);
  const name = safeFilename(payload?.profile?.name || "noname");
  const org = safeFilename(payload?.profile?.org || "noorg");
  const filename = `${name}_${org}_${stamp()}.json`;

  const record = {
    ok: true,
    scenarioId,
    condition: null, 
    receivedAt: new Date().toISOString(),
    data: payload,
  };

  writeJson(dataDir, filename, record);
  console.log("saved:", filename);
  return res.json({ ...record, savedAs: filename });
});

/** 🌟 [핵심 추가] 1-2) 사후 설문 제출 저장 (POST) */
app.post("/api/submit-post-survey", (req, res) => {
  try {
    const payload = req.body;
    const name = safeFilename(payload.name || "미확인");
    const org = safeFilename(payload.org || "소속불명");

    // 저장 폴더 설정 (survey 폴더)
    const surveyDir = path.join(__dirname, "survey");
    ensureDir(surveyDir);

    // 파일명 구성: 이름_소속_날짜_시간.json
    const filename = `${name}_${org}_${stamp()}.json`;
    const filePath = path.join(surveyDir, filename);

    // 전체 데이터 저장
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");

    console.log(`✅ [사후설문] 저장 완료: ${filename}`);

    return res.json({ 
      ok: true, 
      filename: filename,
      message: "사후 설문 데이터가 정상적으로 저장되었습니다." 
    });
  } catch (e) {
    console.error("❌ 사후 설문 저장 실패:", e);
    return res.status(500).json({ 
      ok: false, 
      error: e.message || "서버 저장 중 오류 발생" 
    });
  }
});

/** 2) 페이지 라우트 */
app.get("/next", (req, res) => res.sendFile(path.join(__dirname, "public", "next.html")));
app.get("/choice", (req, res) => res.sendFile(path.join(__dirname, "public", "choice.html")));
app.get("/c1", (req, res) => res.sendFile(path.join(__dirname, "public", "c1.html")));
app.get("/c2", (req, res) => res.sendFile(path.join(__dirname, "public", "c2.html")));
app.get("/c3", (req, res) => res.sendFile(path.join(__dirname, "public", "c3.html")));

/** 3) C1/C2 생성(단발) */
app.post("/api/generate", async (req, res) => {
  try {
    const { condition, branch, payload, scenarioId, savedAs } = req.body;

    if (!condition) return res.status(400).json({ ok: false, error: "condition required" });
    if (!payload) return res.status(400).json({ ok: false, error: "payload required" });
    if (!scenarioId) return res.status(400).json({ ok: false, error: "scenarioId required" });

    let text = "";
    let imagePath = null;

    if (condition === "C1") {
      const userProcess = Array.isArray(payload.incident?.process) ? payload.incident.process[0] : payload.incident?.process;
      const userRiskType = Array.isArray(payload.incident?.riskType) ? payload.incident.riskType[0] : payload.incident?.riskType;
      const userTrigger = Array.isArray(payload.incident?.triggers) ? payload.incident.triggers[0] : payload.incident?.triggers;

      console.log(`🔍 [C1 사례 검색] 작업: ${userProcess}, 위험: ${userRiskType}, 원인: ${userTrigger}`);

      let matchedCases = accidentData.filter(item => 
        item.process === userProcess &&
        item.riskType === userRiskType &&
        item.trigger === userTrigger
      );

      if (matchedCases.length === 0) {
        matchedCases = accidentData.filter(item => 
          item.process === userProcess &&
          item.riskType === userRiskType
        );
      }

      const selectedCase = matchedCases.length > 0 
        ? matchedCases[Math.floor(Math.random() * matchedCases.length)] 
        : accidentData[0];

      console.log(`📄 선택된 사고 사례: ${selectedCase.fileName}`);

      const prompt = `
다음은 실제 건설현장 사고 사례 원본 데이터야:
[원본 내용]
${selectedCase.textContent}

이 내용을 바탕으로 아래 [작성 템플릿]에 맞춰 건조한 3인칭 보고서 형식으로 작성해줘. 
제시된 양식과 제목은 텍스트 그대로 유지하고, 마지막에는 반드시 "===안전수칙===" 이라는 구분선을 넣은 뒤, 이 사고를 예방하기 위한 핵심 안전수칙 3가지를 작성해.

[작성 템플릿]
사고 개요 : (원본 내용을 바탕으로 사고의 핵심을 1~2줄로 요약)
작업 종류 : ${selectedCase.process}
위험 유형 : ${selectedCase.riskType}
주요 원인 : ${selectedCase.trigger}
사고 경위 : (사고가 발생하게 된 구체적인 과정을 3인칭 관찰자 시점의 문장으로 상세하고 명확하게 작성)
===안전수칙===
1. (핵심 안전수칙 1)
2. (핵심 안전수칙 2)
3. (핵심 안전수칙 3)
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      });

      text = completion.choices[0].message.content;

      if (selectedCase.pairFileName) {
        const imageName = selectedCase.pairFileName.replace('.pdf', '.jpg').replace('.hwp', '.jpg');
        imagePath = `/images/${imageName}`;
      }

    } else {
      text = await generateOnce({ condition, branch, payload, scenarioId });
    }

    const genDir = path.join(__dirname, "data_generated");
    const base = safeFilename(String(savedAs || "nosurvey").replace(/\.json$/i, ""));
    const outName = `${base}_${condition}${branch ? "_" + safeFilename(branch) : ""}_${stamp()}.json`;

    const record = {
      ok: true,
      condition,
      branch: branch || null,
      scenarioId,
      createdAt: new Date().toISOString(),
      surveyFile: savedAs || null,
      output: { text },
      imagePath 
    };

    writeJson(genDir, outName, record);
    console.log("generated:", outName);

    return res.json({ ok: true, text, savedAs: outName, imagePath });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/** 4) C3 채팅(멀티턴) */
app.post("/api/chat", async (req, res) => {
  try {
    const { payload, scenarioId, branch, messages } = req.body;

    if (!payload) return res.status(400).json({ ok: false, error: "payload required" });
    if (!scenarioId) return res.status(400).json({ ok: false, error: "scenarioId required" });
    if (!branch) return res.status(400).json({ ok: false, error: "branch(Stop/Go) required" });
    if (!Array.isArray(messages)) return res.status(400).json({ ok: false, error: "messages required" });

    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: m.text || m.content || "" 
    }));

    const assistant = await chatOnce({ 
      payload, 
      scenarioId, 
      branch, 
      messages: formattedMessages 
    });

    return res.json({ ok: true, assistant });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/** 5) Choice 페이지 상황 묘사 생성 API */
app.post("/api/context", async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ ok: false, error: "No payload provided" });

    const contextText = await generateScenarioContext(payload);
    return res.json({ ok: true, text: contextText });
  } catch (e) {
    console.error("Context API Error:", e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ✅ 가장 최근 사전 설문(JSON) 가져오기
app.get("/api/last-survey", (req, res) => {
  try {
    const dir = path.join(__dirname, "data");
    if (!fs.existsSync(dir)) return res.status(404).json({ ok: false, error: "data folder not found" });
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (!files.length) return res.status(404).json({ ok: false, error: "no survey files" });
    
    let latestFile = files[0];
    let latestTime = fs.statSync(path.join(dir, latestFile)).mtimeMs;
    for (const f of files.slice(1)) {
      const t = fs.statSync(path.join(dir, f)).mtimeMs;
      if (t > latestTime) { latestTime = t; latestFile = f; }
    }
    const fullPath = path.join(dir, latestFile);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const record = JSON.parse(raw);
    return res.json({ ok: true, savedAs: latestFile, mtimeMs: latestTime, record });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "failed to load last survey" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});