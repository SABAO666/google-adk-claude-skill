# やりたいこと（要件まとめ）

あなたが実現したいのはこれです：
## Claudeのskillが非常に話題になっています。skill.mdに記載の情報を元に、さらに高度な振る舞いをする機能です。これは、claude agent sdkでも利用できます。しかし、google agent developmentkit(adk)ではまだネイティブでは使用できませんよね。この現状で、adkを使いながら、claudeの優れた定義済みのskillを、ユーザーが、ADKを使用したwebアプリで使う


## 
1. **Firebase App Hosting（= Next.js をホスト）だけ**で、サービスを分離せずに運用したい
2. Next.js の中で **Google ADK（TypeScript）** を動かしてエージェントを実行したい
3. さらに、別サービス（Skill Gateway）を立てずに、同じNext.jsのサーバー側で **Claudeの定義済み Skills（SKILL.md）** を読み込んで実行したい
4. “フロント↔バックエンド通信を無くす”の意図は、**外部に別バックエンドを作らず**、同一オリジン・同一デプロイ単位で完結したい（= 余計なBFF/別APIサーバーを持ちたくない）

この前提で、**Next.js（App Hosting）内に ADK と Skill Runner を同居**させる実装ドキュメントを作ります。

---

# 実装ドキュメント（できるだけ細かく）

## 0. 全体アーキテクチャ（“同居”版）

App Hostingでデプロイされる Next.js（Cloud Run上）に、以下を全部入れます。

* UI（RSC/SSR）
* `/api/agent` … ADKエージェントの実行エンドポイント
* `lib/skills` … SKILL.md ローダー＋Claude実行（= Skill Runner。HTTP化しない＝関数呼び出し）
* 外部通信は **Anthropic API（Claude）** だけ（必要ならDBや外部APIも追加）

```
Browser
  ↓ (same origin)
Next.js on Firebase App Hosting
  ├─ UI (RSC/SSR)
  ├─ /api/agent  … ADK agent entry
  └─ lib/skills  … SKILL.md loader + Claude Agent SDK runner (local function)
        ↓
     Anthropic API
```

「Skill Gateway」という“論理コンポーネント”は存在しますが、**物理的に別サービスにはしません**。

---

## 1. 技術スタックと前提

### 前提

* Next.js 16+（App Router）
* Firebase App Hosting
* Google ADK TypeScript
* Claude（Anthropic） + Claude Agent SDK（Skillsを実行）

### 重要な実行要件（必須）

* **Node runtime** で動かす（Edge runtimeは避ける）
  → Next.js Route Handler で `export const runtime = "nodejs"` を必ず付ける

---

## 2. リポジトリ構成（推奨）

```
your-next-app/
  app/
    api/
      agent/
        route.ts          # ADK entry (SSE/JSON)
  lib/
    adk/
      agent.ts            # ADK agent factory / config
      tools/
        runSkillTool.ts   # ADK tool wrapper around local runSkill()
    skills/
      index.ts            # Skill registry / loader
      loader.ts           # SKILL.md parse & validation
      runner.ts           # Claude Agent SDK execution
      policy.ts           # allowlist / permission checks
      types.ts            # shared types
  skills/                 # skills packages (each has SKILL.md)
    email_polisher/
      SKILL.md
      assets/...
    ...
  scripts/
    validate-skills.ts    # prebuild validation (optional)
  apphosting.yaml         # App Hosting run config
  .env.local
  package.json
```

### ポイント

* `skills/` フォルダにスキル資産（SKILL.md）を置く（Git管理）
* `lib/skills` が **ロード・検証・実行**の責務を持つ
* ADK側は **Toolとして runSkill() を呼ぶ**だけに寄せる（責務分離）

---

## 3. 環境変数（必須・推奨）

`.env.local`（ローカル）/ App Hostingの環境変数（本番）に設定。

**必須**

* `ANTHROPIC_API_KEY`：Claude実行用

**推奨**

* `SKILLS_DIR=skills`：スキルディレクトリ相対パス
* `SKILL_ALLOWLIST=email_polisher,doc_summarizer,...`：許可するスキル名
* `APP_ENV=dev|stg|prod`
* `LOG_LEVEL=info|debug`

---

## 4. App Hosting のランタイム設定（運用の要）

`apphosting.yaml` に CPU/メモリ/同時実行を調整（※具体キーはApp Hostingの仕様に合わせて修正してください。ここは“設計指針”）。

**推奨設計指針**

* ADKやLLM実行は重い → **concurrencyは低め**から始める（例：2〜10）
* コールドスタートが嫌 → `minInstances: 1`
* メモリは余裕を（2GB〜）

例（イメージ）：

```yaml
runConfig:
  minInstances: 1
  maxInstances: 50
  concurrency: 5
  cpu: 2
  memoryMiB: 4096
```

> ここはあなたのトラフィック・平均応答時間・ストリーミング有無で最適値が変わります。最初は「落ちにくさ」優先で低concurrencyがおすすめ。

---

## 5. Skillパッケージ仕様（SKILL.mdの運用ルール）

### 5.1 推奨：スキルは“最低限メタ＋本体”に統一

`skills/<skill_name>/SKILL.md`

* メタ（例：YAML frontmatter）
* 説明
* 入力仕様（schema）
* 出力仕様
* 手順（Claudeが守るべき方針）

### 5.2 ルール（超重要）

* **スキル名はフォルダ名＝skill_id**で一意
* スキルが勝手に外部ツールを実行しない（必要なら `policy.ts` で許可制）
* ユーザー入力は **そのままSKILLに注入しない**（後述のインジェクション対策）

---

## 6. Skill Loader（SKILL.mdの読み込み・検証）

### 6.1 型定義（例）

```ts
// lib/skills/types.ts
export type SkillManifest = {
  id: string;                 // folder name
  name: string;               // display
  description: string;
  version?: string;
  inputSchema?: unknown;      // JSON schema (optional)
  outputSchema?: unknown;
  prompt: string;             // extracted instruction body
};
```

### 6.2 ローダー（例：概略）

```ts
// lib/skills/loader.ts
import fs from "node:fs/promises";
import path from "node:path";

export async function loadSkillManifest(skillsDir: string, skillId: string) {
  const skillPath = path.join(skillsDir, skillId, "SKILL.md");
  const raw = await fs.readFile(skillPath, "utf-8");

  // TODO: frontmatter parse (--- ... ---)
  // TODO: validate required fields
  // TODO: extract prompt body

  return {
    id: skillId,
    name: skillId,
    description: "",
    prompt: raw,
  };
}
```

### 6.3 レジストリ（一覧・キャッシュ）

```ts
// lib/skills/index.ts
import path from "node:path";

const cache = new Map<string, any>();

export async function getSkill(skillsDir: string, skillId: string) {
  const key = `${skillsDir}:${skillId}`;
  if (cache.has(key)) return cache.get(key);
  const mod = await import("./loader"); // avoid circular
  const skill = await mod.loadSkillManifest(skillsDir, skillId);
  cache.set(key, skill);
  return skill;
}
```

**運用TIP**

* 本番は “起動時に全件インデックス化” が安定（リクエスト毎のIOを減らす）
* 開発は “ホットリロード” でもOK

---

## 7. Skill Policy（allowlist / 権限 / 危険操作ブロック）

### 7.1 allowlist

```ts
// lib/skills/policy.ts
export function assertSkillAllowed(skillId: string) {
  const allow = process.env.SKILL_ALLOWLIST?.split(",").map(s => s.trim()).filter(Boolean);
  if (!allow || allow.length === 0) return; // allow all (dev)
  if (!allow.includes(skillId)) {
    throw new Error(`Skill not allowed: ${skillId}`);
  }
}
```

### 7.2 テナント/ユーザー権限（推奨）

* `context` に `tenantId`, `userRole`, `plan` を入れる
* `assertSkillAllowedForTenant(skillId, tenantId, role)` みたいな関数を挟む

---

## 8. Skill Runner（Claude Agent SDKで実行する層）

### 8.1 実行I/F（ADKが扱いやすい返り値）

```ts
// lib/skills/types.ts
export type SkillRunInput = {
  skillId: string;
  userInput: string;
  context?: Record<string, any>;
};

export type SkillRunOutput = {
  text: string;
  structured?: Record<string, any>;
  artifacts?: Array<{ name: string; mime: string; dataBase64?: string; url?: string }>;
  telemetry?: Record<string, any>;
};
```

### 8.2 runner（概略）

```ts
// lib/skills/runner.ts
import { assertSkillAllowed } from "./policy";
import { getSkill } from "./index";

export async function runSkill(input: {
  skillsDir: string;
  skillId: string;
  userInput: string;
  context?: Record<string, any>;
}): Promise<{ text: string; structured?: any }> {
  assertSkillAllowed(input.skillId);

  const skill = await getSkill(input.skillsDir, input.skillId);

  // ★重要：ユーザー入力は「データ」として扱う（命令にしない）
  const system = `You are executing a predefined skill. Follow the skill exactly.`;
  const skillPrompt = skill.prompt;

  const user = [
    `# Skill`,
    skillPrompt,
    ``,
    `# Context (data)`,
    JSON.stringify(input.context ?? {}, null, 2),
    ``,
    `# User Input (data)`,
    input.userInput,
  ].join("\n");

  // TODO: Claude Agent SDK 呼び出し
  // return { text: resultText, structured: parsedJsonIfAny };

  return { text: "TODO", structured: {} };
}
```

> 実装上のコツ：Skillが「JSONで返せ」と規定しているなら、レスポンスをJSONパースして `structured` に入れる。

---

## 9. ADK側：ToolとしてローカルSkill Runnerを呼ぶ

### 9.1 ADK Toolラッパー（runSkillTool）

```ts
// lib/adk/tools/runSkillTool.ts
import { runSkill } from "@/lib/skills/runner";

export async function runSkillTool(args: {
  skillId: string;
  userInput: string;
  context?: Record<string, any>;
}) {
  const skillsDir = process.env.SKILLS_DIR ?? "skills";
  return await runSkill({
    skillsDir,
    skillId: args.skillId,
    userInput: args.userInput,
    context: args.context,
  });
}
```

### 9.2 ADK Agentの構築（概略）

```ts
// lib/adk/agent.ts
import { runSkillTool } from "./tools/runSkillTool";

export function createAgent() {
  // TODO: ADK agent init
  // - define tool "run_skill"
  // - tool handler calls runSkillTool()
  // - routing logic: decide when to call run_skill
  return {};
}
```

**設計方針（強い）**

* ADKがやること：

  * ユーザー意図から「どのskillIdを使うか」判断
  * 追加ツール（DB検索、社内APIなど）との統合
  * 返答の統合・最終整形
* Skill Runnerがやること：

  * SKILL.mdに忠実な実行（Claude）

---

## 10. Next.js API：`/api/agent` を実装（JSON / SSE）

### 10.1 まずはJSON版（最短で動く）

```ts
// app/api/agent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAgent } from "@/lib/adk/agent";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, context } = body;

  const agent = createAgent();

  // TODO: agent.run({ message, context }) みたいに実行
  const result = { text: "TODO" };

  return NextResponse.json(result);
}
```

### 10.2 本番向け：SSE（ストリーミング）

* LLMはストリーミングがUXに効きます
* ADK/Claudeのストリーミング対応に合わせて、`ReadableStream` で返す

（ここはADK実行APIの形に合わせて具体化します。あなたのADKの呼び出し形が決まり次第、コピペ実装を出せます）

---

## 11. ルーティング（どのSkillをいつ使うか）

### 11.1 最小のルーティング（手動指定）

ユーザーが `/skill email_polisher ...` のように指定してくる方式。

* 実装が最速
* “勝手にスキルを使う”暴発が減る

### 11.2 自動ルーティング（おすすめ）

ADKがユーザー入力を分類して `skillId` を選ぶ。

* 例：

  * 「メール」「敬語」「件名」→ `email_polisher`
  * 「要約」「短く」→ `doc_summarizer`

**設計TIP**
最初は **ルール + フォールバックでLLM** が堅いです。
（いきなりLLMルーティングだけにすると、誤爆やコストが増えがち）

---

## 12. セキュリティ（最低限これだけは）

### 12.1 Prompt Injection対策（必須）

* ユーザー入力は「命令」としてSkillに混ぜない
  → 上で示したように **`User Input (data)` として隔離**
* skill側の命令階層（system > skill > user）を崩さない

### 12.2 Skillの許可制（必須）

* allowlist
* tenant/roleによる制御
* “危険スキル”を本番で無効化

### 12.3 監査ログ（推奨）

* `trace_id` を生成して、`/api/agent` の1リクエスト単位でログ統合
* `skillId`, `tenantId`, `latency`, `token`, `error` を記録

---

## 13. パフォーマンス設計（同居運用の要）

同居で事故る典型は「重い推論がUIを巻き込む」です。対策はこれ：

1. **concurrency低めで開始**（詰まり方を制御）
2. **ストリーミングで早く返す**（体感速度）
3. **キャッシュ**

   * Skillロードのインデックスはメモリキャッシュ
4. **タイムアウトとリトライ**

   * Anthropic呼び出しには適切なtimeout/リトライ（指数バックオフ）

---

## 14. 開発フロー（手順）

1. Next.js作成（App Router）
2. `skills/` に最低1つスキル追加
3. `lib/skills` に loader/runner/policy 実装
4. `/api/agent` を Node runtime で作る
5. ADK agent を `lib/adk` に作る（toolとしてrunSkillTool登録）
6. ローカルで `curl` or UIから疎通
7. App Hostingへデプロイ（環境変数セット）

---

## 15. 最低限のMVPチェックリスト

* [ ] `/api/agent` が Node runtime で動いている
* [ ] `ANTHROPIC_API_KEY` が本番環境に設定されている
* [ ] Skill allowlistが有効
* [ ] Skill loader が SKILL.md を読める
* [ ] ADKが tool を呼べる（run_skillが発火する）
* [ ] ログに trace_id が出て追える
* [ ] 同時アクセス時に落ちない（concurrency調整済み）

---

# 次に：あなたのMVPを“コピペで動く”形に落とします

このドキュメントは設計全体です。次の1手で、実装を一気に具体化できます。

あなたが決めてくれると、こちらで「そのまま動くコード一式」を出せます：

1. **ADKの実行スタイル**：

   * (A) 1発JSON応答でOK
   * (B) SSEでストリーミングしたい
2. **Skillの呼び出し方式**：

   * (A) ユーザーがskillを明示（`/skill xxx`）
   * (B) ADKが自動選択（分類/ルーティング）
3. **最初に用意するSkill 2〜3個の名前**（仮でOK）

   * 例：`email_polisher`, `doc_summarizer`, `meeting_agenda`

返事は短くてOK。上の選択肢を A/B で教えてくれたら、次の回答で **雛形コード（Next.js + ADK + Skill loader/runner）を実ファイル単位で提示**します。
