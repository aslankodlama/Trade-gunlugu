// TestFlight'tan önce Apple hesabını hazırlar:
//  1) Bundle ID yoksa oluşturur
//  2) Team ID'yi Bundle ID'den bulur (IOS_TEAM_ID verilmediyse)
//  3) App Store Connect'te uygulama kaydı var mı bakar
// Bulunan TEAM_ID, GitHub Actions ortamına yazılır.
import { createSign, createPrivateKey } from "node:crypto";
import { appendFileSync } from "node:fs";

const BUNDLE = process.env.BUNDLE_ID || "com.aslankodlama.fikirler";
const NAME = process.env.APP_NAME || "Fikirler";
const body = String(process.env.ASC_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/["'\s]/g, "");
const KEY = createPrivateKey(`-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`);
const b64u = b => Buffer.from(b).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64u(JSON.stringify({ alg: "ES256", kid: process.env.ASC_KEY_ID.trim(), typ: "JWT" }));
const claims = b64u(JSON.stringify({ iss: process.env.ASC_ISSUER_ID.trim(), iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
const sig = createSign("SHA256").update(`${head}.${claims}`).sign({ key: KEY, dsaEncoding: "ieee-p1363" });
const JWT = `${head}.${claims}.${b64u(sig)}`;

async function api(method, path, data) {
  const r = await fetch("https://api.appstoreconnect.apple.com" + path, {
    method, headers: { Authorization: `Bearer ${JWT}`, "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}
const fail = m => { console.log(`::error::${m}`); process.exit(1); };
const perm = s => (s === 401 || s === 403)
  ? " Anahtarın yetkisi yetmiyor: App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar'da 'Admin' yetkili yeni anahtar oluştur ve GitHub'daki ASC_* gizli değerlerini güncelle." : "";

// 1) Bundle ID
let { status, j } = await api("GET", `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&limit=20`);
if (status !== 200) fail(`Bundle ID listesi alınamadı (${status}).${perm(status)}`);
let bundle = (j.data || []).find(b => b.attributes.identifier === BUNDLE);
if (!bundle) {
  ({ status, j } = await api("POST", "/v1/bundleIds", { data: { type: "bundleIds", attributes: { identifier: BUNDLE, name: NAME, platform: "IOS" } } }));
  if (status !== 201) fail(`Bundle ID oluşturulamadı (${status}): ${JSON.stringify(j.errors?.[0]?.detail || "")}.${perm(status)}`);
  bundle = j.data;
  console.log(`✓ Bundle ID oluşturuldu: ${BUNDLE}`);
} else console.log(`✓ Bundle ID hazır: ${BUNDLE}`);

// 2) Team ID
const team = (process.env.TEAM_ID || "").trim() || bundle.attributes.seedId;
if (!team) fail("Team ID bulunamadı. GitHub → Settings → Secrets and variables → Actions → Variables: IOS_TEAM_ID ekle.");
console.log(`✓ Team ID: ${team}`);
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `TEAM_ID=${team}\n`);

// 3) Uygulama kaydı
({ status, j } = await api("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE)}&limit=5`));
const app = (j.data || []).find(a => a.attributes.bundleId === BUNDLE);
if (!app) fail(`App Store Connect'te bu uygulamanın kaydı yok. Uygulamalar → ＋ → Yeni Uygulama: ad "${NAME}", Bundle ID listesinden "${BUNDLE}" seç, SKU "fikirler". Sonra bu işi yeniden çalıştır.`);
console.log(`✓ App Store Connect kaydı: ${app.attributes.name}`);
