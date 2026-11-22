"""fikirler/gunsonu.json kontrolü: geçerli JSON mu, Türkçe karakterler bozuk mu (ör. "Gardƒ±rop", "s√ºr√ºm√º").
Kullanım:
  python3 scripts/gunsonu-check.py          → sadece kontrol eder (bozuksa hata kodu 1)
  python3 scripts/gunsonu-check.py --fix    → bozuk yazıları düzeltip dosyayı UTF-8 olarak yeniden yazar
"""
import json, re, sys

PATH = "fikirler/gunsonu.json"
BOZUK = re.compile(r"[√ƒ∂∑ﬁﬂ]|‚Ä|Ã[\x80-\xbf§¶¼]|Ä±|ÅŸ|Ä[ŸŞ]")
ZORUNLU = {"id", "app", "kind", "text"}
TURLER = {"where", "todo", "done", "idea"}


def onar(t):
    """UTF-8 yazının Mac Roman / Latin-1 sanılıp yeniden kaydedilmesini geri alır."""
    for kod in ("mac_roman", "cp1252", "latin-1"):
        try:
            d = t.encode(kod).decode("utf-8")
            if not BOZUK.search(d):
                return d
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return t


def main():
    fix = "--fix" in sys.argv
    d = json.load(open(PATH, encoding="utf-8"))
    hatalar, duzelen, idler = [], 0, set()
    for i, it in enumerate(d.get("items", [])):
        eksik = ZORUNLU - it.keys()
        if eksik:
            hatalar.append(f"{i}. madde: eksik alan {sorted(eksik)}")
        if it.get("kind") not in TURLER:
            hatalar.append(f"{it.get('id')}: kind '{it.get('kind')}' geçersiz")
        if it.get("id") in idler:
            hatalar.append(f"{it.get('id')}: aynı id iki kez")
        idler.add(it.get("id"))
        for k in ("app", "text"):
            v = it.get(k, "")
            if BOZUK.search(v):
                if fix:
                    it[k] = onar(v)
                    duzelen += 1
                if BOZUK.search(it[k]):
                    hatalar.append(f"{it.get('id')}: '{k}' bozuk karakter içeriyor: {it[k][:60]}")
    if fix and duzelen:
        with open(PATH, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"{duzelen} alan düzeltildi.")
    if hatalar:
        print("\n".join(hatalar))
        sys.exit(1)
    print(f"Tamam: {len(d.get('items', []))} madde, bozuk karakter yok.")


main()
