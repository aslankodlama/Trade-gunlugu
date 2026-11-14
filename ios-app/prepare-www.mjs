// fikirler/ klasörünü Capacitor'ın www/ klasörüne kopyalar (iPhone uygulamasının içeriği).
import { cpSync, rmSync, mkdirSync } from "node:fs";
const ROOT = new URL("../", import.meta.url).pathname;
const WWW = new URL("./www/", import.meta.url).pathname;
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
cpSync(ROOT + "fikirler/", WWW, { recursive: true });
console.log("www hazır");
