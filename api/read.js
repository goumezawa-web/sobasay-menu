// ラベル読取API: 画像→商品情報JSON (Anthropicキーはサーバー側で保持)
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name:     { type: 'string', description: '商品名(銘柄名)。ラベルの主たる商品名' },
    kura:     { type: 'string', description: '蔵元・醸造所・ワイナリー名。不明なら空文字' },
    region:   { type: 'string', description: '産地(都道府県または国・地域)。不明なら空文字' },
    category: { type: 'string', enum: ['焼酎', '日本酒', 'ビール', 'ワイン', 'その他'] },
    volume:   { type: 'string', description: '容量。例: 720ml, 1800ml。不明なら空文字' },
    type:     { type: 'string', description: '種別。例: 芋焼酎, 純米吟醸, IPA, 白ワイン' },
    alc:      { type: 'string', description: 'アルコール度数。例: 25%。不明なら空文字' },
    spec:     { type: 'string', description: 'SPEC欄用の要約。種別/原料/度数などを「 / 」区切りで' },
    cold:     { type: 'boolean', description: '要冷蔵と思われる場合true(生酒・無濾過生原酒・要冷蔵表記など)' },
    notes:    { type: 'string', description: '読み取りに自信がない箇所や補足。なければ空文字' }
  },
  required: ['name', 'kura', 'region', 'category', 'volume', 'type', 'alc', 'spec', 'cold', 'notes']
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { pin, image } = req.body || {};
  if (!process.env.STAFF_PIN || pin !== process.env.STAFF_PIN) {
    return res.status(401).json({ error: 'PINが違います' });
  }
  if (!image) return res.status(400).json({ error: '画像がありません' });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': process.env.ANTHROPIC_API_KEY
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: '酒販店の商品登録係。瓶ラベルの写真から商品情報を正確に読み取る。読めない項目は推測せず空文字にし、notesに書く。',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: 'このラベルを読み取って商品情報を抽出してください。' }
        ]
      }]
    })
  });
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    return res.status(502).json({ error: e?.error?.message || `AI応答エラー (${r.status})` });
  }
  const msg = await r.json();
  if (msg.stop_reason === 'refusal') return res.status(502).json({ error: '読取が拒否されました' });
  const text = (msg.content || []).find(b => b.type === 'text')?.text;
  if (!text) return res.status(502).json({ error: 'AI応答が空です' });
  try {
    return res.status(200).json(JSON.parse(text));
  } catch {
    return res.status(502).json({ error: 'AI応答の解析に失敗しました' });
  }
};
