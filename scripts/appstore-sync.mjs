// App Store Connect'ten uygulama, sürüm ve build bilgilerini çekip fikirler/appstore.json dosyasına yazar.
// Gerekli ortam değişkenleri (GitHub → Settings → Secrets and variables → Actions):
//   ASC_ISSUER_ID   – App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar → API Anahtarları → "Issuer ID"
//   ASC_KEY_ID      – Oluşturduğun anahtarın "Key ID" değeri
//   ASC_PRIVATE_KEY – İndirdiğin AuthKey_XXXX.p8 dosyasının tüm içeriği
import { createSign, createPrivateKey } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const ASC_ISSUER_ID = process.env.ASC_ISSUER_ID?.trim(), ASC_KEY_ID = process.env.ASC_KEY_ID?.trim(), ASC_PRIVATE_KEY = process.env.ASC_PRIVATE_KEY;
const OUT = process.argv[2] || "fikirler/appstore.json";
if (!ASC_ISSUER_ID || !ASC_KEY_ID || !ASC_PRIVATE_KEY) {
  console.error("ASC_ISSUER_ID, ASC_KEY_ID ve ASC_PRIVATE_KEY tanımlı olmalı.");
  process.exit(1);
}

// Anahtar nasıl yapıştırılmış olursa olsun (tek satır, fazladan boşluk, tırnak, \\n, başlıksız) düzgün PEM'e çevir
function loadKey(raw) {
  const body = String(raw)
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/["'\s]/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(body) || body.length < 100) {
    console.error(`ASC_PRIVATE_KEY geçersiz görünüyor (${body.length} karakter). .p8 dosyasının TAMAMINI yapıştır: "-----BEGIN PRIVATE KEY-----" satırından "-----END PRIVATE KEY-----" satırına kadar.`);
    process.exit(1);
  }
  const pem = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
  try {
    return createPrivateKey(pem);
  } catch {
    try { return createPrivateKey({ key: Buffer.from(body, "base64"), format: "der", type: "pkcs8" }); }
    catch (e) {
      console.error(`ASC_PRIVATE_KEY okunamadı (${body.length} karakter): ${e.message}. Doğru .p8 dosyasını mı yapıştırdın? Key ID ya da Issuer ID değil, dosyanın içeriği olmalı.`);
      process.exit(1);
    }
  }
}
const KEY = loadKey(ASC_PRIVATE_KEY);

const b64u = b => Buffer.from(b).toString("base64url");
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const s = createSign("SHA256");
  s.update(`${head}.${body}`);
  return `${head}.${body}.${b64u(s.sign({ key: KEY, dsaEncoding: "ieee-p1363" }))}`;
}
const JWT = token();

async function api(path) {
  const r = await fetch("https://api.appstoreconnect.apple.com" + path, { headers: { Authorization: `Bearer ${JWT}` } });
  if (r.status === 401) { console.error("401: Apple anahtarı kabul etmedi. ASC_KEY_ID ve ASC_ISSUER_ID değerlerini kontrol et; anahtar iptal edilmiş olabilir."); process.exit(1); }
  if (r.status === 403) { console.error("403: Anahtarın yetkisi yetmiyor. App Store Connect'te anahtara en az 'Geliştirici' erişimi ver."); process.exit(1); }
  if (!r.ok) throw new Error(`${r.status} ${path}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
const safe = async (p, fallback) => { try { return await p; } catch (e) { console.warn(String(e.message || e)); return fallback; } };

const apps = (await api("/v1/apps?limit=200&fields[apps]=name,bundleId,sku,primaryLocale")).data;
const out = { updated: new Date().toISOString(), apps: [] };

for (const a of apps) {
  const app = { id: a.id, name: a.attributes.name, bundleId: a.attributes.bundleId, sku: a.attributes.sku, versions: [], builds: [], live: null };

  // Sürümler (en yeni 15)
  const vers = await safe(api(`/v1/apps/${a.id}/appStoreVersions?limit=15&fields[appStoreVersions]=versionString,appStoreState,appVersionState,platform,createdDate,earliestReleaseDate,releaseType`), { data: [] });
  for (const v of vers.data) {
    const loc = await safe(api(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,whatsNew&limit=50`), { data: [] });
    const pick = loc.data.find(l => l.attributes.locale?.startsWith("tr")) || loc.data.find(l => l.attributes.locale === a.attributes.primaryLocale) || loc.data[0];
    app.versions.push({
      id: v.id,
      version: v.attributes.versionString,
      state: v.attributes.appVersionState || v.attributes.appStoreState,
      platform: v.attributes.platform,
      created: v.attributes.createdDate,
      whatsNew: pick?.attributes.whatsNew || ""
    });
  }

  // Son build'ler
  const builds = await safe(api(`/v1/builds?filter[app]=${a.id}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState,expired,iconAssetToken&include=preReleaseVersion&fields[preReleaseVersions]=version`), { data: [], included: [] });
  const pre = Object.fromEntries((builds.included || []).map(i => [i.id, i.attributes.version]));
  for (const b of builds.data) {
    // Build'in içindeki uygulama ikonu (yayınlanmamış uygulamalarda da var)
    const tpl = b.attributes.iconAssetToken?.templateUrl;
    if (tpl && !app.icon) app.icon = tpl.replace("{w}", "256").replace("{h}", "256").replace("{f}", "png");
    app.builds.push({
      build: b.attributes.version,
      version: pre[b.relationships?.preReleaseVersion?.data?.id] || "",
      uploaded: b.attributes.uploadedDate,
      state: b.attributes.processingState,
      expired: !!b.attributes.expired
    });
  }

  // Mağazadaki canlı sürüm ve yayın tarihi (herkese açık arama servisi)
  const lk = await safe(fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(app.bundleId)}&country=tr`).then(r => r.json()), null);
  const it = lk?.results?.[0];
  if (it?.artworkUrl512) app.icon = it.artworkUrl512;
  if (it) app.live = { version: it.version, releaseDate: it.currentVersionReleaseDate, url: it.trackViewUrl, notes: it.releaseNotes || "", rating: it.averageUserRating ?? null, ratings: it.userRatingCount ?? 0 };

  out.apps.push(app);
  console.log(`✓ ${app.name}: ${app.versions.length} sürüm, ${app.builds.length} build`);
}

// Sadece saat değiştiyse dosyaya dokunma (gereksiz commit olmasın)
const old = await readFile(OUT, "utf8").then(JSON.parse).catch(() => null);
if (old && JSON.stringify(old.apps) === JSON.stringify(out.apps)) {
  console.log("Değişiklik yok");
} else {
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(`${out.apps.length} uygulama → ${OUT}`);
}
