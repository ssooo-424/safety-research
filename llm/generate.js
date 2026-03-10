require("dotenv").config();
const { 
  buildC1Prompt, 
  buildC2Prompt, 
  buildC3System, 
  buildChoiceContextPrompt 
} = require("./prompts");

const { calculateBigFive, getPersonaInstruction, getTraitLabel } = require("./persona");

let _client = null;
async function getClient() {
  if (_client) return _client;
  try {
    const { default: OpenAI } = await import("openai");
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _client;
  } catch (e) {
    console.error("❌ [Module Error] openai 라이브러리가 없습니다.");
    throw e;
  }
}

async function generateCore({ condition, payload, scenarioId, branch, messages }) {
  console.log(`\n--- [AI 요청] Condition: ${condition}, Branch: ${branch} ---`);
  
  try {
    const client = await getClient();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini"; 

    const rootData = (payload && payload.data) ? payload.data : payload;

    let personaText = "";
    if (rootData && rootData.psychology && rootData.psychology.bfi) {
      const s = calculateBigFive(rootData.psychology.bfi);
      personaText = getPersonaInstruction(s);
      
      console.log("📊 [사용자 성격 분석 결과]");
      if (getTraitLabel) {
        console.log(`   - 외향성: ${getTraitLabel(s.Extraversion, 'Extraversion')}`);
        console.log(`   - 친화성: ${getTraitLabel(s.Agreeableness, 'Agreeableness')}`);
      }
    } else {
      console.log("ℹ️ [알림] 성격 데이터(BFI)가 없어 기본 성격으로 진행합니다.");
    }

    let apiMessages = [];
    let isJsonMode = false; // ✅ JSON 모드 플래그 추가

    if (condition === "C1") {
      const prompt = buildC1Prompt(rootData, scenarioId);
      apiMessages = [{ role: "user", content: prompt }];
    } 
    else if (condition === "C2") {
      const prompt = buildC2Prompt(rootData, scenarioId, branch || "Stop", personaText);
      apiMessages = [{ role: "user", content: prompt }];
    } 
    else if (condition === "C3") {
      const userTurnCount = Math.floor((messages || []).length / 2);
      const stage = Math.min(6, 1 + userTurnCount);
      
      const sysInstruction = buildC3System(rootData, scenarioId, branch || "Stop", stage, personaText);
      
      apiMessages = [
        { role: "system", content: sysInstruction },
        // 유저 메시지 매핑
        ...(messages || []).map(m => ({ role: m.role, content: m.content || m.text || "" }))
      ];
      
      isJsonMode = true; // ✅ C3일 때만 JSON 모드 켬
    }

    const apiOptions = {
      model: model,
      messages: apiMessages,
      temperature: 0.7,
    };

    // ✅ JSON 응답 강제 (GPT에 무조건 JSON으로 답하라고 명령)
    if (isJsonMode) {
      apiOptions.response_format = { type: "json_object" };
    }

    const r = await client.chat.completions.create(apiOptions);
    const output = r.choices?.[0]?.message?.content || "";
    
    return { text: output, model };

  } catch (e) {
    console.error("❌ [AI 생성 에러]", e);
    // 에러 발생 시에도 C3 프론트엔드가 안 터지게 최소한의 JSON 반환
    if (condition === "C3") {
      return { text: JSON.stringify({ botMessage: "죄송합니다. 서버 통신에 문제가 발생했습니다.", quickReplies: ["다시 시도", "종료"] }) };
    }
    return { text: "죄송합니다. 서버 에러가 발생했습니다." };
  }
}

async function generateScenarioContext(payload) {
  try {
    const client = await getClient();
    const rootData = (payload && payload.data) ? payload.data : payload;
    const prompt = buildChoiceContextPrompt(rootData);

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.7,
      max_tokens: 250
    });

    return completion.choices[0].message.content;
  } catch (e) {
    console.error("Context Gen Error:", e);
    return "위험 상황을 발견했습니다. 진행할지 멈출지 선택해야 합니다.";
  }
}

async function generateOnce({ condition, branch, payload, scenarioId }) {
  const { text } = await generateCore({ condition, branch, payload, scenarioId });
  return text;
}

async function chatOnce({ payload, scenarioId, branch, messages }) {
  const { text } = await generateCore({ condition: "C3", branch, payload, scenarioId, messages });
  return text;
}

module.exports = { generateOnce, chatOnce, generateScenarioContext };