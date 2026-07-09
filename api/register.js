// 商品登録API: ラベル情報+写真 → Shopify商品作成〜オンラインストア公開
// 必要な環境変数: STAFF_PIN, SHOPIFY_SHOP(例 ef8x6r-vh.myshopify.com),
//                SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET(推奨)
//                または SHOPIFY_ACCESS_TOKEN(固定トークン運用の場合)
const API_VERSION = '2026-07';

async function shopifyToken(shop) {
  if (process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN;
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  if (!r.ok) throw new Error(`Shopify認証失敗 (${r.status})`);
  return (await r.json()).access_token;
}

function gqlFactory(shop, token) {
  return async (query, variables) => {
    const r = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables: variables || {} })
    });
    const out = await r.json();
    if (out.errors) throw new Error(JSON.stringify(out.errors));
    return out.data;
  };
}

async function uploadImage(gql, b64, filename) {
  const buf = Buffer.from(b64, 'base64');
  const d = await gql(`mutation($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }}`, { input: [{ resource: 'IMAGE', filename, mimeType: 'image/jpeg', fileSize: String(buf.length), httpMethod: 'POST' }] });
  const t = d.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of t.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), filename);
  const up = await fetch(t.url, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`画像アップロード失敗 (${up.status})`);
  return t.resourceUrl;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { pin, item } = req.body || {};
  if (!process.env.STAFF_PIN || pin !== process.env.STAFF_PIN) {
    return res.status(401).json({ error: 'PINが違います' });
  }
  if (!item || !item.name || !item.price) {
    return res.status(400).json({ error: '商品名と価格は必須です' });
  }

  try {
    const shop = process.env.SHOPIFY_SHOP;
    const token = await shopifyToken(shop);
    const gql = gqlFactory(shop, token);

    // ロケーション(在庫用)
    const loc = (await gql('{ locations(first: 1) { nodes { id } } }')).locations.nodes[0];

    // 画像(任意)
    const files = [];
    if (item.image) {
      const url = await uploadImage(gql, item.image, `${(item.sku || 'item').toLowerCase()}.jpg`);
      files.push({ originalSource: url, contentType: 'IMAGE' });
    }

    const tags = [item.category || 'その他'];
    if (item.tag_new) tags.push('new');
    if (item.tag_cold) tags.push('要冷蔵');
    if (item.tag_sub) tags.push('予約');

    const handleBase = (item.sku || `drop-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const input = {
      title: item.name,
      handle: handleBase,
      vendor: item.kura || '',
      productType: item.type || '',
      status: item.draft ? 'DRAFT' : 'ACTIVE',
      tags,
      descriptionHtml: item.desc ? `<p>${item.desc}</p>` : '',
      files,
      metafields: [
        { namespace: 'custom', key: 'volume', type: 'single_line_text_field', value: item.volume || '' },
        { namespace: 'custom', key: 'region', type: 'single_line_text_field', value: item.region || '' },
        { namespace: 'custom', key: 'spec', type: 'multi_line_text_field', value: item.spec || '' },
        { namespace: 'custom', key: 'img_pos', type: 'single_line_text_field',
          value: (item.pos && (item.pos.s !== 1 || item.pos.x || item.pos.y)) ? `${item.pos.s},${item.pos.x},${item.pos.y}` : '' }
      ].filter(m => m.value),
      productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
      variants: [{
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: String(item.price),
        sku: item.sku || '',
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: true },
        inventoryQuantities: [{ locationId: loc.id, name: 'available', quantity: parseInt(item.qty || '0', 10) }]
      }]
    };

    const d = await gql(`mutation($input: ProductSetInput!) {
      productSet(input: $input) {
        product { id title handle }
        userErrors { field message }
      }}`, { input });
    const ps = d.productSet;
    if (ps.userErrors.length) {
      return res.status(422).json({ error: ps.userErrors.map(e => e.message).join(' / ') });
    }

    // オンラインストアへ公開(下書き以外)
    if (!item.draft) {
      const pubs = (await gql('{ publications(first: 10) { nodes { id name } } }')).publications.nodes;
      const online = pubs.find(p => p.name === 'Online Store') || pubs[0];
      await gql(`mutation($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) { userErrors { field message } }
      }`, { id: ps.product.id, input: [{ publicationId: online.id }] });
    }

    return res.status(200).json({
      ok: true,
      handle: ps.product.handle,
      title: ps.product.title,
      adminUrl: `https://admin.shopify.com/store/${shop.split('.')[0]}/products`,
      storeUrl: `https://${shop}/products/${ps.product.handle}`
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
