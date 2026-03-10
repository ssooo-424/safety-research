// public/c2.js

let currentPayload = null;
let savedScenarioId = null;
let savedFilename = null;

// DOM 요소
const btnGen = document.getElementById("gen");
const outDiv = document.getElementById("out");
const toArea = document.getElementById("to-area");
const fromArea = document.getElementById("from-area");
const loadingDiv = document.getElementById("loading");

// 1. 초기 데이터 로드 (서버에서 최신 설문 가져오기)
async function init() {
  try {
    const res = await fetch("/api/last-survey");
    const json = await res.json();
    
    if (!json.ok) {
      outDiv.textContent = "설문 데이터를 찾을 수 없습니다.";
      return;
    }

    // 데이터 저장
    const record = json.record;
    // generate.js와 동일하게 data wrapper 처리
    currentPayload = (record.data && record.data.data) ? record.data.data : (record.data || record); 
    savedScenarioId = record.scenarioId;
    savedFilename = json.savedAs;

    // 이름 가져오기 (없으면 '당신')
    // profile이 바로 있을수도 있고 payload 안에 있을수도 있음
    const profile = currentPayload.profile || currentPayload.userInfo || {};
    const userName = profile.name || "당신";

    // ✅ UI에 수신인/발신인 미리 세팅
    toArea.textContent = `To. 현재의 ${userName}에게`;
    fromArea.textContent = `From. 3년 후의 ${userName}(이)가`;

    console.log("Loaded:", savedFilename);
  } catch (e) {
    console.error(e);
    outDiv.textContent = "데이터 로딩 오류 발생";
  }
}

// 2. 편지 생성 요청
btnGen.addEventListener("click", async () => {
  if (!currentPayload) return alert("설문 데이터가 없습니다.");

  // 선택된 라디오 버튼 값 (Stop / Go)
  const branch = document.querySelector('input[name="branch"]:checked').value;

  // UI 상태 변경 (로딩 중)
  btnGen.disabled = true;
  outDiv.style.display = "none";
  loadingDiv.style.display = "block";
  
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition: "C2",
        branch: branch, // Stop or Go
        payload: currentPayload,
        scenarioId: savedScenarioId,
        savedAs: savedFilename
      })
    });

    const data = await res.json();
    
    if (data.ok) {
      // ✅ 텍스트 정제: 혹시 AI가 "To. OO" 등을 또 썼다면 제거해서 본문만 깔끔하게
      let cleanText = data.text;
      
      // 1. "To. 이름" 또는 "수신인:" 같은 헤더 제거
      cleanText = cleanText.replace(/^(To\.|수신인:|받는사람:).+\n+/, ""); 
      
      // 2. "From. 이름" 같은 푸터 제거 (우리가 HTML로 따로 만들었으니까)
      cleanText = cleanText.replace(/\n+(From\.|발신인:|보내는사람:).+$/, "");

      outDiv.textContent = cleanText.trim();
    } else {
      outDiv.textContent = "오류: " + data.error;
    }
  } catch (e) {
    outDiv.textContent = "서버 통신 에러: " + e.message;
  } finally {
    // UI 복구
    btnGen.disabled = false;
    loadingDiv.style.display = "none";
    outDiv.style.display = "block";
  }
});

// 시작
init();