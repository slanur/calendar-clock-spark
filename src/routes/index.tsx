import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as E from "@/lib/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kampüs Kaynak Rezervasyon Sistemi" },
      { name: "description", content: "Oda, laboratuvar, 3B yazıcı ve GPU rezervasyonları için kaynak takvimi, talep formu ve olay günlüğü." },
      { property: "og:title", content: "Kampüs Kaynak Rezervasyon Sistemi" },
      { property: "og:description", content: "Kaynak Puanı ile çalışan kampüs rezervasyon arayüzü." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

const START = 8 * 60, END = 22 * 60, SPAN = END - START;
const DURUM_CLS: Record<E.Durum, string> = {
  ONAYLI: "bg-st-onayli/85 text-background",
  KULLANIMDA: "bg-st-kullanimda text-foreground",
  TAMAMLANDI: "bg-st-tamam/80 text-background",
  GELMEDI: "bg-st-gelmedi/30 text-foreground border border-dashed border-st-gelmedi",
  IPTAL: "bg-st-iptal/25 text-muted-foreground border border-dashed border-st-iptal line-through",
};
const DURUM_DOT: Record<E.Durum, string> = {
  ONAYLI: "bg-st-onayli", KULLANIMDA: "bg-st-kullanimda", TAMAMLANDI: "bg-st-tamam", GELMEDI: "bg-st-gelmedi", IPTAL: "bg-st-iptal",
};
const SAATLER = Array.from({ length: 57 }, (_, i) => START + i * 15);
const toMin = (hhmm: string) => { const [h = 0, m = 0] = hhmm.split(":").map(Number); return h * 60 + m; };

type Sonuc = { ok: boolean; title: string; lines: string[]; waitable?: (E.Kalem & { u: string }) | undefined; kalemler?: { kaynak: string; kod: string }[] };

function App() {
  const [s, setS] = useState<E.State>(E.initialState);
  const [dosya, setDosya] = useState("baslangic.json");
  const [gun, setGun] = useState(0);
  const [aktifU, setAktifU] = useState("u1");
  const [secili, setSecili] = useState<string | null>(null);
  const [logSec, setLogSec] = useState<number | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [prefill, setPrefill] = useState<{ kaynak: string; bas: number; n: number } | null>(null);

  const run = (fn: (st: E.State) => { state: E.State; sonuc: any }, title: string) => {
    const r = fn(s);
    setS(r.state);
    return r.sonuc;
  };

  const kul = s.kullanicilar.find((u) => u.id === aktifU)!;
  const rez = s.rez.find((r) => r.id === secili);

  const olaySatirlari = (olaylar: any[] = []) =>
    olaylar.map((o) => o.tur === "OTOMATIK_ATAMA" ? `OTOMATIK_ATAMA → ${o.rezervasyon} (${o.kullanici}, ${o.ucret} KP)` : `${o.tur} · ${o.rezervasyon} · ${o.kullanici} güv. ${o.guvenilirlik}`);

  const eylem = (tip: "giris" | "cikis" | "iptal") => {
    if (!rez) return;
    const so = run((st) => E[tip](st, rez.id), tip);
    if (so.durum === "RED") return setSonuc({ ok: false, title: `${tip.toUpperCase()} reddedildi`, lines: [so.kod] });
    const lines = [];
    if ("iade" in so) lines.push(`İade: ${so.iade} KP`, `Bakiye: ${so.bakiye} KP`);
    if ("guvenilirlik" in so) lines.push(`Güvenilirlik: ${so.guvenilirlik}`);
    lines.push(...olaySatirlari(so.olaylar));
    setSonuc({ ok: true, title: `${rez.id} · ${tip} tamam`, lines });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">KP</div>
            <div>
              <div className="text-sm font-semibold leading-tight">Kampüs Kaynak Rezervasyon</div>
              <div className="font-mono text-[11px] text-muted-foreground">{dosya}</div>
            </div>
          </div>
          <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
            Başlangıç dosyası seç
            <input type="file" accept=".json" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setDosya(f.name); setS(E.initialState()); setSecili(null); setSonuc(null); setGun(0);
            }} />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-right">
              <div className="text-[10px] uppercase tracking-widest text-primary">Simüle saat</div>
              <div className="font-mono text-sm">{E.fmtGun(s.saat)} · {E.fmtSaat(s.saat)}</div>
            </div>
            {[15, 60, 240].map((m) => (
              <button key={m} className="rounded-md bg-secondary px-2.5 py-2 font-mono text-xs hover:bg-accent"
                onClick={() => {
                  const so = run((st) => E.saatIlerle(st, st.saat + m), "saat");
                  setSonuc({ ok: true, title: `Saat → ${E.fmtSaat(s.saat + m)}`, lines: so.olaylar.length ? olaySatirlari(so.olaylar) : ["Olay oluşmadı."] });
                }}>+{m >= 60 ? `${m / 60}s` : `${m}dk`}</button>
            ))}
          </div>

          <select value={aktifU} onChange={(e) => setAktifU(e.target.value)}
            className="rounded-md border bg-card px-3 py-2 text-sm">
            {s.kullanicilar.map((u) => <option key={u.id} value={u.id}>{u.ad} · {u.rol}</option>)}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-6 py-5">
        <Takvim s={s} gun={gun} setGun={setGun} secili={secili} setSecili={setSecili} onSlot={(kaynak, bas) => { setPrefill({ kaynak, bas, n: Date.now() }); document.getElementById("talep")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />

        {sonuc && (
          <div className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${sonuc.ok ? "border-success/50 bg-success/10" : "border-destructive/50 bg-destructive/10"}`}>
            <div>
              <div className={`text-sm font-semibold ${sonuc.ok ? "text-success" : "text-destructive"}`}>{sonuc.title}</div>
              {sonuc.kalemler ? (
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  {sonuc.kalemler.map((k, i) => (
                    <li key={i} className={k.kod === "GECERLI" ? "text-success" : "text-destructive"}>
                      Kalem {i + 1} · {k.kaynak} → {k.kod === "GECERLI" ? "geçti" : `${k.kod} — ${E.HATA[k.kod] ?? ""}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground">{sonuc.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
              )}
              {sonuc.waitable && (
                <button className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  onClick={() => {
                    const w = sonuc.waitable!;
                    const so = run((st) => E.bekle(st, w.u, w.kaynak, w.bas, w.bit), "bekleme");
                    setSonuc({ ok: true, title: `Bekleme kaydı açıldı: ${so.bekleme_id}`, lines: ["Yer boşalınca otomatik atanacaksınız."] });
                  }}>Bu aralık için bekleme listesine gir</button>
              )}
            </div>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setSonuc(null)}>✕</button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr]">
          <TalepFormu key={prefill?.n ?? 0} prefill={prefill} s={s} kul={kul} gun={gun} run={run} setSonuc={setSonuc} />

          <div className="space-y-5">
            {rez && (
              <Panel title={`Rezervasyon ${rez.id}`} right={<button className="text-xs text-muted-foreground" onClick={() => setSecili(null)}>kapat</button>}>
                <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Kullanıcı</dt><dd>{s.kullanicilar.find((u) => u.id === rez.kullanici)?.ad}</dd>
                  <dt className="text-muted-foreground">Kaynak</dt><dd className="font-mono">{rez.kaynak}</dd>
                  <dt className="text-muted-foreground">Aralık</dt><dd className="font-mono">{E.fmtGun(rez.bas)} {E.fmtSaat(rez.bas)}–{E.fmtSaat(rez.bit)}</dd>
                  <dt className="text-muted-foreground">Ücret</dt><dd className="font-mono">{rez.ucret} KP</dd>
                  <dt className="text-muted-foreground">Durum</dt><dd><Badge d={rez.durum} /></dd>
                  {rez.paket && <><dt className="text-muted-foreground">Paket</dt><dd className="font-mono">{rez.paket}</dd></>}
                </dl>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Btn disabled={rez.durum !== "ONAYLI"} onClick={() => eylem("giris")}>Giriş</Btn>
                  <Btn disabled={rez.durum !== "KULLANIMDA"} onClick={() => eylem("cikis")}>Çıkış</Btn>
                  <Btn danger disabled={rez.durum !== "ONAYLI"} onClick={() => eylem("iptal")}>İptal</Btn>
                </div>
              </Panel>
            )}
            <KullaniciPaneli s={s} kul={kul} setSecili={setSecili} />
          </div>

          <Panel title="Olay günlüğü" right={<span className="font-mono text-xs text-muted-foreground">{s.log.length} kayıt</span>}>
            <div className="max-h-[460px] space-y-1 overflow-auto pr-1">
              {s.log.length === 0 && <p className="text-sm text-muted-foreground">Henüz işlem yapılmadı.</p>}
              {s.log.map((l) => (
                <div key={l.id}>
                  <button onClick={() => setLogSec(logSec === l.id ? null : l.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-accent ${logSec === l.id ? "bg-accent" : ""}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${l.ok ? "bg-success" : "bg-destructive"}`} />
                    <span className="text-muted-foreground">#{l.id}</span>
                    <span className="text-muted-foreground">{E.fmtSaat(l.zaman)}</span>
                    <span className="font-semibold">{l.komut}</span>
                    <span className="ml-auto truncate text-muted-foreground">{(l.sonuc as any).kod ?? (l.sonuc as any).durum}</span>
                  </button>
                  {logSec === l.id && (
                    <div className="mb-2 space-y-2 rounded border bg-background p-2 font-mono text-[11px]">
                      <div className="text-primary">komut</div>
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(l.istek)}</pre>
                      <div className="text-primary">sonuç</div>
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(l.sonuc)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}

function Takvim({ s, gun, setGun, secili, setSecili, onSlot }: { s: E.State; gun: number; setGun: (n: number) => void; secili: string | null; setSecili: (id: string) => void; onSlot: (k: string, bas: number) => void }) {
  const d0 = gun * 1440;
  const pct = (m: number) => `${((Math.max(START, Math.min(END, m - d0)) - START) / SPAN) * 100}%`;
  const w = (a: number, b: number) => `${((Math.min(END, b - d0) - Math.max(START, a - d0)) / SPAN) * 100}%`;
  const inDay = (a: number, b: number) => b - d0 > START && a - d0 < END;
  const nowIn = s.saat - d0 >= START && s.saat - d0 <= END;

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
        <div><h2 className="text-base font-semibold">Kaynak takvimi</h2><p className="text-[11px] text-muted-foreground">Boş alana tıkla → talep formu dolsun</p></div>
        <div className="flex items-center gap-1">
          <button className="rounded px-2 py-1 hover:bg-accent" onClick={() => setGun(Math.max(0, gun - 1))}>‹</button>
          <span className="min-w-28 text-center font-mono text-sm">{E.fmtGun(d0)}</span>
          <button className="rounded px-2 py-1 hover:bg-accent" onClick={() => setGun(gun + 1)}>›</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(DURUM_DOT) as E.Durum[]).map((d) => (
            <span key={d} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${DURUM_DOT[d]}`} />{d}</span>
          ))}
          <span className="flex items-center gap-1.5"><span className="hatch h-2.5 w-4 rounded-sm" />Bakım</span>
          <span className="flex items-center gap-1.5"><span className="hatch-prep h-2.5 w-4 rounded-sm" />Hazırlık</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[960px] px-5 pb-4">
          <div className="ml-44 flex h-7 items-end">
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="flex-1 font-mono text-[10px] text-muted-foreground">{String(8 + i).padStart(2, "0")}:00</div>
            ))}
          </div>
          {s.kaynaklar.map((k) => {
            const list = s.rez.filter((r) => r.kaynak === k.id && inDay(r.bas, r.bit));
            const aktif = list.filter((r) => r.durum !== "IPTAL" && r.durum !== "GELMEDI");
            const pasif = list.filter((r) => r.durum === "IPTAL" || r.durum === "GELMEDI");
            const lane = (r: E.Rez) => pasif.includes(r) && aktif.some((a) => a.bas < r.bit && a.bit > r.bas) ? 1 : 0;
            const lanes = list.some((r) => lane(r) === 1) ? 2 : 1;
            const hz = E.TURLER[k.tur].hazirlik;
            return (
              <div key={k.id} className="flex border-t">
                <div className="w-44 shrink-0 py-2 pr-3">
                  <div className="font-mono text-xs font-semibold">{k.id}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{k.ad} · {k.tur}</div>
                </div>
                <div title="Boş alana tıklayarak talep oluştur" onClick={(e) => { if (e.target !== e.currentTarget) return; const r = e.currentTarget.getBoundingClientRect(); const m = START + Math.floor(((e.clientX - r.left) / r.width) * SPAN / 15) * 15; onSlot(k.id, Math.min(m, END - 60)); }} className="relative flex-1 grid-15 cursor-copy hover:bg-accent/40" style={{ height: lanes * 34 + 10, backgroundSize: `${100 / 56}% 100%` }}>
                  {s.bakim.filter((b) => b.kaynak === k.id && inDay(b.bas, b.bit)).map((b, i) => (
                    <div key={i} className="hatch absolute inset-y-1 rounded border border-st-bakim/60" style={{ left: pct(b.bas), width: w(b.bas, b.bit) }}
                      title={`Bakım ${E.fmtSaat(b.bas)}–${E.fmtSaat(b.bit)}`} />
                  ))}
                  {hz > 0 && aktif.map((r) => inDay(r.bit, r.bit + hz) && (
                    <div key={`h${r.id}`} className="hatch-prep absolute rounded-r" style={{ left: pct(r.bit), width: w(r.bit, r.bit + hz), top: 5, height: 30 }} title={`Hazırlık ${hz} dk`} />
                  ))}
                  {list.map((r) => (
                    <button key={r.id} onClick={() => setSecili(r.id)}
                      className={`absolute overflow-hidden rounded px-1.5 text-left text-[11px] leading-tight transition hover:brightness-110 ${DURUM_CLS[r.durum]} ${secili === r.id ? "ring-2 ring-foreground" : ""}`}
                      style={{ left: pct(r.bas), width: w(r.bas, r.bit), top: 5 + lane(r) * 34, height: 30 }}>
                      <div className="truncate font-mono font-semibold">{r.id} · {r.kullanici}{r.paket ? ` · ${r.paket}` : ""}</div>
                      <div className="truncate opacity-80">{E.fmtSaat(r.bas)}–{E.fmtSaat(r.bit)} · {r.ucret} KP</div>
                    </button>
                  ))}
                  {nowIn && <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary" style={{ left: pct(s.saat) }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TalepFormu({ s, kul, gun, run, setSonuc, prefill }: { prefill: { kaynak: string; bas: number } | null; s: E.State; kul: E.Kullanici; gun: number; run: any; setSonuc: (x: Sonuc) => void }) {
  const [mod, setMod] = useState<"tek" | "paket">("tek");
  const [kalemler, setKalemler] = useState([prefill ? { kaynak: prefill.kaynak, bas: E.fmtSaat(prefill.bas), bit: E.fmtSaat(prefill.bas + 60) } : { kaynak: "ODA-1", bas: "11:00", bit: "12:00" }]);
  const d0 = gun * 1440;
  const parsed = kalemler.map((k) => ({ kaynak: k.kaynak, bas: d0 + toMin(k.bas), bit: d0 + toMin(k.bit) }));
  const ucretler = useMemo(() => parsed.map((p) => (p.bit > p.bas ? E.fiyat(s, p.kaynak, p.bas, p.bit) : 0)), [s, JSON.stringify(parsed)]);
  const toplam = ucretler.reduce((a, b) => a + b, 0);

  const setK = (i: number, patch: Partial<(typeof kalemler)[0]>) => setKalemler(kalemler.map((k, j) => (j === i ? { ...k, ...patch } : k)));

  const gonder = () => {
    if (mod === "tek") {
      const p = parsed[0]!;
      const so = run((st: E.State) => E.rezervasyon(st, kul.id, p.kaynak, p.bas, p.bit));
      if (so.durum === "RED") {
        setSonuc({ ok: false, title: `Reddedildi · ${so.kod}`, lines: [E.HATA[so.kod] ?? so.kod],
          waitable: so.kod === "KESISME" || so.kod === "HAZIRLIK_IHLALI" ? { ...p, u: kul.id } : undefined });
      } else setSonuc({ ok: true, title: `Onaylandı · ${so.rezervasyon_id}`, lines: [`Ücret: ${so.ucret} KP`, `Yeni bakiye: ${so.bakiye} KP`] });
    } else {
      const so = run((st: E.State) => E.paket(st, kul.id, parsed));
      if (so.durum === "RED") {
        if (so.kod === "PAKET_RED") setSonuc({ ok: false, title: "PAKET_RED · paket reddedildi", lines: [], kalemler: so.kalemler.map((c: string, i: number) => ({ kaynak: parsed[i]?.kaynak ?? "", kod: c })) });
        else setSonuc({ ok: false, title: so.kod, lines: [E.HATA[so.kod] ?? so.kod] });
      } else setSonuc({ ok: true, title: `Paket onaylandı · ${so.paket_id}`, lines: [`Rezervasyonlar: ${so.rezervasyonlar.join(", ")}`, `Toplam: ${so.toplam} KP`, `Yeni bakiye: ${so.bakiye} KP`] });
    }
  };

  return (
    <div id="talep"><Panel title="Talep formu" right={
      <div className="flex rounded-md bg-secondary p-0.5 text-xs">
        {(["tek", "paket"] as const).map((m) => (
          <button key={m} onClick={() => { setMod(m); if (m === "tek") setKalemler(kalemler.slice(0, 1)); else if (kalemler.length < 2) setKalemler([...kalemler, { kaynak: "LAB-1", bas: "11:00", bit: "12:00" }]); }}
            className={`rounded px-3 py-1 ${mod === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m === "tek" ? "Tek" : "Paket"}</button>
        ))}
      </div>}>
      <p className="mb-3 text-xs text-muted-foreground">{kul.ad} adına · {E.fmtGun(d0)}</p>
      <div className="space-y-2">
        {kalemler.map((k, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-md border bg-background p-2">
            <select value={k.kaynak} onChange={(e) => setK(i, { kaynak: e.target.value })} className="rounded bg-secondary px-2 py-1.5 text-sm">
              {s.kaynaklar.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.ad}</option>)}
            </select>
            <select value={k.bas} onChange={(e) => setK(i, { bas: e.target.value })} className="rounded bg-secondary px-1.5 py-1.5 font-mono text-xs">
              {SAATLER.map((m) => <option key={m}>{E.fmtSaat(m)}</option>)}
            </select>
            <select value={k.bit} onChange={(e) => setK(i, { bit: e.target.value })} className="rounded bg-secondary px-1.5 py-1.5 font-mono text-xs">
              {SAATLER.map((m) => <option key={m}>{E.fmtSaat(m)}</option>)}
            </select>
            <span className="w-14 text-right font-mono text-xs text-primary">{ucretler[i]} KP</span>
          </div>
        ))}
      </div>
      {mod === "paket" && (
        <div className="mt-2 flex gap-2 text-xs">
          <button disabled={kalemler.length >= 4} className="text-primary disabled:opacity-40" onClick={() => setKalemler([...kalemler, { kaynak: "ODA-2", bas: "11:00", bit: "12:00" }])}>+ kalem ekle</button>
          <button disabled={kalemler.length <= 2} className="text-muted-foreground disabled:opacity-40" onClick={() => setKalemler(kalemler.slice(0, -1))}>− son kalemi sil</button>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tahmini ücret</div>
          <div className="font-mono text-xl font-semibold text-primary">{toplam} KP</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">Bakiye <span className="font-mono text-foreground">{kul.bakiye}</span><br />Sonrası <span className={`font-mono ${kul.bakiye - toplam < 0 ? "text-destructive" : "text-foreground"}`}>{kul.bakiye - toplam}</span></div>
      </div>
      <button onClick={gonder} className="mt-3 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
        {mod === "tek" ? "Rezervasyon talep et" : `Paketi talep et (${kalemler.length} kalem)`}
      </button>
    </Panel></div>
  );
}

function KullaniciPaneli({ s, kul, setSecili }: { s: E.State; kul: E.Kullanici; setSecili: (id: string) => void }) {
  const kota = E.ROLLER[kul.rol].kota;
  const rezler = s.rez.filter((r) => r.kullanici === kul.id).sort((a, b) => a.bas - b.bas);
  const bekl = s.bekleme.filter((b) => b.kullanici === kul.id);
  return (
    <Panel title={kul.ad} right={<span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px]">{kul.rol}</span>}>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bakiye" value={`${kul.bakiye}`} sub={`/ ${kota} KP`} frac={kul.bakiye / kota} />
        <Stat label="Güvenilirlik" value={`${kul.guv}`} sub="/ 100" frac={kul.guv / 100} />
      </div>
      {kul.sertifikalar.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">{kul.sertifikalar.map((c) => <span key={c} className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c}</span>)}</div>
      )}
      <div className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">Rezervasyonlar</div>
      <div className="mt-1.5 space-y-1">
        {rezler.length === 0 && <p className="text-xs text-muted-foreground">Yok</p>}
        {rezler.map((r) => (
          <button key={r.id} onClick={() => setSecili(r.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-accent">
            <span className={`h-2 w-2 rounded-sm ${DURUM_DOT[r.durum]}`} />
            <span className="font-semibold">{r.id}</span><span className="text-muted-foreground">{r.kaynak}</span>
            <span className="text-muted-foreground">{E.fmtSaat(r.bas)}–{E.fmtSaat(r.bit)}</span>
            <span className="ml-auto">{r.ucret}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Bekleme kayıtları</div>
      <div className="mt-1.5 space-y-1 font-mono text-xs">
        {bekl.length === 0 ? <p className="text-muted-foreground">Yok</p> : bekl.map((b) => (
          <div key={b.id} className="px-2">{b.id} · {b.kaynak} · {E.fmtSaat(b.bas)}–{E.fmtSaat(b.bit)}</div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-semibold">{title}</h2>{right}</div>
      {children}
    </section>
  );
}
function Stat({ label, value, sub, frac }: { label: string; value: string; sub: string; frac: number }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-2xl font-semibold">{value}<span className="text-xs text-muted-foreground"> {sub}</span></div>
      <div className="mt-2 h-1 rounded bg-background"><div className="h-1 rounded bg-primary" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} /></div>
    </div>
  );
}
function Badge({ d }: { d: E.Durum }) {
  return <span className="inline-flex items-center gap-1.5 font-mono text-xs"><span className={`h-2 w-2 rounded-sm ${DURUM_DOT[d]}`} />{d}</span>;
}
function Btn({ children, danger, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return <button {...p} className={`rounded-md py-2 text-sm font-medium disabled:opacity-30 ${danger ? "bg-destructive/20 text-destructive hover:bg-destructive/30" : "bg-secondary hover:bg-accent"}`}>{children}</button>;
}
