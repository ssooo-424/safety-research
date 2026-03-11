// public/next.js
const outEl = document.getElementById("out");
const goBtn = document.getElementById("go");
const backBtn = document.getElementById("back");

const scenPill = document.getElementById("scenPill");
const filePill = document.getElementById("filePill");

// ✅ 추가: 최근 설문 불러오기 버튼 (next.html에 id="loadLatest" 있어야 함)
const loadLatestBtn = document.getElementById("loadLatest");

function setPills(parsed) {
  scenPill.textContent = `시나리오ID: ${parsed?.scenarioId ?? "-"}`;
  filePill.textContent = `저장파일: ${parsed?.savedAs ?? "-"}`;
}

function getSelectedCondition() {
  const el = document.querySelector('input[name="cond"]:checked');
  return el ? el.value : null;
}

function renderFromLocalStorage() {
  const raw = localStorage.getItem("preSurveyResult");

  if (!raw) {
    outEl.textContent = "저장된 결과가 없어요. / 로 돌아가서 설문을 제출해 주세요.";
    setPills(null);
    goBtn.disabled = true;
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    outEl.textContent = raw;
    setPills(parsed);
    goBtn.disabled = false;
    return parsed;
  } catch (e) {
    outEl.textContent = "결과 JSON 파싱에 실패했어요. localStorage 값을 확인해주세요.";
    setPills(null);
    goBtn.disabled = true;
    return null;
  }
}

// ✅ 페이지 로드 시 렌더
let parsed = renderFromLocalStorage();

// ✅ 이동 버튼: 조건 선택 후 무조건 choice.html로 이동하도록 수정됨
goBtn.addEventListener("click", () => {
  const cond = getSelectedCondition();
  if (!cond) return alert("C1/C2/C3 중 하나를 선택해주세요.");

  localStorage.setItem("chosenCondition", cond);

  // ★ 변경된 부분: 조건에 상관없이 무조건 '위험 시나리오(choice.html)' 페이지로 이동!
  window.location.href = "/choice.html";
});

// ✅ 뒤로가기
backBtn.addEventListener("click", () => {
  window.location.href = "/";
});

// ✅ 최근 설문 불러오기: 서버의 /api/last-survey 호출 → localStorage 갱신 → 화면 갱신
async function loadLatestSurvey() {
  try {
    if (!loadLatestBtn) return;

    loadLatestBtn.disabled = true;
    loadLatestBtn.textContent = "불러오는 중...";

    const res = await fetch("/api/last-survey");
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.error || "load failed");

    // 서버가 준 최신 record를 localStorage에 저장
    const record = out.record || null;
    if (!record) throw new Error("no record");

    // record에 savedAs 없으면 서버 응답 savedAs로 보강
    record.savedAs = record.savedAs || out.savedAs;

    localStorage.setItem("preSurveyResult", JSON.stringify(record, null, 2));

    // 화면 갱신(리로드 없이 재렌더)
    parsed = renderFromLocalStorage();

    alert(`최근 설문을 불러왔어요!\n파일: ${record.savedAs || "-"}`);
  } catch (e) {
    alert("최근 설문 불러오기 실패: data 폴더에 json이 있는지 / 서버 실행 중인지 확인해주세요.");
  } finally {
    if (loadLatestBtn) {
      loadLatestBtn.disabled = false;
      loadLatestBtn.textContent = "최근 설문 불러오기";
    }
  }
}

if (loadLatestBtn) {
  loadLatestBtn.addEventListener("click", loadLatestSurvey);
}
