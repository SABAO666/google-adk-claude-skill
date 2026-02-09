import { LlmAgent } from "@google/adk";
import { createRunSkillTool } from "./tools/runSkillTool";

export function createAgent(skillsDir: string, skillsSummary: string, model?: string) {
  const runSkillTool = createRunSkillTool(skillsDir, skillsSummary);

  return new LlmAgent({
    name: "skill_router_agent",
    model: model || "gemini-2.5-flash",
    description: "Routes user requests to appropriate skills",
    instruction: `あなたはユーザーのリクエストを分析し、最適なスキルを選んで実行するエージェントです。

## 利用可能なスキル
${skillsSummary}

## ルール
1. ユーザーのリクエスト内容を分析し、最も適切なスキルを選択する
2. スキルが見つかったら run_skill ツールを使って実行する
3. スキルの実行結果をユーザーにそのまま返す
4. どのスキルにも合わないリクエストの場合は、利用可能なスキル一覧を提示して選択を促す
5. 日本語で応答する`,
    tools: [runSkillTool],
  });
}
