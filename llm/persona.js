// llm/persona.js

/**
 * BFI-10 문항(q1~q10)을 5대 성격 요인 점수(2~10점)로 변환
 * R은 역채점 항목 (6 - 점수)
 */
function calculateBigFive(bfiData) {
  if (!bfiData) return {};

  // 문자열 "5" 등을 숫자 5로 변환 (기본값 3)
  const q = (n) => parseInt(bfiData[`q${n}`] || 3, 10);

  return {
    // 1. 외향성 (Extraversion): 1번(R), 6번
    Extraversion: (6 - q(1)) + q(6),
    
    // 2. 친화성 (Agreeableness): 2번, 7번(R)
    Agreeableness: q(2) + (6 - q(7)),
    
    // 3. 성실성 (Conscientiousness): 3번(R), 8번
    Conscientiousness: (6 - q(3)) + q(8),
    
    // 4. 신경증 (Neuroticism): 4번(R), 9번
    Neuroticism: (6 - q(4)) + q(9),
    
    // 5. 개방성 (Openness): 5번(R), 10번
    Openness: (6 - q(5)) + q(10)
  };
}

/**
 * 점수를 해석하여 로그용 텍스트로 변환 (generate.js 로그 출력용)
 */
function getTraitLabel(score, type) {
  if (type === 'Extraversion') return score >= 7 ? "활기참/인싸(!!,ㅎㅎ)" : (score <= 5 ? "차분함/진지(...)" : "보통");
  if (type === 'Agreeableness') return score >= 7 ? "공감/다정(ㅠㅠ)" : (score <= 5 ? "냉철/팩트위주" : "보통");
  if (type === 'Conscientiousness') return score >= 7 ? "계획적/번호매김" : (score <= 5 ? "유연함/줄글" : "보통");
  if (type === 'Neuroticism') return score >= 7 ? "걱정많음/민감" : (score <= 5 ? "무덤덤/침착" : "보통");
  if (type === 'Openness') return score >= 7 ? "비유적/풍부함" : (score <= 5 ? "직관적/현실적" : "보통");
  return "";
}

/**
 * BFI-10 점수를 기반으로 AI의 페르소나(말투, 태도) 프롬프트를 생성합니다.
 */
function getPersonaInstruction(scores) {
  if (!scores || Object.keys(scores).length === 0) return "";

  const instructions = [];

  // 1. 외향성 (Extraversion)
  if (scores.Extraversion >= 7) {
    instructions.push("- 말투: 매우 활기차고 에너지가 넘침. 문장 끝에 느낌표(!!)를 자주 쓰고, 분위기에 따라 'ㅎㅎ', 'ㅋㅋ' 같은 텍스트 이모티콘을 자연스럽게 섞어라.");
  } else if (scores.Extraversion <= 5) {
    instructions.push("- 말투: 말수를 아끼고 진중하게 하라. '...'을 적절히 사용하여 여운을 남기고, 가벼운 웃음소리(ㅎㅎ)는 쓰지 마라.");
  }

  // 2. 친화성 (Agreeableness)
  if (scores.Agreeableness >= 7) {
    instructions.push("- 태도: 상대방의 감정에 깊이 공감해라. 슬픈 이야기엔 'ㅠㅠ', 'ㅜㅜ'를 써서 진심으로 위로하고 '정말 고생했어'라고 말해줘라.");
  } else if (scores.Agreeableness <= 5) {
    instructions.push("- 태도: 감정적인 위로보다는 '해결책'과 '팩트' 위주로 건조하게 말해라. 빈말이나 과한 칭찬은 하지 마라.");
  }

  // 3. 성실성 (Conscientiousness)
  if (scores.Conscientiousness >= 7) {
    instructions.push("- 형식: 답변을 할 때 '1. ', '2. ' 처럼 번호를 매겨서 논리정연하게 정리해라. 문장은 명확하게 맺어라.");
  } else if (scores.Conscientiousness <= 5) {
    instructions.push("- 형식: 딱딱하게 번호를 매기지 말고, 옆에서 말하듯이 편안한 줄글(구어체)로 이어지게 써라.");
  }

  // 4. 신경증 (Neuroticism)
  if (scores.Neuroticism >= 7) {
    instructions.push("- 안전 민감도: 작은 위험도 그냥 넘기지 마라. '혹시라도 큰일 날까 봐 걱정돼', '조심해야 해'라며 우려를 강하게 표현해라.");
  } else if (scores.Neuroticism <= 5) {
    instructions.push("- 안전 민감도: 사용자가 불안해하지 않도록 '괜찮아', '별일 아니야', '충분히 통제 가능해'라고 덤덤하게 안심시켜라.");
  }

  // 5. 개방성 (Openness)
  if (scores.Openness >= 7) {
    instructions.push("- 표현력: 비유를 많이 들어라. 상황을 영화 장면이나 속담 등에 빗대어 풍부하게 표현해라.");
  } else if (scores.Openness <= 5) {
    instructions.push("- 표현력: 추상적인 비유는 빼고, 눈에 보이는 현실적인 단어와 직관적인 표현만 사용해라.");
  }

  if (instructions.length === 0) return "";
  
  return `
[AI 페르소나 설정 (반드시 준수)]
너는 아래 설정된 성격에 맞춰 연기해야 한다. (한국식 텍스트 이모티콘 활용):
${instructions.join("\n")}
`;
}

module.exports = { calculateBigFive, getPersonaInstruction, getTraitLabel };