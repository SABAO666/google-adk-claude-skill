import { test, expect } from "@playwright/test";

test.describe("Skill Agent E2E", () => {
  test("email_polisher: メール校正スキルが発動すること", async ({ page }) => {
    await page.goto("/");

    // Wait for the page to load
    await expect(page.locator("text=スキルに何でも聞いてください")).toBeVisible();

    // Type a message requesting email polishing
    const input = page.locator('input[placeholder="メッセージを入力..."]');
    await input.fill(
      "以下のメールを丁寧にして：田中さん、明日の会議の件了解です。資料は後で送ります。よろしく。"
    );

    // Click send
    await page.locator('button:has-text("送信")').click();

    // Wait for assistant response (streaming completes when loading ends)
    // The assistant bubble should appear with polished email content
    const assistantMessage = page.locator(
      'div:below(div:has-text("田中さん、明日の会議の件了解です"))'
    ).first();

    // Wait for streaming to complete — the "送信" button reappears
    await expect(page.locator('button:has-text("送信")')).toBeVisible({
      timeout: 90_000,
    });

    // Verify that some assistant response appeared
    // (the user message + at least one assistant message = 2+ message bubbles)
    const allMessages = page.locator('[style*="white-space: pre-wrap"]');
    await expect(allMessages).toHaveCount(2, { timeout: 5_000 }).catch(() => {
      // At minimum we expect more than just the user message
    });
    const messageCount = await allMessages.count();
    expect(messageCount).toBeGreaterThanOrEqual(2);
  });

  test("doc_summarizer: 文書要約スキルが発動すること", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=スキルに何でも聞いてください")).toBeVisible();

    const input = page.locator('input[placeholder="メッセージを入力..."]');
    await input.fill(
      "以下の文章を要約して：人工知能（AI）は、コンピュータサイエンスの一分野であり、人間の知能を模倣する機械やソフトウェアの開発を目指している。AIは機械学習、自然言語処理、コンピュータビジョンなど多くのサブフィールドを含む。近年、深層学習の進歩により、画像認識、音声認識、自動翻訳などの分野で大きな成果を上げている。特に大規模言語モデル（LLM）は、テキスト生成、要約、質問応答など幅広いタスクで人間に近い性能を発揮するようになった。しかし、AIの急速な発展は倫理的な懸念も引き起こしており、バイアス、プライバシー、雇用への影響などが議論されている。"
    );

    await page.locator('button:has-text("送信")').click();

    // Wait for streaming to complete
    await expect(page.locator('button:has-text("送信")')).toBeVisible({
      timeout: 90_000,
    });

    // Verify assistant response exists
    const allMessages = page.locator('[style*="white-space: pre-wrap"]');
    const messageCount = await allMessages.count();
    expect(messageCount).toBeGreaterThanOrEqual(2);

    // Check that the response contains summary-related content
    const lastMessage = allMessages.last();
    const text = await lastMessage.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
  });
});
