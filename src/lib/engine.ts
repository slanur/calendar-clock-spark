// Simplified in-memory reservation engine for UI prototyping.
export type Tur = "ODA" | "LAB" | "YAZICI" | "CIHAZ";
export type Rol = "OGRENCI" | "ARASTIRMACI" | "TEKNISYEN";
export type Durum = "ONAYLI" | "KULLANIMDA" | "TAMAMLANDI" | "GELMEDI" | "IPTAL";

export const TURLER: Record<Tur, { hazirlik: number; ucret: number; enerji: boolean; sertifika?: string }> = {
  ODA: { hazirlik: 0, ucret: 4, enerji: false },
  LAB: { hazirlik: 10, ucret: 8, enerji: false, sertifika: "LAB_GUVENLIK" },
  YAZICI: { hazirlik: 20, ucret: 12, enerji: true },
  CIHAZ: { hazirlik: 15, ucret: 16, enerji: true, sertifika: "CIHAZ_EGITIMI" },
};
export const ROLLER: Record<Rol, { kota: number; ileri: number; azami: number }> = {
  OGRENCI: { kota: 120, ileri: 7, azami: 180 },
  ARASTIRMACI: { kota: 300, ileri: 14, azami: 480 },
  TEKNISYEN: { kota: 600, ileri: 30, azami: 840 },
};

export interface Kaynak { id: string; ad: string; tur: Tur; izinli: Rol[] }
export interface Kullanici { id: string; ad: string; rol: Rol; sertifikalar: string[]; bakiye: number; guv: number }
export interface Rez { id: string; kullanici: string; kaynak: string; bas: number; bit: number; ucret: number; durum: Durum; paket?: string }
export interface Bakim { kaynak: string; bas: number; bit: number }
export interface Bekleme { id: string; kullanici: string; kaynak: string; bas: number; bit: number }
export interface Log { id: number; zaman: number; komut: string; istek: object; sonuc: object; ok: boolean }

export const HATA: Record<string, string> = {
  BULUNAMADI: "Kullanıcı veya kaynak bulunamadı.",
  ZAMAN_ADIMI_HATASI: "Saatler 15 dakikalık adımlara oturmalıdır.",
  GECMIS_ZAMAN: "Başlangıç simüle saatten önce olamaz.",
  ILERI_TARIH: "Rolünüzün ileri tarih sınırı aşıldı.",
  SURE_ASIMI: "Rolünüzün azami rezervasyon süresi aşıldı.",
  YETKISIZ_ROL: "Bu kaynağı rolünüz rezerve edemez.",
  SERTIFIKA_YOK: "Bu kaynak için gerekli sertifikanız yok.",
  BAKIM: "Aralık bir bakım penceresiyle çakışıyor.",
  KESISME: "Aralık başka bir rezervasyonla çakışıyor.",
  HAZIRLIK_IHLALI: "Kaynağın hazırlık süresi henüz dolmuyor.",
  ART_ARDA: "Aynı kaynakta ardışık rezervasyonlar arasında 60 dk olmalı.",
  YETERSIZ_BAKIYE: "Bakiyeniz bu ücret için yetersiz.",
  PAKET_RED: "Paketteki kalemlerden en az biri reddedildi.",
};

const DAY = 1440;
export const BASE_DATE = new Date(Date.UTC(2027, 2, 8)); // Pazartesi
export const fmtSaat = (m: number) => `${String(Math.floor((m % DAY) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const fmtGun = (m: number) => {
  const d = new Date(BASE_DATE.getTime() + Math.floor(m / DAY) * 86400000);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short", timeZone: "UTC" });
};
export const fmtIso = (m: number) => {
  const d = new Date(BASE_DATE.getTime() + Math.floor(m / DAY) * 86400000);
  return `${d.toISOString().slice(0, 10)}T${fmtSaat(m)}`;
};

export interface State {
  saat: number;
  kaynaklar: Kaynak[];
  kullanicilar: Kullanici[];
  rez: Rez[];
  bakim: Bakim[];
  bekleme: Bekleme[];
  log: Log[];
  seq: { r: number; p: number; b: number; l: number };
}

export function initialState(): State {
  const h = (d: number, hh: number, mm = 0) => d * DAY + hh * 60 + mm;
  return {
    saat: h(0, 8),
    kaynaklar: [
      { id: "ODA-1", ad: "Toplantı Odası 1", tur: "ODA", izinli: ["OGRENCI", "ARASTIRMACI", "TEKNISYEN"] },
      { id: "ODA-2", ad: "Toplantı Odası 2", tur: "ODA", izinli: ["OGRENCI", "ARASTIRMACI", "TEKNISYEN"] },
      { id: "LAB-1", ad: "Elektronik Lab", tur: "LAB", izinli: ["ARASTIRMACI", "TEKNISYEN", "OGRENCI"] },
      { id: "YAZ-1", ad: "3B Yazıcı 1", tur: "YAZICI", izinli: ["OGRENCI", "ARASTIRMACI"] },
      { id: "YAZ-2", ad: "3B Yazıcı 2", tur: "YAZICI", izinli: ["ARASTIRMACI", "TEKNISYEN"] },
      { id: "GPU-1", ad: "GPU Sunucusu", tur: "CIHAZ", izinli: ["ARASTIRMACI", "TEKNISYEN"] },
    ],
    kullanicilar: [
      { id: "u1", ad: "Ayşe Yılmaz", rol: "ARASTIRMACI", sertifikalar: ["LAB_GUVENLIK", "CIHAZ_EGITIMI"], bakiye: 300, guv: 90 },
      { id: "u2", ad: "Mehmet Demir", rol: "OGRENCI", sertifikalar: [], bakiye: 120, guv: 80 },
      { id: "u3", ad: "Zeynep Kaya", rol: "TEKNISYEN", sertifikalar: ["LAB_GUVENLIK", "CIHAZ_EGITIMI"], bakiye: 600, guv: 100 },
    ],
    rez: [
      { id: "r1", kullanici: "u1", kaynak: "GPU-1", bas: h(0, 10), bit: h(0, 13), ucret: 72, durum: "ONAYLI" },
      { id: "r2", kullanici: "u2", kaynak: "ODA-1", bas: h(0, 9), bit: h(0, 10, 30), ucret: 6, durum: "ONAYLI" },
      { id: "r3", kullanici: "u3", kaynak: "YAZ-2", bas: h(0, 14), bit: h(0, 16), ucret: 36, durum: "ONAYLI", paket: "p1" },
      { id: "r4", kullanici: "u3", kaynak: "LAB-1", bas: h(0, 14), bit: h(0, 16), ucret: 16, durum: "ONAYLI", paket: "p1" },
    ],
    bakim: [
      { kaynak: "LAB-1", bas: h(0, 8), bit: h(0, 9, 30) },
      { kaynak: "YAZ-1", bas: h(0, 18), bit: h(0, 20) },
    ],
    bekleme: [],
    log: [],
    seq: { r: 4, p: 1, b: 0, l: 0 },
  };
}

const aktif = (r: Rez) => r.durum !== "IPTAL" && r.durum !== "GELMEDI";

export function doluluk(s: State, tur: Tur, bas: number) {
  const bant = Math.floor(bas / 120) * 120;
  const ks = s.kaynaklar.filter((k) => k.tur === tur);
  if (!ks.length) return 0;
  const dolu = ks.filter((k) => s.rez.some((r) => r.kaynak === k.id && aktif(r) && r.bas < bant + 120 && r.bit > bant)).length;
  return dolu / ks.length;
}

export function fiyat(s: State, kaynakId: string, bas: number, bit: number) {
  const k = s.kaynaklar.find((x) => x.id === kaynakId);
  if (!k) return 0;
  const t = TURLER[k.tur];
  let toplam = 0;
  for (let m = bas; m < bit; m += 15) {
    const occ = doluluk(s, k.tur, m);
    const saat = (m % DAY) / 60;
    const pik = t.enerji && saat >= 10 && saat < 16 ? 1.5 : 1;
    toplam += (t.ucret / 4) * (1 + occ) * pik;
  }
  return Math.ceil(toplam);
}

export function dogrula(s: State, u: string, kId: string, bas: number, bit: number): string | null {
  const kul = s.kullanicilar.find((x) => x.id === u);
  const k = s.kaynaklar.find((x) => x.id === kId);
  if (!kul || !k) return "BULUNAMADI";
  if (bas % 15 || bit % 15 || bit <= bas) return "ZAMAN_ADIMI_HATASI";
  if (bas < s.saat) return "GECMIS_ZAMAN";
  const rol = ROLLER[kul.rol];
  if (bas > s.saat + rol.ileri * DAY) return "ILERI_TARIH";
  if (bit - bas > rol.azami) return "SURE_ASIMI";
  if (!k.izinli.includes(kul.rol)) return "YETKISIZ_ROL";
  const t = TURLER[k.tur];
  if (t.sertifika && !kul.sertifikalar.includes(t.sertifika)) return "SERTIFIKA_YOK";
  if (s.bakim.some((b) => b.kaynak === kId && b.bas < bit && b.bit > bas)) return "BAKIM";
  const ayni = s.rez.filter((r) => r.kaynak === kId && aktif(r));
  if (ayni.some((r) => r.bas < bit && r.bit > bas)) return "KESISME";
  if (ayni.some((r) => r.bas < bit + t.hazirlik && r.bit + t.hazirlik > bas)) return "HAZIRLIK_IHLALI";
  if (ayni.some((r) => r.kullanici === u && r.bas < bit + 60 && r.bit + 60 > bas)) return "ART_ARDA";
  return null;
}

function addLog(s: State, komut: string, istek: object, sonuc: object, ok: boolean): State {
  const l = s.seq.l + 1;
  return { ...s, seq: { ...s.seq, l }, log: [{ id: l, zaman: s.saat, komut, istek, sonuc, ok }, ...s.log] };
}

export function rezervasyon(s: State, u: string, k: string, bas: number, bit: number) {
  const istek = { komut: "rezervasyon", kullanici: u, kaynak: k, baslangic: fmtIso(bas), bitis: fmtIso(bit) };
  let hata = dogrula(s, u, k, bas, bit);
  const ucret = fiyat(s, k, bas, bit);
  const kul = s.kullanicilar.find((x) => x.id === u);
  if (!hata && kul && kul.bakiye < ucret) hata = "YETERSIZ_BAKIYE";
  if (hata) {
    const sonuc = { durum: "RED", kod: hata };
    return { state: addLog(s, "rezervasyon", istek, sonuc, false), sonuc };
  }
  const id = `r${s.seq.r + 1}`;
  const bakiye = kul!.bakiye - ucret;
  const ns: State = {
    ...s,
    seq: { ...s.seq, r: s.seq.r + 1 },
    rez: [...s.rez, { id, kullanici: u, kaynak: k, bas, bit, ucret, durum: "ONAYLI" }],
    kullanicilar: s.kullanicilar.map((x) => (x.id === u ? { ...x, bakiye } : x)),
  };
  const sonuc = { durum: "TAMAM", rezervasyon_id: id, ucret, bakiye };
  return { state: addLog(ns, "rezervasyon", istek, sonuc, true), sonuc };
}

export interface Kalem { kaynak: string; bas: number; bit: number }
export function paket(s: State, u: string, kalemler: Kalem[]) {
  const istek = { komut: "paket", kullanici: u, kalemler: kalemler.map((k) => ({ kaynak: k.kaynak, baslangic: fmtIso(k.bas), bitis: fmtIso(k.bit) })) };
  const sonuclar = kalemler.map((k) => dogrula(s, u, k.kaynak, k.bas, k.bit));
  const ucretler = kalemler.map((k) => fiyat(s, k.kaynak, k.bas, k.bit));
  const toplam = ucretler.reduce((a, b) => a + b, 0);
  const kul = s.kullanicilar.find((x) => x.id === u);
  if (sonuclar.some(Boolean) || !kul || kul.bakiye < toplam) {
    const sonuc = { durum: "RED", kod: sonuclar.some(Boolean) ? "PAKET_RED" : "YETERSIZ_BAKIYE", kalemler: sonuclar.map((c) => c ?? "GECERLI") };
    return { state: addLog(s, "paket", istek, sonuc, false), sonuc };
  }
  const pid = `p${s.seq.p + 1}`;
  let r = s.seq.r;
  const yeni: Rez[] = kalemler.map((k, i) => ({ id: `r${++r}`, kullanici: u, kaynak: k.kaynak, bas: k.bas, bit: k.bit, ucret: ucretler[i], durum: "ONAYLI", paket: pid }));
  const bakiye = kul.bakiye - toplam;
  const ns: State = {
    ...s,
    seq: { ...s.seq, r, p: s.seq.p + 1 },
    rez: [...s.rez, ...yeni],
    kullanicilar: s.kullanicilar.map((x) => (x.id === u ? { ...x, bakiye } : x)),
  };
  const sonuc = { durum: "TAMAM", paket_id: pid, rezervasyonlar: yeni.map((y) => y.id), ucretler, toplam, bakiye };
  return { state: addLog(ns, "paket", istek, sonuc, true), sonuc };
}

function tarama(s: State, kaynak: string, olaylar: object[]): State {
  let ns = s;
  for (const b of s.bekleme.filter((x) => x.kaynak === kaynak)) {
    const kul = ns.kullanicilar.find((x) => x.id === b.kullanici)!;
    const ucret = fiyat(ns, b.kaynak, b.bas, b.bit);
    if (dogrula(ns, b.kullanici, b.kaynak, b.bas, b.bit) || kul.bakiye < ucret) continue;
    const id = `r${ns.seq.r + 1}`;
    ns = {
      ...ns,
      seq: { ...ns.seq, r: ns.seq.r + 1 },
      rez: [...ns.rez, { id, kullanici: b.kullanici, kaynak: b.kaynak, bas: b.bas, bit: b.bit, ucret, durum: "ONAYLI" }],
      bekleme: ns.bekleme.filter((x) => x.id !== b.id),
      kullanicilar: ns.kullanicilar.map((x) => (x.id === b.kullanici ? { ...x, bakiye: x.bakiye - ucret } : x)),
    };
    olaylar.push({ zaman: fmtIso(ns.saat), tur: "OTOMATIK_ATAMA", bekleme: b.id, rezervasyon: id, kullanici: b.kullanici, ucret, bakiye: kul.bakiye - ucret });
  }
  return ns;
}

export function iptal(s: State, rid: string) {
  const r = s.rez.find((x) => x.id === rid)!;
  const istek = { komut: "iptal", rezervasyon: rid };
  if (r.durum !== "ONAYLI") {
    const sonuc = { durum: "RED", kod: "GECERSIZ_DURUM" };
    return { state: addLog(s, "iptal", istek, sonuc, false), sonuc };
  }
  const kalan = r.bas - s.saat;
  const oran = kalan >= 1440 ? 1 : kalan >= 120 ? 0.5 : 0;
  const kul = s.kullanicilar.find((x) => x.id === r.kullanici)!;
  const kota = ROLLER[kul.rol].kota;
  const iade = Math.min(Math.floor(r.ucret * oran), kota - kul.bakiye);
  const guv = oran === 0 ? Math.max(0, kul.guv - 5) : kul.guv;
  let ns: State = {
    ...s,
    rez: s.rez.map((x) => (x.id === rid ? { ...x, durum: "IPTAL" } : x)),
    kullanicilar: s.kullanicilar.map((x) => (x.id === kul.id ? { ...x, bakiye: x.bakiye + iade, guv } : x)),
  };
  const olaylar: object[] = [];
  ns = tarama(ns, r.kaynak, olaylar);
  const sonuc = { durum: "TAMAM", iade, bakiye: kul.bakiye + iade, guvenilirlik: guv, olaylar };
  return { state: addLog(ns, "iptal", istek, sonuc, true), sonuc };
}

export function giris(s: State, rid: string) {
  const r = s.rez.find((x) => x.id === rid)!;
  const istek = { komut: "giris", rezervasyon: rid };
  if (r.durum !== "ONAYLI" || s.saat < r.bas - 15 || s.saat > r.bas + 15) {
    const sonuc = { durum: "RED", kod: r.durum !== "ONAYLI" ? "GECERSIZ_DURUM" : "GIRIS_ZAMANI_DISI" };
    return { state: addLog(s, "giris", istek, sonuc, false), sonuc };
  }
  const ns = { ...s, rez: s.rez.map((x) => (x.id === rid ? { ...x, durum: "KULLANIMDA" as Durum } : x)) };
  const sonuc = { durum: "TAMAM" };
  return { state: addLog(ns, "giris", istek, sonuc, true), sonuc };
}

export function cikis(s: State, rid: string) {
  const r = s.rez.find((x) => x.id === rid)!;
  const istek = { komut: "cikis", rezervasyon: rid };
  if (r.durum !== "KULLANIMDA") {
    const sonuc = { durum: "RED", kod: "GECERSIZ_DURUM" };
    return { state: addLog(s, "cikis", istek, sonuc, false), sonuc };
  }
  const kul = s.kullanicilar.find((x) => x.id === r.kullanici)!;
  const guv = Math.min(100, kul.guv + 2);
  let ns: State = {
    ...s,
    rez: s.rez.map((x) => (x.id === rid ? { ...x, durum: "TAMAMLANDI", bit: Math.ceil(s.saat / 15) * 15 } : x)),
    kullanicilar: s.kullanicilar.map((x) => (x.id === kul.id ? { ...x, guv } : x)),
  };
  const olaylar: object[] = [];
  ns = tarama(ns, r.kaynak, olaylar);
  const sonuc = { durum: "TAMAM", guvenilirlik: guv, olaylar };
  return { state: addLog(ns, "cikis", istek, sonuc, true), sonuc };
}

export function bekle(s: State, u: string, k: string, bas: number, bit: number) {
  const id = `b${s.seq.b + 1}`;
  const istek = { komut: "bekleme", kullanici: u, kaynak: k, baslangic: fmtIso(bas), bitis: fmtIso(bit) };
  const ns = { ...s, seq: { ...s.seq, b: s.seq.b + 1 }, bekleme: [...s.bekleme, { id, kullanici: u, kaynak: k, bas, bit }] };
  const sonuc = { durum: "TAMAM", bekleme_id: id };
  return { state: addLog(ns, "bekleme", istek, sonuc, true), sonuc };
}

export function saatIlerle(s: State, hedef: number) {
  const istek = { komut: "saat", hedef: fmtIso(hedef) };
  const olaylar: object[] = [];
  let ns: State = { ...s, saat: hedef };
  const bos = new Set<string>();
  ns.rez = ns.rez.map((r) => {
    if (r.durum === "ONAYLI" && hedef > r.bas + 15) {
      const kul = ns.kullanicilar.find((x) => x.id === r.kullanici)!;
      const guv = Math.max(0, kul.guv - 15);
      ns.kullanicilar = ns.kullanicilar.map((x) => (x.id === kul.id ? { ...x, guv } : x));
      olaylar.push({ zaman: fmtIso(r.bas + 15), tur: "GELMEDI", rezervasyon: r.id, kullanici: r.kullanici, guvenilirlik: guv });
      bos.add(r.kaynak);
      return { ...r, durum: "GELMEDI" };
    }
    if (r.durum === "KULLANIMDA" && hedef >= r.bit) {
      const kul = ns.kullanicilar.find((x) => x.id === r.kullanici)!;
      olaylar.push({ zaman: fmtIso(r.bit), tur: "TAMAMLANDI", rezervasyon: r.id, kullanici: r.kullanici, guvenilirlik: kul.guv });
      return { ...r, durum: "TAMAMLANDI" };
    }
    return r;
  });
  ns.bekleme = ns.bekleme.filter((b) => b.bas >= hedef);
  bos.forEach((k) => (ns = tarama(ns, k, olaylar)));
  const sonuc = { durum: "TAMAM", saat: fmtIso(hedef), olaylar };
  return { state: addLog(ns, "saat", istek, sonuc, true), sonuc };
}
