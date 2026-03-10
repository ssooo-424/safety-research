// public/c1.js
const outEl = document.getElementById("out");
const genBtn = document.getElementById("gen");
const backBtn = document.getElementById("back");
const metaEl = document.getElementById("meta");

function loadSurvey() {
  const raw = localStorage.getItem("preSurveyResult");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const survey = loadSurvey();
if (!survey) {
  outEl.textContent = "설문 결과가 없어요. / 로 돌아가서 설문을 제출해주세요.";
  genBtn.disabled = true;
} else {
  metaEl.textContent = `scenarioId=${survey.scenarioId} / surveyFile=${survey.savedAs}`;
}

genBtn.addEventListener("click", async () => {
  if (!survey) return;
  genBtn.disabled = true;
  outEl.textContent = "생성 중...";

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition: "C1",
        payload: survey.data,
        scenarioId: survey.scenarioId,
        savedAs: survey.savedAs,
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "failed");
    outEl.textContent = json.text + `\n\n(저장: data_generated/${json.savedAs})`;
  } catch (e) {
    outEl.textContent = "생성 실패. 서버 콘솔/키 설정(.env)을 확인해주세요.";
  } finally {
    genBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => {
  window.location.href = "/next";
});
