const express = require("express");
const path = require("path");
const fs = require("fs");
const { OpenAI } = require("openai"); 
const { google } = require("googleapis"); // 🌟 구글 시트 라이브러리 추가

require("dotenv").config();

// 기존 내부 LLM 로직
const { generateOnce, chatOnce, generateScenarioContext } = require("./llm/generate");

const app = express();
const PORT = process.env.PORT || 3001;

// OpenAI API 초기화
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "data_generated", "images")));

/** =========================================================
 * 🌟 [핵심] 통계 분석용 엑셀 데이터 분할 함수 (새로 추가됨)
 * ========================================================= */
function makeFlatRow(type, timeStr, name, org, scenarioId, dataPayload) {
  // A열 ~ AW열까지 총 49칸의 빈 배열 생성
  const row = new Array(49).fill("");
  row[0] = timeStr; 
  row[1] = type; 
  row[2] = name; 
  row[3] = org; 
  row[4] = scenarioId;
  row[48] = typeof dataPayload === "string" ? "" : JSON.stringify(dataPayload); // 49번째 칸: 원본 데이터 백업

  if (type === "1.사전설문") {
    const p = dataPayload.profile || {};
    const i = dataPayload.incident || {};
    const ps = dataPayload.psychology || {};
    
    row[5] = (p.jobType || []).join(", ");
    row[6] = p.position || "";
    row[7] = p.career || "";
    row[8] = p.importantPerson || "";
    
    // BFI 성향 1~10 (J열 ~ S열)
    for(let j=1; j<=10; j++) row[8+j] = ps.bfi?.[`q${j}`] || "";
    
    row[19] = (i.process || []).join(", ");
    row[20] = i.riskType || "";
    row[21] = (i.triggers || []).join(", ");
    row[22] = i.sentence || ""; 
    row[23] = i.consequence || ""; 
    row[24] = i.feeling || "";
    row[25] = (ps.riskBarriers || []).join(", ");
    row[26] = ps.extraComment || "";

    // 사전 위험지각 R1~R3 (AB~AD열)
    row[27] = ps.attitude?.q13 || ""; 
    row[28] = ps.attitude?.q14 || ""; 
    row[29] = ps.attitude?.q15 || "";

  } else if (type === "3.사후설문") {
    const d = dataPayload.data || {};
    
    // 사후 위험지각 R1~R3 (사전점수와 같은 열인 AB~AD열에 위치하여 비교 편하게)
    row[27] = d.R1 || ""; 
    row[28] = d.R2 || ""; 
    row[29] = d.R3 || "";

    // 사후 경험품질 P1, P2 (AE~AK열)
    row[30] = d.P1_1 || ""; row[31] = d.P1_2 || ""; row[32] = d.P1_3 || "";
    row[33] = d.P2_1 || ""; row[34] = d.P2_2 || ""; row[35] = d.P2_3 || ""; row[36] = d.P2_4 || "";
    
    // 감정 반응 D1, D2 (AL~AM열)
    row[37] = d.D1 || ""; row[38] = d.D2 || "";
    
    // POST 인터뷰 1~9 (AN~AV열)
    for(let j=1; j<=9; j++) row[38+j] = d[`interview_${j}`] || "";

  } else if (type.includes("2.리포트생성")) {
    // 리포트 텍스트는 맨 마지막 열(AW열)에 통째로 저장
    row[48] = dataPayload.reportText || "";
  }
  return row;
}

/** =========================================================
 * 🌟 구글 시트 자동 저장 함수
 * ========================================================= */
async function appendToGoogleSheet(values) {
  try {
    // Render 환경 변수가 세팅되어 있지 않으면 작동하지 않고 넘어감
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SHEET_ID) return;
    
    // 환경변수에 넣은 JSON 키를 파싱해서 구글 인증
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    
    const sheets = google.sheets({ version: "v4", auth });
    
    // 시트의 빈 줄(A1부터)을 찾아 자동으로 데이터를 한 줄 추가함
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "A1", 
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] }
    });
    console.log("✅ 구글 시트 전송 성공!");
  } catch (error) {
    console.error("❌ 구글 시트 전송 실패:", error.message);
  }
}

/** =========================================================
 * 사고 사례 JSON 데이터 서버 메모리에 미리 로드
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

function safeFilename(s = "") {
  return String(s).trim().replace(/[\\\/:\*\?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 40);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function makeScenarioId(riskType, triggers) {
  const riskMap = { "추락": "A", "협착·끼임": "B", "낙하·비래": "C", "충돌·접촉": "D", "감전·화재": "E", "붕괴·전도": "F" };
  const triggerMap = {
    "급박한 일정/압박": "T1", "반복·익숙함(늘 하던 일)": "T2", "PPE 불편/귀찮음": "T3", "소통 부재/신호 혼선": "T4",
    "정리정돈 미흡/통로 장애": "T5", "시야 제한/사각지대": "T6", "야간·피로·집중저하": "T7", "장비 혼재/동선 겹침": "T8"
  };
  const r = riskMap[riskType] ?? "X";
  const t = (triggers || []).map((x) => triggerMap[x] || "T?").sort();
  return `${r}-${t.join("")}`; 
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeJson(dir, filename, obj) {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(obj, null, 2), "utf-8");
}

/** =========================================================
 * 라우트 및 API 설정
 * ========================================================= */

// 🌟 주소창에 아무것도 안 쳤을 때 index.html 띄우기
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.get("/next", (req, res) => res.sendFile(path.join(__dirname, "public", "next.html")));
app.get("/choice", (req, res) => res.sendFile(path.join(__dirname, "public", "choice.html")));
app.get("/c1", (req, res) => res.sendFile(path.join(__dirname, "public", "c1.html")));
app.get("/c2", (req, res) => res.sendFile(path.join(__dirname, "public", "c2.html")));
app.get("/c3", (req, res) => res.sendFile(path.join(__dirname, "public", "c3.html")));

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

  const record = { ok: true, scenarioId, condition: null, receivedAt: new Date().toISOString(), data: payload };
  writeJson(dataDir, filename, record);
  console.log("saved:", filename);

  // 🌟 구글 시트로 데이터 쏘기 (분할 로직 적용)
  const timeStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const flatRow = makeFlatRow("1.사전설문", timeStr, name, org, scenarioId, payload);
  appendToGoogleSheet(flatRow);

  return res.json({ ...record, savedAs: filename });
});

/** 1-2) 사후 설문 제출 저장 */
app.post("/api/submit-post-survey", (req, res) => {
  try {
    const payload = req.body;
    const name = safeFilename(payload.name || "미확인");
    const org = safeFilename(payload.org || "소속불명");
    const surveyDir = path.join(__dirname, "survey");
    ensureDir(surveyDir);
    const filename = `${name}_${org}_${stamp()}.json`;
    fs.writeFileSync(path.join(surveyDir, filename), JSON.stringify(payload, null, 2), "utf-8");
    console.log(`✅ [사후설문] 저장 완료: ${filename}`);

    // 🌟 구글 시트로 데이터 쏘기 (분할 로직 적용)
    const timeStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const flatRow = makeFlatRow("3.사후설문", timeStr, name, org, "", payload);
    appendToGoogleSheet(flatRow);

    return res.json({ ok: true, filename: filename, message: "사후 설문 데이터가 정상적으로 저장되었습니다." });
  } catch (e) {
    console.error("❌ 사후 설문 저장 실패:", e);
    return res.status(500).json({ ok: false, error: e.message || "서버 저장 중 오류 발생" });
  }
});

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

      let matchedCases = accidentData.filter(item => item.process === userProcess && item.riskType === userRiskType && item.trigger === userTrigger);
      if (matchedCases.length === 0) {
        matchedCases = accidentData.filter(item => item.process === userProcess && item.riskType === userRiskType);
      }
      const selectedCase = matchedCases.length > 0 ? matchedCases[Math.floor(Math.random() * matchedCases.length)] : accidentData[0];

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
    const record = { ok: true, condition, branch: branch || null, scenarioId, createdAt: new Date().toISOString(), surveyFile: savedAs || null, output: { text }, imagePath };
    
    writeJson(genDir, outName, record);
    console.log("generated:", outName);

    // 🌟 구글 시트로 데이터 쏘기 (분할 로직 적용)
    const timeStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const name = payload?.profile?.name || "미상";
    const org = payload?.profile?.org || "미상";
    const flatRow = makeFlatRow(`2.리포트생성(${condition})`, timeStr, name, org, scenarioId, { reportText: text });
    appendToGoogleSheet(flatRow);

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
    if (!payload || !scenarioId || !branch || !Array.isArray(messages)) return res.status(400).json({ ok: false, error: "invalid request" });

    const formattedMessages = messages.map(m => ({ role: m.role, content: m.text || m.content || "" }));
    const assistant = await chatOnce({ payload, scenarioId, branch, messages: formattedMessages });
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

/** 가장 최근 사전 설문(JSON) 가져오기 */
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
