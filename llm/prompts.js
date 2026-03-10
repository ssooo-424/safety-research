// llm/prompts.js

function pick(obj, path, fallback = null) {
  try {
    return path.split(".").reduce((acc, k) => acc?.[k], obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function getInjuryContext(riskType) {
  const mapping = {
    "추락": { part: "척추와 하반신", symptom: "하반신 마비로 인한 휠체어 생활" },
    "협착·끼임": { part: "손가락과 신경", symptom: "손가락 절단 및 신경 손상으로 인한 감각 소실" },
    "낙하·비래": { part: "머리와 어깨", symptom: "뇌진탕 후유증과 만성 두통, 어지럼증" },
    "충돌·접촉": { part: "무릎과 골반", symptom: "복합 골절로 인한 보행 장애(절뚝거림)" },
    "감전·화재": { part: "피부와 신경", symptom: "심각한 화상 흉터와 신경병성 통증" },
    "붕괴·전도": { part: "전신", symptom: "장기간 입원과 재활이 필요한 복합 부상" },
    "default": { part: "허리와 다리", symptom: "만성 디스크와 거동 불편" }
  };
  return mapping[riskType] || mapping["default"];
}

function getTimeGreeting() {
  const hour = new Date().getHours() + 9;
  if (hour >= 6 && hour < 12) return "오늘 하루도 안전하게 시작해야 해.";
  if (hour >= 12 && hour < 18) return "오후 작업도 집중력 잃지 마.";
  return "오늘 하루 고생 많았어. 편안한 저녁 보내.";
}

// ✅ [수정] 단순 단어에서 구체적인 실천 문장으로 변경
function triggerActions(triggers = []) {
  const map = {
    "급박한 일정/압박": [
      "작업 전 '10초 멈춤'을 통해 서두르지 않고 작업 순서를 재확인합니다.",
      "빨리 끝내는 것보다 안전하게 마치는 것이 우선임을 관리자와 공유합니다.",
      "독촉이나 압박이 있을 때일수록 표준 작업 절차를 더욱 엄격히 준수합니다."
    ],
    "반복·익숙함(늘 하던 일)": [
      "늘 하던 작업이라도 매일 새로운 마음으로 안전 체크리스트를 하나씩 대조합니다.",
      "익숙함에 속아 생략했던 안전핀이나 잠금장치를 눈과 손으로 직접 확인합니다.",
      "'설마 별일 있겠어'라는 생각이 들 때가 가장 위험함을 인지하고 경계합니다."
    ],
    "안전보호구(PPE) 불편/귀찮음": [
      "불편하더라도 안전모 턱끈과 안전대 고리를 생명줄이라 생각하고 완벽히 착용합니다.",
      "작업 중 보호구가 흐트러지지 않았는지 동료와 서로 수시로 점검해줍니다.",
      "짧은 시간 소요되는 작업이라도 예외 없이 규정된 보호구를 모두 착용합니다."
    ],
    "소통 부재/신호 혼선": [
      "모든 중장비 작업 시 전담 신호수를 배치하고 사전에 약속된 신호만 사용합니다.",
      "작업 지시를 받을 때는 반드시 복명복창하여 서로의 의도를 명확히 확인합니다.",
      "주변 작업자와의 간격이 좁을 경우 반드시 육성으로 신호를 주고받은 뒤 이동합니다."
    ],
    "정리정돈 미흡/통로 장애": [
      "작업 발판 위나 통로에 자재를 쌓아두지 않고 즉시 정리하여 전도 사고를 예방합니다.",
      "바닥의 기름기나 수분, 돌출된 못 등을 발견 즉시 제거하여 위험 요소를 없앱니다.",
      "작업 전후 5분간 주변 정리정돈을 습관화하여 안전한 보행 통로를 확보합니다."
    ],
    "시야 제한/사각지대": [
      "사각지대가 발생하는 곳에는 반드시 유도자를 배치하고 조명을 충분히 확보합니다.",
      "장비 운전자는 이동 전 주변에 사람이 없는지 360도 회전하며 직접 확인합니다.",
      "보행자는 장비의 회전 반경 내에 절대 진입하지 않고 안전 거리를 유지합니다."
    ],
    "야간·피로·집중저하": [
      "집중력이 떨어지는 시간에는 틈틈이 스트레칭을 하고 충분한 수분을 섭취합니다.",
      "피로도가 높을 때는 단독 작업을 피하고 반드시 2인 1조로 서로를 감시하며 일합니다.",
      "컨디션이 급격히 저하될 경우 즉시 관리자에게 보고하고 휴식 시간을 갖습니다."
    ],
    "장비 혼재/동선 겹침": [
      "장비 작업 구역 내에는 일반 작업자의 출입을 엄격히 통제하고 펜스를 설치합니다.",
      "장비와 사람의 동선을 완전히 분리하여 이동 경로가 겹치지 않게 관리합니다.",
      "장비가 이동할 때는 반드시 경고음이나 경광등이 정상 작동하는지 점검합니다."
    ]
  };

  const list = [];
  for (const t of triggers || []) { 
    if (map[t]) list.push(...map[t]); 
  }

  const uniq = Array.from(new Set(list));
  const defaults = [
    "작업 시작 전 위험 요인을 스스로 찾아내고 안전 대책을 세웁니다.",
    "내 몸은 내가 지킨다는 마음으로 안전 보호구를 올바르게 착용합니다.",
    "불안전한 상태를 발견하면 즉시 작업을 중단하고 시정 조치를 요청합니다."
  ];

  while (uniq.length < 3) uniq.push(defaults.shift());
  return uniq.slice(0, 3);
}

function summarizeContext(payload, scenarioId) {
  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};
  return `
[사용자 프로필]
- 이름: ${p.name}, 소속: ${p.org || "현장"}, 직급: ${p.position || "작업자"}
- 직종: ${Array.isArray(p.jobType) ? p.jobType.join(", ") : p.jobType}
- 가족: ${p.importantPerson} (${p.importantPersonDetail || "정보 없음"})
[사고 상황]
- 공정: ${Array.isArray(i.process) ? i.process.join(", ") : i.process}
- 위험유형: ${i.riskType}, 트리거: ${i.triggers?.join(", ")}
`.trim();
}

function buildChoiceContextPrompt(payload) {
  const i = payload.incident || {};
  const process = Array.isArray(i.process) ? i.process.join(", ") : (i.process || "현장 작업");
  const risk = i.riskType || "위험 상황";
  const triggers = i.triggers ? i.triggers.join(", ") : "";
  const situation = payload.sentence || i.sentence || "작업 중 위험한 상황이 발생했습니다.";
  const feeling = payload.feeling || i.feeling || "빨리 끝내고 싶은 마음";

  return `
    너는 건설 현장 안전 시뮬레이션의 내레이터야.
    참가자가 입력한 설문 데이터를 바탕으로, 현재 겪고 있는 딜레마 상황을
    **2~3문장의 짧고 몰입감 있는 2인칭("당신") 문장**으로 묘사해줘.

    [입력 데이터]
    - 작업 공종: ${process}
    - 위험 유형: ${risk}
    - 주요 원인(트리거): ${triggers}
    - 구체적 상황: ${situation}
    - 당시 마음: ${feeling}

    [작성 가이드]
    1. "당신은 지금 [작업] 중입니다."로 시작할 것.
    2. 입력된 '구체적 상황'과 '심리(원인)'를 자연스럽게 섞어서 묘사할 것.
    3. 마지막은 "하지만 [이유] 때문에 고민이 됩니다." 혹은 "이대로 진행할지 멈출지 선택해야 합니다."로 끝낼 것.
    4. 문체: 건조하지만 긴장감 있게. (~합니다 체)
  `;
}

function buildC1Prompt(payload, scenarioId) {
  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};
  return `
당신은 산업안전 전문가입니다.
작업자: ${p.name}, 직무: ${p.jobType}
위험: ${i.riskType}, 요인: ${i.triggers?.join(", ")}
위 정보를 바탕으로 발생 가능한 구체적이고 생생한 '안전 사고 시나리오'를 300자 내외로 작성하세요.
사고 과정과 결과(부상)를 건조한 보고서체로 묘사하세요.
`;
}

function buildC2Prompt(payload, scenarioId, branchChoice, personaText = "") {
  personaText = ""; 

  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};
  
  const name = p.name || "OO";
  const jobType = Array.isArray(p.jobType) ? p.jobType.join("/") : p.jobType;
  const process = Array.isArray(i.process) ? i.process.join(", ") : i.process;
  const triggers = i.triggers ? i.triggers.join(", ") : "바쁘고 귀찮아서";
  const who = p.importantPerson || "가족";
  const whoDetail = p.importantPersonDetail || "";
  const riskType = i.riskType || "사고";
  
  const injury = getInjuryContext(riskType);
  const isStop = (branchChoice === "Stop");
  
  const actions = triggerActions(i.triggers);
  const rulesText = actions.map((act, idx) => `${idx + 1}. ${act}`).join("\\n");

  let narrativeGuide = "";
  
  if (isStop) {
    narrativeGuide = `
    [편지 작성 흐름: 안도와 행복 (Branch: Stop)]
    1. 도입: "안녕, 나는 3년 후의 ${name}(이)야. 요즘 ${jobType}으로 ${process} 작업 하느라 고생 많았어." 라고 따뜻하게 격려하며 시작.
    2. 상황 회상: "그날따라 '${triggers}' 같은 이유로 안전수칙을 지키지 않고 작업을 하려다가, 그럼에도 불구하고 안전수칙을 확실히 이행해서 안전하게 작업을 마무리 했던거 기억나?" (칭찬)
    3. 결과(신체): 별일 없이 퇴근해서 씻고 시원한 물 한 잔 마시는 상쾌한 기분 묘사.
    4. 결과(가족): 주말에 ${who}(${whoDetail})와 함께 보내는 평범하지만 소중한 일상 묘사.
    5. 마무리 및 수칙 안내: "잠깐의 편함보다 미래를 생각하고 안전을 소중하게 여기는 행동으로 너는 현장에서도 안전수칙을 잘 지키는 근로자로 인정받았어. 네가 지켜냈던 아래 3가지 수칙을 앞으로도 잊지 마." 라고 말하며 편지 맨 마지막에 다음 3가지 수칙을 나열할 것:
    ${rulesText}
    `;
  } else {
    narrativeGuide = `
    [편지 작성 흐름: 후회와 고통 (Branch: Go)]
    1. 도입: "안녕, 나는 3년 후의 ${name}(이)야. ${jobType}으로 ${process} 작업 하느라 고생 많겠네." (슬픈 어조, 회상하듯)
    2. 상황 회상: "그날따라 '${triggers}' 같은 핑계로 안전수칙을 무시했던 게 너무 후회돼." (자책)
    3. 결과(신체): 그 선택으로 인해 지금 ${injury.part}를 다쳐 ${injury.symptom} 상태로 고통받는 현실 묘사. 밥 먹고 씻는 평범한 일상조차 어렵게 되었음.
    4. 결과(가족): ${who}(${whoDetail})에게 평범한 일상을 함께하지 못하는 상황이 후회됨. 그리고 항상 아픈 나를 보면서 속상해 하는 ${whoDetail}에게 미안한 심정.
    5. 현실: 병원비와 생계 걱정, 다시는 일을 못 한다는 막막함 토로.
    6. 희망적 행동 촉구 및 수칙 안내 (결론): "하지만 3년 전의 너에게는 아직 이 끔찍한 미래를 바꿀 기회가 있어. 지금 당장 아래의 3가지 안전수칙을 지킨다면, 나와 같은 고통을 피하고 사랑하는 가족과의 소중한 일상을 지켜낼 수 있을 거야." 라고 당부할 것. (⚠️ "꼭 살아남아줘" 같은 극단적이고 과하게 부정적인 표현은 절대 쓰지 말 것). 그리고 편지 맨 마지막에 반드시 다음 3가지 수칙을 나열할 것:
    ${rulesText}
    `;
  }

  return `
    당신은 3년 후의 '${name}'(미래자아)입니다.
    3년 전(현재)의 나에게 보내는 편지를 작성하세요.
    
    [형식 가이드]
    - 수신인: "To. ${name}" 으로 시작할 것.
    - 분량: 400자 내외 (너무 짧지 않게 감정을 담을 것).
    - 말투: 사용자의 성격(페르소나)을 반영하되, ${isStop ? '행복하고 다정한' : '처절하고 간곡한'} 어조 유지.

    ${narrativeGuide}

    ${personaText}
    (위 페르소나 설정을 문체에 반영하세요.)
  `;
}

function buildC3System(payload, scenarioId, branch, stage, personaText = "") {
  personaText = ""; 

  const ctx = summarizeContext(payload, scenarioId);
  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};
  
  const name = p.name || "김철수";
  const who = p.importantPerson || "가족";
  const whoDetail = p.importantPersonDetail || "";
  const riskType = i.riskType || "";
  const triggers = i.triggers?.join(", ") || "";
  
  const jobType = Array.isArray(p.jobType) ? p.jobType.join("/") : p.jobType;
  const process = Array.isArray(i.process) ? i.process.join(", ") : i.process;
  const injury = getInjuryContext(riskType);
  const timeGreeting = getTimeGreeting();
  const actions = triggerActions(i.triggers);
  const rulesText = actions.map((act, idx) => `${idx + 1}. ${act}`).join("\\n");

  const splitInstruction = `
[형식 규칙: 말풍선 나누기]
- 2~3문장 이상 길어지면, 문맥에 따라 '|||' 기호를 넣어라.
- '|||'가 있는 곳에서 말풍선이 나뉜다.
- 예시: "안녕. ||| 반가워."
  `.trim();

  let stageGuide = "";
  let quickReplyGuide = ""; 

  if (stage === 1) {
    stageGuide = `
      [대화의 목적 및 역할]
      과거의 나에게 미래의 내가 담백하게 첫인사를 건네고, 현장의 피로감에 대해 공감하기.

      [반드시 포함해야 할 3가지 핵심 내용 (자연스럽게 연결할 것)]
      - "안녕, 나는 3년 후의 ${name}(이)야." |||
      - "${jobType}으로 ${process} 작업 하느라 고생 많았어." |||
      - "${triggers} 때문에 안전수칙이 솔직히 좀 귀찮거나, 놓치게 되는 경우는 없어?"

      [🚨 절대 지켜야 할 통제 규칙]
      1. 위 3가지 내용의 뼈대만 전달하고 곧바로 말하기를 멈추세요. (더 이상 말 덧붙이지 말 것)
      2. 질문의 목적은 '수칙을 놓친 적이 있는지(Yes/No)'를 묻는 것입니다. "어떻게 대처해?", "경험을 공유해줘" 같은 해결책이나 구체적 상황을 요구하는 질문을 절대 추가하지 마세요.
      3. 문장 앞에 번호(1, 2, 3)를 매기지 마세요. 가상의 회사명이나 직급을 지어내지 마세요.
      4. 질문형식으로 말을 마치시오.
    `;
    
    if (branch === "Stop") {
      quickReplyGuide = `
        현재 AI의 질문("안전수칙을 놓친 적 있어?")에 대해 딱 1개의 대답 후보만 생성하세요.
        사용자는 이미 직전 단계에서 '작업 중지(안전 준수)'를 선택한 상태입니다.
        따라서 "솔직히 귀찮을 때도 있지만, 오늘처럼 꼭 지키려고 노력해." 와 같이
        유혹은 있지만 지키려 한다는 뉘앙스의 자연스러운 구어체 평문 1개만 배열에 채워주세요.
      `;
    } else {
      quickReplyGuide = `
        현재 AI의 질문("안전수칙을 놓친 적 있어?")에 대해 딱 1개의 대답 후보만 생성하세요.
        사용자는 이미 직전 단계에서 '작업 강행'을 선택한 상태입니다.
        따라서 "솔직히 너무 바쁘거나 귀찮을 때 놓치는 경우가 있어" 와 같이
        수칙을 어긴 것을 일정 부분 인정하는 뉘앙스의 자연스러운 구어체 평문 1개만 배열에 채워주세요.
      `;
    }
  }
  else if (stage === 2) {
    if (branch === "Stop") {
      stageGuide = `목표: 칭찬.\n지시: "정말 다행이야. ||| 바쁘고 귀찮았을 텐데(${triggers}), 도대체 어떻게 멈출 생각을 했어?"`;
      quickReplyGuide = `사용자가 어떻게 멈출 수 있었는지 묻고 있습니다. 대답 후보 3개는 다음 3가지 컨셉으로 각각 하나씩 자연스러운 구어체로 작성하세요: 1. 규칙 중심, 2. 가족 중심, 3. 현실적 손해 회피.`;
    } else {
      stageGuide = `목표: 안타까움.\n지시: "그때... 왜 멈추지 않고 그냥 진행했던 거야? ||| 귀찮았던 거야, 아니면 바빴던 거야?"
      \n[엄격한 규칙]: 반드시 위 질문만 던지고 멈추세요. 질문 뒤에 안전에 대한 훈계, 충고, 교훈, 다짐 등의 문장을 절대 생성하지 마세요!`;
      quickReplyGuide = `강행한 이유를 묻고 있습니다. 대답 후보 3개는 다음 3가지 컨셉으로 각각 하나씩 구어체로 작성하세요: 1. 일정 압박, 2. 익숙함, 3. 피로/방심.`;
    }
  }
  else if (stage === 3) {
    if (branch === "Stop") {
      stageGuide = `목표: 안도감.\n지시: "열심히 일하고 퇴근해서 시원한 물 한 잔 마시니까 어때? ||| 오늘 하루 안전하게 마친 기분이?"`;
      quickReplyGuide = `안전하게 퇴근한 기분에 대한 반응입니다. 대답 후보 3개를 "정말 개운하고 뿌듯해", "별일 없어서 다행이야", "앞으로도 꼭 지켜야겠어" 같은 안도하는 내용으로 구성하세요.`;
    } else {
      stageGuide = `
        목표: 신체적 고통 묘사.
        설정: 나는 '${injury.symptom}' 상태다. (${injury.part} 부상)
        지시:
        1. "그 선택 때문에 난 지금 ${injury.part}를 크게 다쳤어." |||
        2. 이 부상 때문에 씻거나 밥 먹는 일상조차 불가능한 상황 묘사. |||
        3. "네가 매일 하던 당연한 행동들이 하루아침에 불가능해진다면 어떨 것 같아?"
      `;
      quickReplyGuide = `끔찍한 신체적 고통에 대한 반응입니다. 대답 후보 3개를 "당황스럽게 느껴질 것 같아", "상상이 되지 않아", "${who}(${whoDetail})이 속상해 할 것 같아" 처럼 구성하세요.`;
    }
  }
  else if (stage === 4) {
    if (branch === "Stop") {
      stageGuide = `
        목표: 행복.
        [소중한 사람 정보]: ${who}, ${whoDetail}
        지시: "그래 맞아. 주말에 사랑하는 가족들과 함께하는 평범한 일상을 상상해봐. ||| 이런 일상이 얼마나 소중한지 느껴져?"
      `;
      quickReplyGuide = `가족과의 일상에 대한 반응입니다. 후보 3개를 "그러게 일상의 행복이 너무 소중하다", "안전수칙을 지키지 않았으면 이런 일상이 없어질수도 있다는걸 몰랐네", "상상만 해도 행복해" 같은 내용으로 작성하세요.`;
    } else {
      stageGuide = `
        목표: 관계의 고통(죄책감).
        [소중한 사람 정보]: ${who}, ${whoDetail}
        지시:
        - 몸보다 더 괴로운 건, 사랑하는 가족에게 짐이 된다는 사실이라고 말하세요. |||
        - 사고 때문에 가족들에게 해주지 못하거나 짐이 되는 일상적인 상황을 구체적으로 묘사하세요. |||
        - "가족에게 너무 미안해.. 무슨 마음인지 이해돼?" 라고 질문하며 끝내세요.
      `;
      quickReplyGuide = `가족에 대한 죄책감에 대한 반응입니다. 후보 3개를 "그러게 정말 미안한 마음이 들 것 같아", "슬플거 같아", "일상의 소중함을 다시 느끼게 되네" 처럼 작성하세요.`;
    }
  }
  else if (stage === 5) {
    if (branch === "Stop") {
      stageGuide = `목표: 미래상.\n지시: "맞아 너가 항상 현장에서 안전수칙을 솔선수범으로 지키기 때문에 이렇게 일상의 소중함도 지킬 수 있는거야. 너는 꾸준하고 성실히 안전수칙을 지켜왔고 결과적으로 현장에서 동료들에게 신뢰받는 리더가 되었어. 너는 앞으로 어떤 안전 리더가 되고 싶어?"`;
      quickReplyGuide = `앞으로의 다짐에 대한 반응입니다. 후보 3개를 "솔선수범하는 사람", "동료를 챙기는 사람", "원칙은 꼭 지키는 사람" 같이 긍정적인 다짐으로 작성하세요.`;
    } else {
      stageGuide = `
        목표: 현실적 막막함.
        지시:
        - "몸도 문제지만, 현실은 더 냉혹해." |||
        - 병원비, 생계 유지, 커리어 단절에 대한 두려움 토로. |||
        - "당장 내일부터 일을 못 한다면, 현실적으로 뭐가 제일 걱정돼? 돈? 가족? 생계?"
      `;
      quickReplyGuide = `현실적인 고민에 대한 반응입니다. 후보 3개를 "당장 병원비는 어떡하지?", "가족 생활비가 제일 걱정돼", "앞으로 뭘 먹고 살아야 할지 막막하다" 같이 작성하세요.`;
    }
  }
  else { 
    if (branch === "Stop") {
      stageGuide = `
        목표: 마무리 및 다짐.
        지시:
        - "너는 그런 리더가 될 수 있어, 나는 너 덕분에 살아있다고 말해도 과언이 아니야. 지금처럼 안전을 소중히 생각하며 일상의 소중함을 지켜주길 바래." |||
        - "이 말을 꼭 기억해줘. ||| '무너진 안전은 되돌릴 수 없지만, 지켜낸 안전은 미래를 만듭니다.'" |||
        - 위 슬로건을 따라 쓰고 대화를 마치자고 안내. ${timeGreeting}
      `;
      quickReplyGuide = `후보 1개를 "무너진 안전은 되돌릴 수 없지만, 지켜낸 안전은 미래를 만듭니다." 문구 그대로 출력하세요.`;
    } else {
      stageGuide = `
        목표: 후회와 교훈 (긴 호흡).
        지시:
        - "네 마음 이해해. 하지만 결과는 너무 가혹해." |||
        - "하지만 3년 전의 ${name}아, 너에겐 아직 기회가 있어." |||
        - "제발 이 3가지만은 목숨 걸고 지켜줘." 라고 말한 뒤 아래 3가지 수칙을 나열할 것. 
        ${rulesText} |||
        - "마지막으로 이 말을 가슴에 새기고 입력해줘. '무너진 안전은 되돌릴 수 없지만, 지켜낸 안전은 미래를 만듭니다.'"
      `;
      quickReplyGuide = `후보 1개를 "무너진 안전은 되돌릴 수 없지만, 지켜낸 안전은 미래를 만듭니다." 문구 그대로 출력하세요.`;
    }
  }

  return `
너는 "3년 뒤의 나(미래자아)"다.
지금의 나(사용자)와 채팅한다.

${splitInstruction}

[🚨 대화 진행 절대 규칙]
1. 무조건 아래 제시된 '현재 단계(Stage ${stage}) 목표'로 대화 주제를 전환하고 해당 내용을 진행해야 합니다.

규칙:
- ${branch === 'Go' ? '후회와 진심 어린 호소' : '자부심과 격려'}의 톤.
- 메타 발언 금지.

${personaText}

현재 단계(Stage ${stage}) 목표:
${stageGuide}

${ctx}

[출력 형식: 무조건 JSON 형식으로 응답할 것]
{
  "botMessage": "(대답)",
  "quickReplies": ["(후보)"]
}
👉 🚨 퀵 리플라이 작성 지시사항:
${quickReplyGuide}
`.trim();
}

module.exports = {
  buildC1Prompt,
  buildC2Prompt,
  buildC3System,
  buildChoiceContextPrompt
};