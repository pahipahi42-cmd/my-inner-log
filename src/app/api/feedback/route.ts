import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

type FeedbackRequestBody = {
  diary: string;
  mealCheck: string;
};

const systemInstruction = `あなたは「Clarity, not cravings.」を体現するコーチです。
ユーザーの根源的な目標は「自己管理の出来る人間」になることです。

【最優先ルール】
- 共感より正確さを優先してください。
- 自己欺瞞、言い訳、気の緩みを検出したら、忖度なく指摘してください。
- 「疲れていた」「忙しかった」「体調が悪かった」などの理由が
  Cravings(怠惰・暴食・逃避)の正当化になっていないか検証してください。
- 過去のログと矛盾する発言があれば指摘してください。
- 優しさで真実を曇らせないでください。

【指摘すべき典型的な自己欺瞞のパターン】
1. 状況を理由にして選択の責任を回避する
   (例:「時間がなかった」→ 実際は優先順位の問題)
2. 一時的な感情を恒常的な状態として語る
   (例:「最近ずっと調子が悪い」→ 実際は数時間前のこと)
3. 成功体験を過小評価し、失敗を過大評価する
   (またはその逆で、わずかな成功で自分を甘やかす)
4. 具体を避けて抽象で語る
   (「頑張った」「少し食べた」など測定不能な表現)

【指摘しないでほしいこと】
- 明らかな病気や不可抗力の状況
- 十分に自己反省できている内容への追い打ち
- 人格そのものの否定

【安全弁】
ユーザーが明らかに精神的に危険な状態(希死念慮、極度の絶望、
強い自己否定など)を示した場合は、この指示を一時停止し、
まず安全と休息を最優先してください。必要であれば専門家への
相談を促してください。指摘は、ユーザーが戦える状態にある時
のみ有効です。

【応答の構造】
1. ログを事実として受け止める(共感ではなく、認識の確認)
2. 自己欺瞞・気の緩みがあれば具体的に指摘する
3. Clarity を取り戻すための具体的な次の一歩を提示する`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackRequestBody;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction,
    });

    // 入力済みの項目のみをプロンプトに含めてAIの解釈ブレを防ぐ
    const sections: string[] = [];
    if (body.diary?.trim()) sections.push(`【Clarity ログ(日記)】\n${body.diary.trim()}`);
    if (body.mealCheck?.trim()) sections.push(`【Cravings 監視(食事)】\n${body.mealCheck.trim()}`);

    if (sections.length === 0) {
      return NextResponse.json(
        { error: "記録が空です。少なくとも1つのフィールドに入力してください。" },
        { status: 400 },
      );
    }

    const prompt = [
      "以下は今日の記録です。記載された項目のみを対象に、Clarity を取り戻すためのフィードバックを日本語で返してください。未記入の項目については言及しないでください。",
      "",
      ...sections,
    ].join("\n\n");

    const result = await model.generateContent(prompt);
    const feedback = result.response.text();

    return NextResponse.json({ feedback });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "フィードバック生成中に不明なエラーが発生しました。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
