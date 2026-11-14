// ASC_PRIVATE_KEY gizli değerini (nasıl yapıştırılmış olursa olsun) düzgün bir .p8 dosyasına yazar.
// Kullanım: node scripts/write-p8.mjs <hedef-dosya>
import { createPrivateKey } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const out = process.argv[2];
const body = String(process.env.ASC_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/["'\s]/g, "");
if (!out || body.length < 100) { console.error("ASC_PRIVATE_KEY eksik ya da geçersiz."); process.exit(1); }
const pem = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
createPrivateKey(pem); // geçersizse burada hata verir
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, pem, { mode: 0o600 });
console.log("Anahtar yazıldı.");
