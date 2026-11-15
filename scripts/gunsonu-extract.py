"""Gün sonu: list_events çıktısından (dosya) kullanıcı mesajlarını ve asistanın düz metin cevaplarını çıkarır.
Kullanım: python3 scripts/gunsonu-extract.py <list_events-çıktı-dosyası> [karakter-sınırı]"""
import json, re, sys
raw = open(sys.argv[1], encoding='utf-8').read()
start = raw.index('{"ccr"')
end = raw.rindex('}') + 1
data = json.loads(raw[start:end])["ccr"]
out = []
for ev in data["data"]:
    t = ev.get("created_at", "")[:16]
    for role in ("user", "assistant"):
        e = ev.get(role)
        if not e:
            continue
        msg = (e.get("internal_anthropic_catchall") or e).get("message") or e.get("message") or {}
        content = msg.get("content")
        if isinstance(content, str):
            texts = [content]
        else:
            texts = [c.get("text", "") for c in (content or []) if isinstance(c, dict) and c.get("type") == "text"]
        for tx in texts:
            tx = tx.strip()
            if not tx or tx.startswith("<") or "agent's report" in tx or tx.startswith("[Request interrupted"):
                continue
            out.append(f"[{t}] {role.upper()}: {tx}")
print(f"# {len(out)} mesaj; has_more={data.get('has_more')} first_id={data.get('first_id')}")
lim = int(sys.argv[2]) if len(sys.argv) > 2 else 600
for o in out:
    print(o[:lim])
