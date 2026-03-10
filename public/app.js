// public/app.js

// [중요] HTML의 단계 수와 맞춰야 합니다. (보통 5단계)
const totalSteps = 5; 
let currentStep = 1;

// DOM 요소 가져오기
const stepError = document.getElementById("stepError");
const progressPill = document.getElementById("progressPill");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const loadBtn = document.getElementById("loadLastBtn");
const addPersonBtn = document.getElementById("addPersonBtn");
const personList = document.getElementById("personList");

let bfiScores = null; // BFI 점수 저장 변수

// 에러 메시지 표시
function showError(msg) {
  if (stepError) {
    stepError.textContent = msg;
    stepError.style.display = msg ? "block" : "none";
  } else if (msg) {
    alert(msg);
  }
}

// 단계 이동 로직
function setStep(step) {
  currentStep = step;
  
  // 모든 단계를 숨기고 현재 단계만 표시
  document.querySelectorAll(".step").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) === currentStep);
  });

  // 상단 진행바 업데이트
  if (progressPill) progressPill.textContent = `Step ${currentStep} / ${totalSteps}`;
  
  // 버튼 상태 업데이트 (첫 단계에선 이전 버튼 비활성, 마지막 단계에선 '제출'로 변경)
  if (prevBtn) prevBtn.disabled = currentStep === 1;
  if (nextBtn) nextBtn.textContent = currentStep === totalSteps ? "제출하기" : "다음";
  
  showError(""); // 에러 메시지 초기화
  window.scrollTo(0, 0); // 스크롤 최상단으로
}

// Checkbox(Chips) 값 가져오기
function getChecked(groupName) {
  const boxes = document.querySelectorAll(`[data-group="${groupName}"] input:checked`);
  return Array.from(boxes).map(b => b.value);
}

// 소중한 사람 상세정보 가져오기
function getPersonDetails() {
  const inputs = document.querySelectorAll(".person-detail");
  return Array.from(inputs).map(i => i.value.trim()).filter(v => v);
}

// --- [기능] 인원 추가 ---
if (addPersonBtn) {
  addPersonBtn.addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "person-entry";
    div.innerHTML = `
      <input type="text" class="person-detail" placeholder="예: 이름, 나이 등" />
      <button type="button" class="btn-del">삭제</button>
    `;
    div.querySelector(".btn-del").addEventListener("click", () => div.remove());
    if (personList) personList.appendChild(div);
  });
}

// --- [데이터] BFI 질문 리스트 ---
const bfiQuestions = [
  { id: 1, text: "과묵하다고 본다 (말수가 적음)" },
  { id: 2, text: "대체로 믿을 만한 사람이라고 본다" },
  { id: 3, text: "일을 철저히 하는 사람이라고 본다" },
  { id: 4, text: "느긋하며 스트레스를 잘 해소하는 편이다" },
  { id: 5, text: "상상력이 풍부한 사람이라고 본다" },
  { id: 6, text: "외향적이고 사교적인 사람이라고 본다" },
  { id: 7, text: "다른 사람의 흠을 잘 잡는 편이다" },
  { id: 8, text: "게으른 경향이 있는 사람이라고 본다" },
  { id: 9, text: "신경이 예민한 편이다" },
  { id: 10, text: "예술적 관심이 거의 없는 편이다" }
];

// --- [렌더링] BFI 질문 그리기 (카드형 디자인 적용) ---
function renderBfi() {
  const container = document.getElementById("bfiContainer");
  // 컨테이너가 없거나 이미 그려져 있으면 중단
  if (!container || container.innerHTML.trim() !== "") return;

  // 상단 가이드(범례)
  const guideHTML = `
    <div class="bfi-guide">
      <span>⬅️ 전혀 그렇지 않다 (1)</span>
      <span>매우 그렇다 (5) ➡️</span>
    </div>
    <div class="bfi-container">
  `;

  let itemsHTML = "";

  bfiQuestions.forEach((q) => {
    let optionsHTML = "";
    for (let i = 1; i <= 5; i++) {
      let desc = "";
      if (i === 1) desc = "전혀아님";
      if (i === 5) desc = "매우그럼";
      
      optionsHTML += `
        <label class="bfi-opt-label">
          <input type="radio" name="bfi_q${q.id}" value="${i}">
          <div class="bfi-circle">${i}</div>
          <span class="bfi-desc">${desc}</span>
        </label>
      `;
    }

    itemsHTML += `
      <div class="bfi-item">
        <div class="bfi-q-text">Q${q.id}. 나는 ${q.text}</div>
        <div class="bfi-scale">
          ${optionsHTML}
        </div>
      </div>
    `;
  });

  container.innerHTML = guideHTML + itemsHTML + "</div>";
}

// --- [계산] BFI 점수 계산 로직 ---
function calcBfi() {
  // 1. 모든 문항 체크 여부 확인
  for(let q of bfiQuestions) {
    const checked = document.querySelector(`input[name="bfi_q${q.id}"]:checked`);
    if(!checked) return false; // 하나라도 체크 안되면 false 반환
  }

  // 2. 값 가져오기
  const getVal = (id) => Number(document.querySelector(`input[name="bfi_q${id}"]:checked`).value);
  
  // 3. 역채점 로직 (6 - 점수)
  const rev = (score) => 6 - score;

  // 4. 성격 5요인 계산
  bfiScores = {
    Extraversion:       rev(getVal(1)) + getVal(6),
    Agreeableness:      getVal(2) + rev(getVal(7)),
    Conscientiousness:  getVal(3) + rev(getVal(8)),
    Neuroticism:        rev(getVal(4)) + getVal(9),
    Openness:           getVal(5) + rev(getVal(10))
  };

  localStorage.setItem("bfiScores", JSON.stringify(bfiScores));
  return true;
}

// --- [이벤트] 초기화 및 버튼 클릭 ---
document.addEventListener("DOMContentLoaded", () => {
  renderBfi();
  setStep(1);

  // Chips 클릭 제한 (data-max 속성 처리)
  document.querySelectorAll(".chips").forEach((group) => {
    const max = Number(group.dataset.max) || 99;
    group.addEventListener("change", (e) => {
      const checkedCount = group.querySelectorAll("input:checked").length;
      if (checkedCount > max) {
        e.target.checked = false;
        alert(`최대 ${max}개까지만 선택 가능합니다.`);
      }
    });
  });

  // 이전 버튼
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentStep > 1) setStep(currentStep - 1);
    });
  }

  // 다음/제출 버튼
  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      // Step 1: 기본 정보 검증
      if (currentStep === 1) {
        const name = document.getElementById("name").value.trim();
        const org = document.getElementById("org").value.trim();
        const jobType = getChecked("jobType");
        const position = document.getElementById("position").value.trim();
        const career = document.getElementById("career").value;
        
        if (!name) return showError("이름을 입력해주세요.");
        if (!org) return showError("소속을 입력해주세요.");
        if (jobType.length === 0) return showError("직종을 선택해주세요.");
        if (!position) return showError("직급을 입력해주세요.");
        if (!career) return showError("경력을 선택해주세요.");
      }
      
      // Step 2: BFI 검증 및 계산
      if (currentStep === 2) {
        if (!calcBfi()) return showError("모든 성격 문항(1~10번)에 체크해주세요.");
      }

      // Step 3: 위험 상황
      if (currentStep === 3) {
        if (getChecked("process").length === 0) return showError("작업을 선택해주세요.");
        if (getChecked("riskType").length === 0) return showError("위험 유형을 선택해주세요.");
      }
      
      // Step 4: 상황 묘사
      if (currentStep === 4) {
        if (!document.getElementById("sentence").value.trim()) return showError("상황 묘사를 입력해주세요.");
      }

      // Step 5: 자가진단 (마지막 단계)
      if (currentStep === 5) {
        // q13~q15가 Step 5에 있다면 검증 (없으면 통과)
        if (document.querySelector('[data-group="q13"]') && getChecked("q13").length === 0) 
            return showError("모든 항목을 선택해주세요.");
      }

      // 마지막 단계일 때 제출
      if (currentStep === totalSteps) {
        await submitSurvey();
      } else {
        // 다음 단계로 이동
        setStep(currentStep + 1);
      }
    });
  }

  // --- [서버 통신] 설문 제출 ---
  async function submitSurvey() {
    nextBtn.disabled = true;
    nextBtn.textContent = "저장 중...";

    const profile = {
      name: document.getElementById("name").value,
      org: document.getElementById("org").value,
      jobType: getChecked("jobType"),
      position: document.getElementById("position").value,
      career: document.getElementById("career").value,
      importantPerson: document.getElementById("importantPersonType").value,
      importantPersonDetail: getPersonDetails().join(", ")
    };

    const incident = {
      process: getChecked("process"),
      riskType: getChecked("riskType"),
      triggers: getChecked("triggers"),
      sentence: document.getElementById("sentence").value,
      consequence: document.getElementById("consequence").value,
      feeling: document.getElementById("feeling").value
    };

    const baseline = {
      q13: getChecked("q13")[0] || "",
      q14: getChecked("q14")[0] || "",
      q15: getChecked("q15")[0] || "",
      lowReason: getChecked("lowReason"),
      extraComment: document.getElementById("extraComment").value
    };

    const payload = {
      data: { profile, incident, baseline, bfiScores },
      scenarioId: "SCEN_" + Date.now(),
      savedAs: "survey_result.json"
    };

    localStorage.setItem("preSurveyResult", JSON.stringify(payload));

    try {
      const res = await fetch("/api/save-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch(e) { 
      console.warn(e); 
    }

    // [중요] 설문 종료 후 next.html로 이동
    window.location.href = "next.html";
  }

  // --- [기능] 최근 기록 불러오기 ---
  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      try {
        loadBtn.disabled = true;
        const res = await fetch("/api/last-survey");
        const json = await res.json();
        if (!json.ok) throw new Error("로드 실패");
        
        const d = json.record?.data; 
        if (!d) return alert("기록이 없습니다.");

        // 값 복원 로직
        document.getElementById("name").value = d.profile.name || "";
        document.getElementById("org").value = d.profile.org || "";
        document.getElementById("position").value = d.profile.position || "";
        document.getElementById("career").value = d.profile.career || "";
        document.getElementById("importantPersonType").value = d.profile.importantPerson || "가족";
        
        const setChecks = (group, values) => {
          if (!values) return;
          document.querySelectorAll(`[data-group="${group}"] input`).forEach(b => {
            b.checked = Array.isArray(values) ? values.includes(b.value) : (b.value == values);
          });
        };

        setChecks("jobType", d.profile.jobType);
        setChecks("process", d.incident.process);
        setChecks("riskType", d.incident.riskType);
        setChecks("triggers", d.incident.triggers);
        
        const details = d.profile.importantPersonDetail || "";
        const inputs = document.querySelectorAll(".person-detail");
        if(inputs.length > 0) inputs[0].value = details;

        document.getElementById("sentence").value = d.incident.sentence || "";
        document.getElementById("consequence").value = d.incident.consequence || "";
        document.getElementById("feeling").value = d.incident.feeling || "";

        alert("최근 기록을 불러왔습니다.");
      } catch(e) {
        console.error(e);
        alert("불러오기 실패");
      } finally {
        loadBtn.disabled = false;
      }
    });
  }
});