/* ==========================================================
   Noir Cinema · 06-petty-cash.js
   بيتي كاش: قراءة الفواتير · OCR · الدفتر · تصدير الاكسل
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   PETTY CASH — قراءة فواتير PDF وبناء دفتر العهدة (للمشرف فقط)
   ============================================================ */
const PC_VAT_STD = 0.15;
const PC_CATS = [
  "Cleaning & Housekeeping","Concession - Food & Beverage","Concession - Repairs",
  "Health & Safety","Office Supplies","Repairs & Maintenance","Staff Supplies","Staff Water"
];
/* موردون معروفون: الاسم الإنجليزي + العربي + كلمات التعرف */
const PC_SUPPLIERS = [
  {en:"Abdullah Al Othaim Markets", ar:"العثيم",           kw:[/othaim/i, /العثيم/]},
  {en:"Jarir Bookstore",            ar:"جرير",             kw:[/jarir/i, /جرير/]},
  {en:"Sama Al Nazafah Est.",       ar:"سما النظافة",      kw:[/nazafah|nadhafah/i, /النظافة/]},
  {en:"Al Shafi Foodstuff",         ar:"الشافي الغذائية",  kw:[/shafi/i, /الشافي/]},
  {en:"Rukn Seran",                 ar:"ركن سيران",        kw:[/seran|siran/i, /سيران/]},
  {en:"Al Amer Bookstore",          ar:"العامر",           kw:[/al\s*amer/i, /العامر/]},
  {en:"Bait Al Sehha",              ar:"بيت الصحة",        kw:[/sehha|sihha/i, /الصحة/]},
  {en:"Al Ikhtisas",                ar:"الاختصاص",         kw:[/ikhtisas/i, /الاختصاص/]},
  {en:"Panda",                      ar:"بندة",             kw:[/panda/i, /بندة/]},
  {en:"Lulu Hypermarket",           ar:"لولو",             kw:[/lulu/i, /لولو/]},
  {en:"Saco",                       ar:"ساكو",             kw:[/\bsaco\b/i, /ساكو/]},
  {en:"Extra",                      ar:"إكسترا",           kw:[/\bextra\b/i, /إكسترا/]}
];
/* تصنيف تلقائي من الوصف واسم المورد */
const PC_CAT_RULES = [
  {cat:"Staff Water",                  re:/(bottled\s*water|drinking\s*water|مياه|ماء\s*شرب)/i},
  {cat:"Cleaning & Housekeeping",      re:/(garbage|trash|bag|fairy|clorox|detergent|clean|mop|tissue|نظاف|قمامة|منظف|مناديل|كلوركس)/i},
  {cat:"Health & Safety",              re:/(glove|mask|first\s*aid|medical|bandage|cotton|قفاز|كمام|إسعاف|طبي|قطن)/i},
  {cat:"Office Supplies",              re:/(staple|pen\b|paper|ink|printer|toner|file|folder|قرطاس|ورق|قلم|حبر|دباس)/i},
  {cat:"Concession - Repairs",         re:/(slush|popcorn)\s*(machine)?.*(repair|spare|fix)|(repair|spare).*(slush|popcorn)/i},
  {cat:"Repairs & Maintenance",        re:/(repair|maintenance|plumb|electric|spare|صيانة|تصليح|كهرب|سباك)/i},
  {cat:"Concession - Food & Beverage", re:/(bun|ketchup|mint|syrup|sauce|cheese|popcorn|corn|sugar|juice|food|صلصة|كاتشب|نعناع|خبز|جبن)/i},
  {cat:"Staff Supplies",               re:/(cup|plate|spoon|fork|staff|كوب|صحن|ملعقة|موظف)/i}
];
function pcGuessSupplier(text){
  for (const s of PC_SUPPLIERS) if (s.kw.some(r=>r.test(text))) return s;
  return null;
}
function pcGuessCategory(text){
  for (const r of PC_CAT_RULES) if (r.re.test(text)) return r.cat;
  return "";
}
const pcNum = x => { const v = parseFloat(String(x).replace(/[,\s]/g,"")); return isFinite(v) ? v : null; };
function pcGrab(text, patterns){
  for (const re of patterns){ const m = text.match(re); if (m){ const v = pcNum(m[1]); if (v !== null) return v; } }
  return null;
}
function pcDate(text){
  let m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m){
    let d=+m[1], mo=+m[2];
    if (d > 12 && mo <= 12){}                 /* dd/mm */
    else if (mo > 12){ [d,mo] = [mo,d]; }     /* mm/dd مقلوبة */
    return `${m[3]}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  m = text.match(/(\d{1,2})[\-\s]([A-Za-z]{3})[\-\s](\d{2,4})/);
  if (m){
    const mo = MON3[m[2].toLowerCase()];
    if (mo){ let y=+m[3]; if (y<100) y+=2000;
      return `${y}-${String(mo).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`; }
  }
  return "";
}
/* القارئ: يستخرج ما يقدر عليه ويصرّح بما لم يجده */
function parseInvoiceLines(lines){
  const text = lines.join(" \n ");
  const flat = text.replace(/\s+/g," ");
  const missing = [];

  const sup = pcGuessSupplier(flat);
  const date = pcDate(flat);

  /* نشيل الأرقام الضريبية والسجل التجاري أولاً — أكبر مصدر للأخطاء */
  const clean = flat
    .replace(/(?:vat|tax)\s*(?:reg(?:istration)?\.?)?\s*(?:no|number|#)\s*[:.]?\s*\d[\d\s-]{6,}/gi, " ")
    .replace(/(?:الرقم\s*الضريبي|رقم\s*التسجيل\s*الضريبي|السجل\s*التجاري|رقم\s*ضريبي)\s*[:.]?\s*\d[\d\s-]{6,}/g, " ")
    .replace(/\b\d{15}\b/g, " ");

  let invNo = "";
  const invPats = [
    /\b(\d{3}-\d{4}-\d{3}-\d{1,4})\b/,
    /(?:invoice|inv|receipt|bill)\s*(?:no|number|#)?\s*[:.#]\s*([A-Za-z0-9][A-Za-z0-9\-\/]{1,24})/i,
    /رقم\s*(?:الفاتورة|الايصال|الإيصال)\s*[:.#]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{1,24})/,
    /\bفاتورة\s*(?:ضريبية)?\s*[:#]\s*([0-9]{3,14})\b/
  ];
  for (const re of invPats){
    const m = clean.match(re);
    if (m && /\d/.test(m[1])){ invNo = m[1].trim(); break; }   /* لازم يحتوي رقماً */
  }
  if (!invNo) missing.push("invNo");

  /* مبالغ العهدة صغيرة: أي رقم ضخم شبه أكيد رقم تسجيل مو مبلغ */
  const sane = v => (v !== null && v >= 0 && v < 100000) ? v : null;
  const NOPCT = "(?!\\s*%)";                        /* لا نقبل رقماً يتبعه % كمبلغ */
  const grab = pats => { const v = pcGrab(clean, pats); return sane(v); };

  let total = grab([
    new RegExp(`(?:grand\\s*total|total\\s*(?:amount)?\\s*(?:incl|including|with)[^0-9]{0,18}|الإجمالي\\s*(?:شامل)?[^0-9]{0,18}|المجموع\\s*الكلي[^0-9]{0,18})([\\d,]+\\.?\\d*)${NOPCT}`, "i"),
    new RegExp(`(?:total|الإجمالي|المجموع)[^0-9\\-%]{0,14}([\\d,]+\\.\\d{2})${NOPCT}`, "i")
  ]);
  let vat = grab([
    new RegExp(`(?:vat\\s*amount|tax\\s*amount|ضريبة\\s*القيمة\\s*المضافة|الضريبة|ض\\.?ق\\.?م)[^0-9\\-%]{0,18}([\\d,]+\\.\\d{2})${NOPCT}`, "i"),
    new RegExp(`(?:vat|ضريبة)[^0-9\\-%]{0,12}([\\d,]+\\.\\d{2})${NOPCT}`, "i")
  ]);
  let net = grab([
    new RegExp(`(?:net\\s*(?:amount|total)?|subtotal|total\\s*(?:excl|before|without)[^0-9]{0,18}|الصافي|المجموع\\s*قبل\\s*الضريبة|الإجمالي\\s*قبل)[^0-9\\-%]{0,18}([\\d,]+\\.?\\d*)${NOPCT}`, "i")
  ]);
  let vatPct = null;
  const mp = clean.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  if (mp){ const v = pcNum(mp[1]); if (v !== null && v <= 30) vatPct = v/100; }

  /* الضريبة ما تتجاوز الإجمالي أبداً — لو صار كذا فالقراءة غلط ونتجاهلها */
  if (total !== null && vat !== null && vat > total) vat = null;
  if (total !== null && net !== null && net > total + 0.02) net = null;

  /* الاستنتاج الحسابي: ما نخترع أرقاماً، نكمل الناقص من الموجود */
  const R = v => v===null ? null : Math.round(v*100)/100;
  if (total !== null && net !== null && vat === null) vat = R(total - net);
  if (total !== null && vat !== null && net === null) net = R(total - vat);
  if (net !== null && vat !== null && total === null) total = R(net + vat);
  /* حارس المعقولية: ضريبة 15% لا تتعدى ~30% من الإجمالي، والصافي لا يكون صفراً —
     لو خرج غير ذلك فالرقم المقروء ليس مبلغ ضريبة، فنشتقّه من النسبة */
  const rate0 = (vatPct !== null && vatPct > 0) ? vatPct : PC_VAT_STD;
  if (total !== null && total > 0 && vat !== null && (vat / total > 0.35 || R(total - vat) <= 0)){
    vat = null; net = null;
  }
  if (total !== null && net === null && vat === null){       /* فاتورة شاملة بنسبة قياسية */
    net = R(total / (1 + rate0)); vat = R(total - net);
  }
  if (vatPct === null && net) vatPct = (vat && net) ? Math.round((vat/net)*100)/100 : PC_VAT_STD;

  if (total === null) missing.push("total");
  if (net === null)   missing.push("net");
  if (!date)          missing.push("date");
  if (!sup)           missing.push("supplier");

  /* الوصف: أطول سطر نصي غير رقمي وغير عنوان */
  let desc = "";
  const supWords = sup ? [sup.en, sup.ar, ...sup.kw.map(r=>r.source)] : [];
  const cand = lines.map(l=>String(l).replace(/\s+/g," ").trim())
    .filter(l=>l.length>=6 && l.length<=60 && /[A-Za-z\u0600-\u06FF]/.test(l))
    .filter(l=>!/(invoice|tax|vat|total|فاتورة|ضريبة|الإجمالي|المجموع|رقم|تاريخ|date|address|tel|phone|c\.?r\.?|est\.|مؤسسة|شركة|للأسواق|ذ\.?م\.?م)/i.test(l))
    .filter(l=>!(sup && sup.kw.some(r=>r.test(l))))          /* لا نأخذ اسم المورد كوصف */
    .filter(l=>!supWords.some(w=>w && l === w));
  if (cand.length) desc = cand.sort((a,b)=>b.length-a.length)[0];
  if (!desc) missing.push("desc");

  const category = pcGuessCategory(desc + " " + flat) || "";
  if (!category) missing.push("category");

  return {
    date, supplierEn: sup?.en || "", supplierAr: sup?.ar || "", invNo,
    desc, category,
    net: net===null?0:net, vatPct: vatPct===null?PC_VAT_STD:vatPct,
    vat: vat===null?0:vat, discount: 0, total: total===null?0:total,
    missing, ts: Date.now()
  };
}
/* فحص الضريبة — نفس منطق العمود M في ملفك */
function pcVatCheck(r){
  if (!r.vatPct) return "Exempt";
  return Math.abs(Math.round(r.net * r.vatPct * 100)/100 - r.vat) <= 0.02 ? "OK" : "Review";
}

/* ============================================================
   OCR — قراءة الفواتير المصوّرة (سكان / صورة جوال)
   تُحمَّل المكتبة عند الحاجة فقط حتى لا تثقل فتح التطبيق
   ============================================================ */
const TESS_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
let _tessLoading = null, _tessWorker = null;
function loadTesseract(){
  if (window.Tesseract) return Promise.resolve(true);
  if (_tessLoading) return _tessLoading;
  _tessLoading = new Promise((res, rej)=>{
    const sc = document.createElement("script");
    sc.src = TESS_CDN; sc.async = true;
    sc.onload = ()=>res(true);
    sc.onerror = ()=>rej(new Error(t("ocr_lib_fail")));
    document.head.appendChild(sc);
  });
  return _tessLoading;
}
async function tessWorker(onProgress){
  await loadTesseract();
  if (_tessWorker) return _tessWorker;
  /* عربي + إنجليزي معاً — الفواتير السعودية تخلط الاثنين */
  _tessWorker = await Tesseract.createWorker(["ara","eng"], 1, {
    logger: m => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); }
  });
  return _tessWorker;
}
/* رسم صفحة PDF على canvas بدقة عالية ليقرأها المحرك */
async function pdfPageToCanvas(file, pageNo, scale){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf, isEvalSupported:false, disableFontFace:true}).promise;
  const page = await pdf.getPage(Math.min(pageNo, pdf.numPages));
  const vp = page.getViewport({scale: scale || 2.4});      /* ~220dpi: يوازن الدقة والسرعة */
  const cv = document.createElement("canvas");
  cv.width = Math.min(2400, Math.round(vp.width));
  cv.height = Math.round(vp.height * (cv.width / vp.width));
  const ctx = cv.getContext("2d", {willReadFrequently:true});
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext: ctx, viewport: page.getViewport({scale: (cv.width / vp.width) * (scale||2.4)})}).promise;
  return preprocessCanvas(cv);
}
/* تحسين الصورة قبل القراءة: تدرّج رمادي + رفع التباين — يرفع الدقة كثيراً على صور الجوال */
function preprocessCanvas(cv){
  const ctx = cv.getContext("2d", {willReadFrequently:true});
  const img = ctx.getImageData(0,0,cv.width,cv.height);
  const d = img.data;
  let sum = 0;
  for (let i=0;i<d.length;i+=4){
    const g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    d[i]=d[i+1]=d[i+2]=g; sum += g;
  }
  const mean = sum / (d.length/4);
  const lo = mean - 42, hi = mean + 42;                    /* شد التباين حول المتوسط */
  for (let i=0;i<d.length;i+=4){
    let v = d[i];
    v = v <= lo ? 0 : v >= hi ? 255 : Math.round(((v-lo)/(hi-lo))*255);
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  return cv;
}
async function fileToCanvas(file){
  const url = URL.createObjectURL(file);
  try{
    const im = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const cv = document.createElement("canvas");
    const maxW = 2000;
    const sc = im.width > maxW ? maxW/im.width : 1;
    cv.width = Math.round(im.width*sc); cv.height = Math.round(im.height*sc);
    const ctx = cv.getContext("2d", {willReadFrequently:true});
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.drawImage(im,0,0,cv.width,cv.height);
    return preprocessCanvas(cv);
  } finally { setTimeout(()=>URL.revokeObjectURL(url), 3000); }
}
/* تحويل نتيجة OCR إلى أسطر بنفس شكل مخرجات pdfToLines */
function ocrTextToLines(text){
  return String(text||"").split(/\r?\n/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
}
async function ocrFileToLines(file, onProgress){
  const w = await tessWorker(onProgress);
  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
  const canvas = isPdf ? await pdfPageToCanvas(file, 1, 2.4) : await fileToCanvas(file);
  const {data} = await w.recognize(canvas);
  return ocrTextToLines(data.text);
}
/* هل النص المستخرج من الـPDF ضعيف لدرجة أنه فعلياً صورة؟ */
function looksScanned(lines){
  const txt = lines.join(" ");
  const letters = (txt.match(/[A-Za-z\u0600-\u06FF]/g)||[]).length;
  const digits  = (txt.match(/\d/g)||[]).length;
  return lines.length < 5 || letters < 20 || (letters + digits) < 30;
}

/* ---------- التخزين ---------- */
let pettyRows = [], pettyMeta = null;
async function loadPetty(){
  pettyRows = (await DB.list("petty_cash").catch(()=>[]))
              .filter(r=>!r.isMeta)
              .sort((a,b)=>String(a.date).localeCompare(String(b.date)) || (a.ts||0)-(b.ts||0));
  pettyMeta = await DB.get("petty_cash","_meta").catch(()=>null);
  renderPetty();
}
async function savePettyMeta(){
  const m = {
    isMeta:true,
    branch: $("pcBranch")?.value || "Unaizah – Al Muntazah",
    currency: $("pcCurrency")?.value || "SAR",
    float: parseFloat($("pcFloat")?.value) || 0,
    ts: Date.now()
  };
  await DB.set("petty_cash","_meta", m); pettyMeta = m; renderPetty();
}
$("pcFile")?.addEventListener("change", async e=>{
  const files = [...e.target.files]; if(!files.length) return; e.target.value="";
  showLoadingCloud();
  let ok=0, warn=0;
  try{
    for (const f of files){
      $("pcStatus").textContent = t("pc_reading",{f:f.name});
      const isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
      let lines = [], viaOcr = false;
      if (isPdf){
        try{ lines = await pdfToLines(f); }catch(e){ lines = []; }
      }
      if (!isPdf || looksScanned(lines)){        /* صورة أو PDF مصوّر ⇒ OCR */
        $("pcStatus").textContent = t("ocr_start",{f:f.name});
        try{
          lines = await ocrFileToLines(f, pr=>{
            $("pcStatus").textContent = t("ocr_prog",{f:f.name, p:Math.round(pr*100)});
          });
          viaOcr = true;
        }catch(e){
          console.warn("OCR failed", e);
          $("pcStatus").textContent = "⚠️ " + t("ocr_fail",{f:f.name});
        }
      }
      const parsed = parseInvoiceLines(lines);
      parsed.ocr = viaOcr;
      if (viaOcr) parsed.notes = t("ocr_note");
      parsed.file = f.name;
      await DB.set("petty_cash", "PC"+Date.now()+Math.floor(Math.random()*999), parsed);
      if (parsed.missing.length) warn++; else ok++;
    }
    await loadPetty();
    $("pcStatus").textContent = "✅ " + t("pc_done",{n:files.length, w:warn});
    toast("✅ " + t("pc_done",{n:files.length, w:warn}));
  }catch(err){ console.error(err); $("pcStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
async function pcUpdate(id, field, val){
  const r = pettyRows.find(x=>x.id===id); if (!r) return;
  if (["net","vat","discount","total","vatPct"].includes(field)) val = parseFloat(val)||0;
  r[field] = val;
  if (["net","vat","discount"].includes(field)) r.total = Math.round((r.net + r.vat - r.discount)*100)/100;
  if (field === "total"){                       /* عدّل الإجمالي ⇒ نعيد اشتقاق الصافي والضريبة */
    const rate = r.vatPct || PC_VAT_STD;
    r.net = Math.round((r.total/(1+rate))*100)/100;
    r.vat = Math.round((r.total - r.net)*100)/100;
  }
  r.missing = (r.missing||[]).filter(m=>{
    if (m==="total") return !r.total; if (m==="net") return !r.net;
    if (m==="date") return !r.date; if (m==="supplier") return !r.supplierEn;
    if (m==="desc") return !r.desc; if (m==="category") return !r.category;
    if (m==="invNo") return !r.invNo; return true;
  });
  await DB.set("petty_cash", r.id, {...r});
  renderPetty();
}
async function pcDelete(id){
  if (!confirm(t("pc_del_c"))) return;
  await DB.del("petty_cash", id); await loadPetty();
}
function pcAddBlank(){
  const r = {date:todayKey(), supplierEn:"", supplierAr:"", invNo:"", desc:"", category:"",
             net:0, vatPct:PC_VAT_STD, vat:0, discount:0, total:0, missing:["manual"], ts:Date.now()};
  DB.set("petty_cash","PC"+Date.now(), r).then(loadPetty);
}
function pcMonthKey(d){ return String(d||"").slice(0,7); }
function pcTotals(rows){
  return rows.reduce((a,r)=>({net:a.net+(r.net||0), vat:a.vat+(r.vat||0),
    disc:a.disc+(r.discount||0), total:a.total+(r.total||0)}), {net:0,vat:0,disc:0,total:0});
}
function renderPetty(){
  const body = $("pcBody"); if (!body) return;
  if ($("pcBranch") && pettyMeta){
    if (!$("pcBranch").value) $("pcBranch").value = pettyMeta.branch || "";
    if (!$("pcFloat").value)  $("pcFloat").value  = pettyMeta.float || "";
  }
  const rows = pettyRows;
  const T = pcTotals(rows);
  const flt = pettyMeta?.float || 0;
  const needFix = rows.filter(r=>(r.missing||[]).length).length;
  const ocrCount = rows.filter(r=>r.ocr).length;
  const review = rows.filter(r=>pcVatCheck(r)==="Review").length;
  if ($("pcStats")) $("pcStats").innerHTML = `
    <div class="stat"><div class="v">${fmt(rows.length)}</div><div class="l">${t("pc_invoices")}</div></div>
    <div class="stat"><div class="v">${fmt(+T.net.toFixed(2))}</div><div class="l">${t("pc_net")}</div></div>
    <div class="stat"><div class="v" style="color:var(--lav2)">${fmt(+T.vat.toFixed(2))}</div><div class="l">${t("pc_vat")}</div></div>
    <div class="stat"><div class="v" style="color:var(--gold)">${fmt(+T.total.toFixed(2))}</div><div class="l">${t("pc_total")}</div></div>
    <div class="stat"><div class="v" style="color:${flt-T.total<0?"var(--red)":"var(--green)"}">${fmt(+(flt-T.total).toFixed(2))}</div><div class="l">${t("pc_balance")}</div></div>
    <div class="stat"><div class="v" style="color:${needFix?"var(--red)":"var(--green)"}">${fmt(needFix)}</div><div class="l">${t("pc_needfix")}</div></div>
    <div class="stat"><div class="v" style="color:${review?"var(--amber)":"var(--green)"}">${fmt(review)}</div><div class="l">${t("pc_review")}</div></div>
    <div class="stat"><div class="v" style="color:${ocrCount?"var(--lav2)":"var(--muted)"}">${fmt(ocrCount)}</div><div class="l">${t("pc_ocr_count")}</div></div>`;
  const ow = $("pcOcrWarn");
  if (ow) ow.innerHTML = ocrCount
    ? `<div class="banner"><b>${t("pc_ocr_warn",{n:ocrCount})}</b></div>` : "";

  const catOpts = c => ["", ...PC_CATS].map(x=>`<option value="${esc(x)}" ${x===c?"selected":""}>${x?esc(x):"—"}</option>`).join("");
  body.innerHTML = rows.length ? rows.map((r,i)=>{
    const chk = pcVatCheck(r);
    const bad = (r.missing||[]).length;
    const mi = f => (r.missing||[]).includes(f) ? "pcMiss" : "";
    return `<tr class="${bad?"pcRowBad":""}">
      <td class="num">${i+1}</td>
      <td><input class="cellInput ${mi("date")}" type="date" value="${esc(r.date||"")}" onchange="pcUpdate('${r.id}','date',this.value)"></td>
      <td><input class="cellInput ${mi("supplier")}" value="${esc(r.supplierEn||"")}" onchange="pcUpdate('${r.id}','supplierEn',this.value)"></td>
      <td><input class="cellInput" value="${esc(r.supplierAr||"")}" onchange="pcUpdate('${r.id}','supplierAr',this.value)"></td>
      <td><input class="cellInput ${mi("invNo")}" value="${esc(r.invNo||"")}" onchange="pcUpdate('${r.id}','invNo',this.value)"></td>
      <td><input class="cellInput ${mi("desc")}" value="${esc(r.desc||"")}" onchange="pcUpdate('${r.id}','desc',this.value)"></td>
      <td><select class="cellInput ${mi("category")}" onchange="pcUpdate('${r.id}','category',this.value)">${catOpts(r.category)}</select></td>
      <td><input class="cellInput num ${mi("net")}" type="number" step="0.01" value="${r.net}" onchange="pcUpdate('${r.id}','net',this.value)"></td>
      <td><input class="cellInput num" type="number" step="0.01" value="${r.vatPct}" onchange="pcUpdate('${r.id}','vatPct',this.value)"></td>
      <td><input class="cellInput num" type="number" step="0.01" value="${r.vat}" onchange="pcUpdate('${r.id}','vat',this.value)"></td>
      <td><input class="cellInput num" type="number" step="0.01" value="${r.discount}" onchange="pcUpdate('${r.id}','discount',this.value)"></td>
      <td class="num"><b>${fmt(+(r.total||0).toFixed(2))}</b></td>
      <td><span class="pill ${chk==="OK"?"g":chk==="Review"?"r":"a"}">${chk}</span></td>
      <td style="font-size:11px;color:var(--muted)">${esc(r.file||"")}${r.ocr?` <span class="pill a" style="font-size:9.5px">OCR</span>`:""}</td>
      <td><button class="btn danger small" onclick="pcDelete('${r.id}')">✕</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="15">${emptyState("pc_none","clip")}</td></tr>`;

  /* ملخص التصنيفات */
  const cs = $("pcCatSummary");
  if (cs){
    const map = {};
    rows.forEach(r=>{
      const k = r.category || "—";
      const m = map[k] = map[k] || {n:0, net:0, vat:0, total:0};
      m.n++; m.net += r.net||0; m.vat += r.vat||0; m.total += r.total||0;
    });
    const list = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    cs.innerHTML = list.length ? `<div class="tableWrap"><table>
      <thead><tr><th>${t("pc_th_cat")}</th><th>${t("pc_invoices")}</th><th>${t("pc_net")}</th><th>${t("pc_vat")}</th><th>${t("pc_total")}</th></tr></thead>
      <tbody>${list.map(([k,v])=>`<tr><td>${esc(k)}</td><td class="num">${v.n}</td>
        <td class="num">${fmt(+v.net.toFixed(2))}</td><td class="num">${fmt(+v.vat.toFixed(2))}</td>
        <td class="num"><b>${fmt(+v.total.toFixed(2))}</b></td></tr>`).join("")}
        <tr style="border-top:2px solid var(--line2)"><td><b>${t("pc_grand")}</b></td><td class="num"><b>${rows.length}</b></td>
        <td class="num"><b>${fmt(+T.net.toFixed(2))}</b></td><td class="num"><b>${fmt(+T.vat.toFixed(2))}</b></td>
        <td class="num"><b>${fmt(+T.total.toFixed(2))}</b></td></tr>
      </tbody></table></div>` : "";
  }
}
/* ---------- تصدير الإكسل بنفس تنسيق ملفك بالضبط ---------- */
const PC_NAVY = "FF1F3864", PC_GREY = "FFEFEFEF", PC_BLUE = "FF0000FF";
const PC_MONEY = '#,##0.00;\\(#,##0.00\\);\\-';
function pcMonthLabel(ym){
  const [y,m] = ym.split("-").map(Number);
  return `${MON_EN[m-1]} ${y}`;
}
async function downloadPettyXLSX(){
  if (typeof ExcelJS === "undefined") return toast("❌ " + t("xlsx_lib_missing"));
  if (!pettyRows.length) return toast(t("pc_empty_toast"));
  try{
    toast("⏳ " + t("xlsx_building"));
    const wb = new ExcelJS.Workbook();
    wb.creator = "Noir Cinema";
    const ws = wb.addWorksheet("Petty Cash Ledger", {views:[{state:"frozen", ySplit:8}]});
    [5,13,30,22,10,34,28,13,7,11,10,13,11,10,46].forEach((w,i)=>ws.getColumn(i+1).width = w);

    const rows = [...pettyRows].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const dates = rows.map(r=>r.date).filter(Boolean).sort();
    const branch = pettyMeta?.branch || $("pcBranch")?.value || "Unaizah – Al Muntazah";
    const cur    = pettyMeta?.currency || "SAR";
    const flt    = pettyMeta?.float || 0;
    const period = dates.length ? `${dates[0]} – ${dates[dates.length-1]}` : "—";

    const title = ws.getCell("A1");
    title.value = "CINEMA OPERATIONS  —  PETTY CASH LEDGER";
    title.font = {bold:true, size:18, color:{argb:PC_NAVY}};
    [["A2","Branch:",branch],["A3","Period:",period],["A4","Currency:",cur],
     ["A5","Prepared:",new Date()],["A6","Petty cash a/c:",flt]].forEach(([c,k,v])=>{
      ws.getCell(c).value = k; ws.getCell(c).font = {bold:true, size:10};
      const b = ws.getCell(c.replace("A","B")); b.value = v; b.font = {size:10};
      if (v instanceof Date) b.numFmt = "dd mmm yyyy";
    });

    const HDR = ["#","Date","Supplier (English)","Supplier (Arabic)","Invoice / Receipt No.",
                 "Item Description","Category","Net Amount\n(excl. VAT)","VAT %","VAT Amount",
                 "Discount","Total\n(incl. VAT)","VAT Check","Invoice","Notes"];
    const hr = ws.getRow(8);
    HDR.forEach((h,i)=>{
      const c = hr.getCell(i+1);
      c.value = h;
      c.font = {bold:true, size:10, color:{argb:"FFFFFFFF"}};
      c.fill = {type:"pattern", pattern:"solid", fgColor:{argb:PC_NAVY}};
      c.alignment = {vertical:"middle", horizontal:"center", wrapText:true};
    });
    hr.height = 30;

    const first = 9;
    rows.forEach((r,i)=>{
      const n = first + i, row = ws.getRow(n);
      row.getCell(1).value  = i+1;
      row.getCell(2).value  = r.date ? new Date(r.date+"T00:00:00") : null;
      row.getCell(2).numFmt = "dd mmm yyyy";
      row.getCell(3).value  = r.supplierEn || "";
      row.getCell(4).value  = r.supplierAr || "";
      row.getCell(5).value  = r.invNo || "";
      row.getCell(6).value  = r.desc || "";
      row.getCell(7).value  = r.category || "";
      row.getCell(8).value  = +(r.net||0);
      row.getCell(9).value  = +(r.vatPct||0);
      row.getCell(10).value = +(r.vat||0);
      row.getCell(11).value = +(r.discount||0);
      row.getCell(12).value = {formula:`H${n}+J${n}-K${n}`};
      row.getCell(13).value = {formula:`IF(I${n}=0,"Exempt",IF(ABS(ROUND(H${n}*I${n},2)-J${n})<=0.02,"OK","Review"))`};
      row.getCell(14).value = r.file || "";
      row.getCell(15).value = r.notes || "";
      row.getCell(8).font  = {size:10, color:{argb:PC_BLUE}};
      row.getCell(10).font = {size:10, color:{argb:PC_BLUE}};
      row.getCell(12).font = {bold:true, size:10};
      [8,10,11,12].forEach(c=>row.getCell(c).numFmt = PC_MONEY);
      row.getCell(9).numFmt = "0%";
      row.height = 16;
    });

    /* مجاميع فرعية لكل شهر ثم الإجمالي العام */
    const months = [...new Set(rows.map(r=>pcMonthKey(r.date)).filter(Boolean))].sort();
    let cursor = first + rows.length + 1;
    const subRows = [];
    months.forEach(ym=>{
      const idx = rows.map((r,i)=>({r,i})).filter(x=>pcMonthKey(x.r.date)===ym).map(x=>first+x.i);
      if (!idx.length) return;
      const a = Math.min(...idx), b = Math.max(...idx);
      const row = ws.getRow(cursor);
      row.getCell(7).value = `SUBTOTAL — ${pcMonthLabel(ym)}  (lines ${a-first+1}–${b-first+1})`;
      [8,10,11,12].forEach(c=>{
        const L = String.fromCharCode(64+c);
        row.getCell(c).value = {formula:`SUM(${L}${a}:${L}${b})`};
        row.getCell(c).numFmt = PC_MONEY;
      });
      [7,8,10,11,12].forEach(c=>{
        row.getCell(c).font = {bold:true, size:10, color:{argb:PC_NAVY}};
        row.getCell(c).fill = {type:"pattern", pattern:"solid", fgColor:{argb:PC_GREY}};
      });
      subRows.push(cursor); cursor++;
    });
    const gt = ws.getRow(cursor);
    gt.getCell(7).value = `GRAND TOTAL — ${period}`;
    [8,10,11,12].forEach(c=>{
      const L = String.fromCharCode(64+c);
      gt.getCell(c).value = {formula: subRows.map(r=>`${L}${r}`).join("+") || "0"};
      gt.getCell(c).numFmt = PC_MONEY;
    });
    [7,8,10,11,12].forEach(c=>{
      gt.getCell(c).font = {bold:true, size:11, color:{argb:"FFFFFFFF"}};
      gt.getCell(c).fill = {type:"pattern", pattern:"solid", fgColor:{argb:PC_NAVY}};
    });
    const grandRow = cursor;
    const lastSub = subRows[subRows.length-1];
    cursor += 2;

    /* طلب استرداد العهدة للشهر الأخير */
    const rq = ws.getCell(`A${cursor}`);
    rq.value = `PETTY CASH REIMBURSEMENT REQUEST  —  ${months.length?pcMonthLabel(months[months.length-1]):""}`;
    rq.font = {bold:true, size:12, color:{argb:PC_NAVY}};
    cursor++;
    [[`Amount to be reimbursed  (last month, incl. VAT)`, `L${lastSub}`],
     [`     of which recoverable input VAT`, `J${lastSub}`],
     [`     net of VAT`, `H${lastSub}`]].forEach(([lbl,f])=>{
      ws.getCell(`A${cursor}`).value = lbl;
      const d = ws.getCell(`D${cursor}`); d.value = {formula:f}; d.numFmt = PC_MONEY; d.font = {bold:true, size:10};
      cursor++;
    });
    cursor++;
    [["Opening petty cash float (SAR)","B6"],
     ["Total spent to date",`L${grandRow}`],
     ["Cash balance remaining",`B6-L${grandRow}`]].forEach(([lbl,f])=>{
      ws.getCell(`A${cursor}`).value = lbl;
      const d = ws.getCell(`D${cursor}`); d.value = {formula:f}; d.numFmt = PC_MONEY; d.font = {bold:true, size:10};
      cursor++;
    });
    cursor += 2;

    /* ملاحظات المطابقة — بما فيها البنود التي تحتاج مراجعة */
    ws.getCell(`A${cursor}`).value = "Reconciliation notes";
    ws.getCell(`A${cursor}`).font = {bold:true, size:11, color:{argb:PC_NAVY}}; cursor++;
    const notes = [
      "•  Net Amount, VAT % and VAT Amount are read from each invoice PDF and verified by the supervisor before export.",
      "•  VAT Check flags any line where the printed VAT differs from Net × VAT % by more than 0.02 SAR.",
      `•  Total (incl. VAT) is a live formula: Net + VAT − Discount. Subtotals and the grand total recalculate in Excel.`,
      `•  Opening float in cell B6 (${fmt(flt)}) is used for the cash balance calculation.`
    ];
    rows.forEach((r,i)=>{
      if (pcVatCheck(r) === "Review")
        notes.push(`•  Line ${i+1} (${r.supplierEn||"—"} ${r.invNo||""}): printed VAT ${r.vat} differs from ${(r.net*r.vatPct).toFixed(2)} — verify against the invoice.`);
      if ((r.missing||[]).length)
        notes.push(`•  Line ${i+1}: fields completed manually by the supervisor (${r.missing.join(", ")}).`);
    });
    notes.forEach(n=>{ ws.getCell(`A${cursor}`).value = n; ws.getCell(`A${cursor}`).font = {size:9.5}; cursor++; });
    cursor += 2;
    ws.getCell(`A${cursor}`).value = "Prepared by";
    ws.getCell(`F${cursor}`).value = "Reviewed by (Branch Manager)";
    ws.getCell(`L${cursor}`).value = "Approved by (Finance)";
    [`A${cursor}`,`F${cursor}`,`L${cursor}`].forEach(c=>ws.getCell(c).font = {bold:true, size:10});

    /* ---- شيت ملخص التصنيفات ---- */
    const cs = wb.addWorksheet("Category Summary");
    [30,10,16,14,18].forEach((w,i)=>cs.getColumn(i+1).width = w);
    cs.getCell("A1").value = `SPEND BY CATEGORY  —  ${period}`;
    cs.getCell("A1").font = {bold:true, size:14, color:{argb:PC_NAVY}};
    ["Category","Invoices","Net (excl. VAT)","VAT","Total (incl. VAT)"].forEach((h,i)=>{
      const c = cs.getRow(3).getCell(i+1);
      c.value = h; c.font = {bold:true, size:10, color:{argb:"FFFFFFFF"}};
      c.fill = {type:"pattern", pattern:"solid", fgColor:{argb:PC_NAVY}};
    });
    const used = [...new Set(rows.map(r=>r.category).filter(Boolean))].sort();
    const cats = used.length ? used : PC_CATS;
    const lastLine = first + rows.length - 1;
    cats.forEach((cat,i)=>{
      const n = 4+i, row = cs.getRow(n);
      row.getCell(1).value = cat;
      row.getCell(2).value = {formula:`COUNTIF('Petty Cash Ledger'!$G$${first}:$G$${lastLine},$A${n})`};
      [[3,"H"],[4,"J"],[5,"L"]].forEach(([c,L])=>{
        row.getCell(c).value = {formula:`SUMIF('Petty Cash Ledger'!$G$${first}:$G$${lastLine},$A${n},'Petty Cash Ledger'!${L}$${first}:${L}$${lastLine})`};
        row.getCell(c).numFmt = PC_MONEY;
      });
    });
    const tr = cs.getRow(4+cats.length);
    tr.getCell(1).value = "TOTAL";
    [2,3,4,5].forEach(c=>{
      const L = String.fromCharCode(64+c);
      tr.getCell(c).value = {formula:`SUM(${L}4:${L}${3+cats.length})`};
      if (c>2) tr.getCell(c).numFmt = PC_MONEY;
    });
    [1,2,3,4,5].forEach(c=>{
      tr.getCell(c).font = {bold:true, size:10, color:{argb:"FFFFFFFF"}};
      tr.getCell(c).fill = {type:"pattern", pattern:"solid", fgColor:{argb:PC_NAVY}};
    });
    const xr = 6+cats.length;
    cs.getCell(`A${xr}`).value = "Cross-check against ledger total";
    cs.getCell(`A${xr}`).font = {bold:true, size:10};
    cs.getCell(`A${xr+1}`).value = "Ledger grand total (incl. VAT)";
    cs.getCell(`C${xr+1}`).value = {formula:`'Petty Cash Ledger'!L${grandRow}`};
    cs.getCell(`C${xr+1}`).numFmt = PC_MONEY;
    cs.getCell(`A${xr+2}`).value = "Difference";
    cs.getCell(`C${xr+2}`).value = {formula:`E${4+cats.length}-C${xr+1}`};
    cs.getCell(`C${xr+2}`).numFmt = PC_MONEY;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Petty Cash ${branch.split("–")[0].trim()} ${period.replace(/[^\w\- ]/g,"")}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 8000);
    toast("✅ " + t("xlsx_done"));
  }catch(e){ console.error(e); toast("❌ " + t("err") + e.message); }
}
