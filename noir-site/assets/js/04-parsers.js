/* ==========================================================
   Noir Cinema · 04-parsers.js
   قراء PDF: الجرد · الاستهلاك · الاداء · التذاكر · الاكل
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ==========================================================
   قارئ PDF — النسخة المختبرة، بدون أي تعديل
   ========================================================== */
if (typeof pdfjsLib !== "undefined")
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
/* ============================================================
   قارئ ملفات PDF — نسخة محسّنة
   • تجميع الأسطر عبر شرائح Y (أسرع بكثير من المقارنة واحد‑واحد)
   • احترام حدود الأعمدة: فجوة أفقية كبيرة = مسافة فاصلة، مو التصاق
   • تحرير ذاكرة كل صفحة بعد قراءتها (ملفات 100+ صفحة ما تعلّق الجهاز)
   • كشف الملفات الممسوحة ضوئياً (بدون طبقة نص) ورسالة واضحة بدل صمت
   ============================================================ */
function pdfNormalizeDigits(str){
  /* بعض التقارير تطبع أرقاماً عربية/فارسية — نحوّلها لأرقام لاتينية */
  return String(str)
    .replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06F0-\u06F9]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
    .replace(/\u066B/g, ".").replace(/\u066C/g, ",");
}
async function pdfToLines(file, onProgress){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: buf,
    isEvalSupported: false,
    disableFontFace: true
  }).promise;

  const lines = [];
  let glyphCount = 0;

  for (let p = 1; p <= pdf.numPages; p++){
    const page = await pdf.getPage(p);
    let tc;
    try{ tc = await page.getTextContent(); }
    catch(e){ page.cleanup && page.cleanup(); continue; }

    /* تجميع بالشرائح: مفتاح = Y مقسوم على ارتفاع السطر التقريبي */
    const buckets = new Map();
    for (const it of tc.items){
      const raw = it.str;
      if (!raw || !raw.trim()) continue;
      glyphCount += raw.trim().length;
      const x = it.transform[4];
      const y = it.transform[5];
      const w = it.width || 0;
      const key = Math.round(y / 3);            /* شريحة 3 نقاط */
      let arr = buckets.get(key);
      if (!arr){ arr = []; buckets.set(key, arr); }
      arr.push({ x, w, s: raw });
    }

    const keys = [...buckets.keys()].sort((a,b)=> b - a);   /* من أعلى لأسفل */
    for (const k of keys){
      const parts = buckets.get(k).sort((a,b)=> a.x - b.x);
      let line = "";
      let prevEnd = null;
      for (const it of parts){
        if (prevEnd !== null){
          const gap = it.x - prevEnd;
          /* فجوة واضحة بين عمودين → مسافة، وإلا نلصق الحروف كما هي */
          if (gap > 1.2) line += " ";
        }
        line += it.s;
        prevEnd = it.x + it.w;
      }
      line = pdfNormalizeDigits(line).replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    }

    page.cleanup && page.cleanup();
    if (typeof onProgress === "function") onProgress(p, pdf.numPages);
  }

  try{ pdf.cleanup && pdf.cleanup(); pdf.destroy && pdf.destroy(); }catch(e){}

  /* ملف ممسوح ضوئياً: صفحات فيها صور بس بدون نص */
  if (glyphCount < 40){
    const err = new Error(t("pdf_no_text"));
    err.code = "NO_TEXT_LAYER";
    throw err;
  }
  return lines;
}
/* رقم = سالب اختياري + أرقام بفواصل آلاف + كسر عشري اختياري
   (بعض التقارير تطبع 1,240 بدون كسور و الطريقة القديمة كانت تتجاهلها) */
const NUM = "-?\\(?[\\d,]+(?:\\.\\d+)?\\)?";
const NUM_RE = new RegExp(`^${NUM}$`);
const ITEM_RE = new RegExp(`^(.*?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})$`);
function toNum(s){
  let v = String(s).trim();
  const neg = /^\(.*\)$/.test(v);        /* (123) = سالب في التقارير المحاسبية */
  v = v.replace(/[(),]/g, "");
  const n = parseFloat(v);
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
}
/* يفصل أي عدد من الأعمدة الرقمية بآخر السطر (2 أو 4 أو غيرها) عن اسم المنتج،
   بدل افتراض عدد أعمدة ثابت — هذا يمنع التصاق أرقام إضافية (فرع/مبلغ) باسم المنتج */
function splitTrailingNumbers(line){
  const parts = line.trim().split(/\s+/);
  let i = parts.length;
  while (i > 0 && NUM_RE.test(parts[i-1])) i--;
  const nums = parts.slice(i).map(toNum);
  const name = parts.slice(0, i).join(" ");
  return {name, nums};
}
function cleanName(n){
  n = n.trim();
  const half = Math.floor(n.length/2);
  const a = n.slice(0,half).trim(), b = n.slice(half).trim();
  if (a && a === b) n = a;
  else {
    const parts = n.split(" ");
    for(let i=1;i<parts.length;i++){
      const l = parts.slice(0,i).join(" "), r = parts.slice(i).join(" ");
      if (l === r){ n = l; break; }
    }
  }
  return n.replace(/^[A-Z]\d{6,}\s+/,"").trim();
}
function parseStockLines(lines){
  const standalone = new Set(lines.filter(l=>!ITEM_RE.test(l)).map(l=>l.trim()));
  const locs = [];
  for (const l of lines){
    const m = l.match(ITEM_RE);
    if (m && /[A-Za-z\u0600-\u06FF]/.test(m[1]) && standalone.has(m[1].trim()) && cleanName(m[1]) === m[1].trim()){
      if (!locs.includes(m[1].trim())) locs.push(m[1].trim());
    }
  }
  const items = []; let cur = null;
  for (const l of lines){
    const x = l.trim();
    if (locs.includes(x)){ cur = x; continue; }
    if (/^Grand Total/i.test(x)) { cur = null; continue; }
    const m = x.match(ITEM_RE);
    if (!m || !cur) continue;
    const rawName = m[1].trim();
    if (!/[A-Za-z\u0600-\u06FF&]/.test(rawName)) continue;
    if (locs.includes(rawName)) continue;
    const name = cleanName(rawName);
    if (!name || /^Page /i.test(name) || /Report$/i.test(name)) continue;
    items.push({loc: cur, name, qty: toNum(m[2]), gross: toNum(m[5])});
  }
  const map = {};
  for (const it of items){
    const k = it.loc + "|" + it.name;
    if (map[k]) { map[k].qty += it.qty; map[k].gross += it.gross; }
    else map[k] = {...it};
  }
  return {locations: locs, items: Object.values(map)};
}
function parseSalesLines(lines){
  /* الخطوة 1: نفس أسلوب اكتشاف أسماء الفروع/المستودعات المستخدم في ملف الجرد —
     أي اسم يظهر لوحده بسطر بدون أرقام (رأس قسم) ويظهر أيضاً كسطر برقمين
     (سطر إجمالي الفرع) يُستبعد لاحقاً حتى ما يُحسب كمنتج */
  const standalone = new Set();
  const nameCandidates = [];
  for (const l of lines){
    const x = l.trim(); if (!x) continue;
    const {name, nums} = splitTrailingNumbers(x);
    if (!nums.length) standalone.add(x);
    else if (name) nameCandidates.push(name.trim());
  }
  const KNOWN_LOCS = new Set(["refuel","mini store","store","stores"]);
  const locNames = new Set();
  for (const n of nameCandidates){
    if (KNOWN_LOCS.has(n.toLowerCase()) || (standalone.has(n) && cleanName(n) === n)) locNames.add(n);
  }
  /* الخطوة 2: قراءة كل الأسطر، فصل كل الأعمدة الرقمية بآخر السطر مهما كان عددها
     (بعض التقارير فيها عمودين فقط: بيع/غير مربوط، وبعضها فيها أعمدة أكثر) —
     الكمية المباعة دائماً أول رقم بعد اسم المنتج */
  let from = "", to = "";
  const rows = [];
  for (const l of lines){
    const x = l.trim(); if (!x) continue;
    const mf = x.match(/From:\s*([\d/]+)/i); if (mf) from = mf[1];
    const mt = x.match(/To:\s*([\d/]+)/i); if (mt) to = mt[1];
    if (/^Grand Total/i.test(x)) continue;
    const {name: rawName, nums} = splitTrailingNumbers(x);
    if (!nums.length || !rawName) continue;
    if (!/[A-Za-z\u0600-\u06FF&]/.test(rawName)) continue;
    if (/User Name|Sale Unpunched|Page \d|Report|As On/i.test(rawName)) continue;
    if (locNames.has(rawName.trim()) || KNOWN_LOCS.has(rawName.trim().toLowerCase())) continue;
    const name = cleanName(rawName);
    if (!name || locNames.has(name) || KNOWN_LOCS.has(name.toLowerCase())) continue;
    rows.push({name, qty: nums[0]});
  }
  /* الخطوة 3: دمج نفس المنتج إذا تكرر (مثلاً يُباع من أكثر من فرع/قسم) بجمع الكميات
     بدل ما يطلع كصف مكرر ومربك */
  const map = {};
  for (const r of rows){
    if (map[r.name] !== undefined) map[r.name] += r.qty;
    else map[r.name] = r.qty;
  }
  return {from, to, rows: Object.entries(map).map(([name, qty]) => ({name, qty}))};
}
/* ============================================================
   قارئ تقرير Performance Analysis — أداء الفرع الشهري
   (ملخص، أداء الأفلام، أقوى المنتجات بالمقصف)
   ============================================================ */
const NUM_LOOSE_RE = /^-?[\d,]+(\.\d+)?$/;
function isAllNumericTokens(line){
  const parts = line.trim().split(/\s+/);
  return parts.length>0 && parts.every(p=>NUM_LOOSE_RE.test(p));
}
function isPerfFurnitureLine(line){
  return /^Onaizah|^Bldg No|^Unaizah\s*,|Zip Code|^Performance Analysis|^Without Refund Shows|^From:|^To:|^As On:|^Page:|^User:|^Summary Box Office|^Audience Revenue ATP|^Film No Of Shows|^HouseFull\s*$|^Capacity\s*%?\s*$|^Capacity\s*%\s*BOR|^Concession Sales Analysis|^Period\s*:|^Item Units|^Sales Mix\s*$|^%\s*$|^Qty Sold Net Price|^%\s*Net Profit|^Performance Indicators/i.test(line.trim());
}
function grabPerfNum(text, label){
  const re = new RegExp(label + "\\s*:?\\s*(-?[\\d,]+\\.?\\d*)");
  const m = text.match(re);
  return m ? toNum(m[1]) : null;
}
function parsePerformanceSummary(lines){
  const text = lines.join(" ");
  const s = {};
  s.totalAdmits = grabPerfNum(text, "Total Admits");
  s.totalTransactions = grabPerfNum(text, "Total Transactions");
  s.totalShows = grabPerfNum(text, "Total No of Shows");
  s.avgShows = grabPerfNum(text, "Avg\\. of Shows");
  s.totalCapacity = grabPerfNum(text, "Total Capacity Available");
  s.occupancyPct = grabPerfNum(text, "Occupancy\\s*%");
  s.bor = grabPerfNum(text, "Box Office Revenue\\(BOR\\)");
  s.netBor = grabPerfNum(text, "Net BOR");
  s.grossRevenue = grabPerfNum(text, "Gross Revenue");
  s.concessionNetRevenue = grabPerfNum(text, "Concession Net Revenue");
  s.totalRevenue = grabPerfNum(text, "Total Revenue\\s*:");
  s.netAtp = grabPerfNum(text, "Net ATP");
  const atpMatch = text.match(/(?<!Net )ATP\s*:\s*(-?[\d,]+\.?\d*)/);
  s.atp = atpMatch ? toNum(atpMatch[1]) : null;
  s.costOfGoods = grabPerfNum(text, "Cost of Goods Sold");
  s.foodCost = grabPerfNum(text, "Food Cost");
  s.profitStdCost = grabPerfNum(text, "Profit at Standard Cost");
  s.profitPct = grabPerfNum(text, "Profit\\s*%");
  s.qtyItemsSold = grabPerfNum(text, "Quantity of Item Sold");
  s.avgValuePerTx = grabPerfNum(text, "Average\\.? Value Per Transaction");
  s.spendPerHead = grabPerfNum(text, "Spend Per Head");
  s.admissionStrikeRate = grabPerfNum(text, "Admission Strike Rate");
  s.itemsPerAdmit = grabPerfNum(text, "Items Per Admit");
  s.itemsPerTx = grabPerfNum(text, "Items Per Transaction");
  s.txStrikeRate = grabPerfNum(text, "Transaction Strike Rate");
  s.avgSalePerTx = grabPerfNum(text, "Average Sale Per Transaction");
  s.avgSalePerPatron = grabPerfNum(text, "Average Sale Per Patron");
  s.internetServiceCharge = grabPerfNum(text, "Internet Service Charge");
  s.effectiveNett = grabPerfNum(text, "Effective Nett");
  s.gcam = grabPerfNum(text, "GCAM");
  /* عدد عمليات المقصف: نشتقّه من الإيراد ÷ متوسط قيمة العملية (أدق من ترتيب الأسطر)،
     وإن تعذّر نأخذ أول "Transactions" غير المسبوقة بـ Total */
  if (s.grossRevenue && s.avgValuePerTx) s.concessionTransactions = Math.round(s.grossRevenue / s.avgValuePerTx);
  else {
    const all = [...text.matchAll(/(?:^|[^A-Za-z])Transactions\s*:\s*(-?[\d,]+\.?\d*)/g)]
                 .map(m=>toNum(m[1]));
    const others = all.filter(v=>v !== s.totalTransactions);
    s.concessionTransactions = others.length ? Math.min(...others) : null;
  }
  return s;
}
function isGrandTotalFilmRow(tokens, summary){
  if (tokens.length < 2) return false;
  const shows = toNum(tokens[0]), admits = toNum(tokens[1]);
  return summary.totalShows!=null && Math.abs(shows-summary.totalShows)<0.01 &&
         summary.totalAdmits!=null && Math.abs(admits-summary.totalAdmits)<0.01;
}
function parseFilmTotalsRow(tokens){
  const nums = tokens.map(toNum);
  const n = nums.length;
  if (n < 8) return null;
  const netAtp = nums[n-1], atp = nums[n-2], nettBor = nums[n-3], svc = nums[n-4], vat = nums[n-5], bor = nums[n-6];
  const head = nums.slice(0, n-6);
  return {shows: head[0], admits: head[1], capacity: head[2], bor, vat, svc, nettBor, atp, netAtp};
}
function parsePerformanceFilms(lines, summary){
  let inSection = false, curFilm = null, curRows = [];
  const films = [];
  const finalize = ()=>{
    if (!curFilm || !curRows.length) return;
    let rowTokens = curRows[curRows.length-1];
    if (isGrandTotalFilmRow(rowTokens, summary) && curRows.length>1) rowTokens = curRows[curRows.length-2];
    const totals = parseFilmTotalsRow(rowTokens);
    if (totals) films.push({name: curFilm, ...totals});
  };
  for (const l of lines){
    const x = l.trim(); if (!x) continue;
    if (/^Audience Revenue ATP/i.test(x)){ inSection = true; continue; }
    if (/^Concession Sales Analysis/i.test(x)){ finalize(); break; }
    if (!inSection) continue;
    if (isPerfFurnitureLine(x)) continue;
    if (isAllNumericTokens(x)){
      if (curFilm) curRows.push(x.split(/\s+/));
      continue;
    }
    /* اسم الفيلم أحياناً ملفوف على سطرين أو أكثر في الـPDF
       (مثل "Supergirl: Woman Of" + "Tomorrow") — إذا ما وصلتنا أي صفوف أرقام بعد،
       فهذا السطر تكملة لاسم الفيلم الحالي وليس فيلماً جديداً */
    if (curFilm && !curRows.length){
      curFilm = curFilm + " " + x;
      continue;
    }
    finalize();
    curFilm = x;
    curRows = [];
  }
  /* حماية إضافية: تنظيف أي شظايا من رأس الجدول التصقت باسم الفيلم (مثل HouseFull/Capacity)
     ثم استبعاد أي "فيلم" اسمه فاضي أو مطابق تماماً لكلمة من رأس الجدول وليس اسم فيلم حقيقي */
  const JUNK_WORDS = /\b(HouseFull|Capacity|Film|BOR|VAT|ATP|Admits)\b/gi;
  const JUNK_EXACT = /^(HouseFull|Capacity|Film|BOR|VAT|ATP|Admits|No Of Shows)$/i;
  return films
    .map(f => ({...f, name: f.name.replace(JUNK_WORDS, "").replace(/\s+/g," ").trim()}))
    .filter(f => f.name && !JUNK_EXACT.test(f.name));
}
const PERF_CATS = ["F&B","BOTTLED BEVERAGES","COMBOS","NON BOTTLED BEVERAGES","NON PACKAGED FOOD ITEM","PACKAGED FOOD ITEM","TAKE AWAY"];
const PERF_CATS_SET = new Set(PERF_CATS);
const DRINK_CATS = new Set(["BOTTLED BEVERAGES","NON BOTTLED BEVERAGES"]);
const DRINK_NAME_RE = /coke|sprite|fanta|pepsi|vimto|rani|barbican|monster|schweppes|arwa|water|slush|mojito|lagoon|float|energy|drink|juice|can\b|- ?250 ?ml|- ?500 ?ml/i;
function classifyPerfProduct(name, category){
  const cat = String(category||"").toUpperCase().trim();
  if (DRINK_CATS.has(cat)) return "drink";
  if (PERF_CATS_SET.has(cat) && cat !== "F&B" && cat !== "TAKE AWAY" && cat !== "COMBOS") return "food";
  return DRINK_NAME_RE.test(String(name)) ? "drink" : "food";
}
function perfCatLabel(p){
  const type = p.type || classifyPerfProduct(p.name, p.category);
  return t(type === "drink" ? "cat_drink" : "cat_food");
}
function parsePerformanceProducts(lines){
  const arr = lines.map(l=>l.trim()).filter(l=>l);
  let inSection = false, curCat = null, pendingFrag = "";
  const products = [];
  for (let idx=0; idx<arr.length; idx++){
    const x = arr[idx];
    if (/^Concession Sales Analysis/i.test(x)){ inSection = true; continue; }
    if (!inSection) continue;
    if (/^Grand Total\s*:/i.test(x)) break;
    if (isPerfFurnitureLine(x)) continue;
    const parts = x.split(/\s+/);
    let i = parts.length;
    while (i>0 && NUM_LOOSE_RE.test(parts[i-1])) i--;
    const name0 = parts.slice(0,i).join(" ");
    const numParts = parts.slice(i).map(toNum);
    if (!numParts.length){
      /* سطر نصي بحت: إما اسم فئة معروفة، أو جزء من اسم منتج ملفوف على أكثر من سطر */
      if (PERF_CATS_SET.has(x.toUpperCase())){ curCat = x; pendingFrag = ""; continue; }
      pendingFrag = pendingFrag ? (pendingFrag + " " + x) : x;
      continue;
    }
    if (numParts.length < 11){
      /* سطر فيه أرقام قليلة بنهايته = غالباً الجزء الأول من اسم منتج ملفوف
         (مثل "Large Tub Cheese Popcorn - 85" ثم "Oz 01 2.98 ...") — نحتفظ به كتكملة */
      pendingFrag = pendingFrag ? (pendingFrag + " " + x) : x;
      continue;
    }
    let name = name0;
    if (pendingFrag){ name = (pendingFrag + " " + name0).trim(); pendingFrag = ""; }
    if (!name) continue;
    if (PERF_CATS_SET.has(name.toUpperCase())) continue;
    /* أحياناً اسم المنتج يلتف على 3 أسطر: بداية الاسم، ثم سطر الأرقام وحده (بدون اسم إطلاقاً)،
       ثم بقية الاسم بسطر مستقل بعده (مثل "Schweppes Pomegranate -" / أرقام / "250Ml") —
       إذا السطر التالي نص بحت وليس فئة ولا بداية منتج جديد (أي السطر بعده ليس صف أرقام بلا اسم)، فهو تكملة الاسم */
    if (!name0){
      const next = arr[idx+1];
      if (next && !isPerfFurnitureLine(next) && !PERF_CATS_SET.has(next.toUpperCase())){
        const p2 = next.split(/\s+/);
        let j = p2.length; while (j>0 && NUM_LOOSE_RE.test(p2[j-1])) j--;
        const nextHasNoNums = j===p2.length;
        const nextIsBareNumRow = j===0 && p2.length>=8;
        if (nextHasNoNums && !nextIsBareNumRow){ name = (name + " " + next).trim(); idx++; }
      }
    }
    const last11 = numParts.slice(-11);
    const [qty, netPrice, stdProfit, stdProfitPct, , , , netSales, salesMixPct, netProfit, profitMixPct] = last11;
    products.push({category: curCat, type: classifyPerfProduct(name, curCat), name, qty, netPrice, stdProfit, stdProfitPct, netSales, salesMixPct, netProfit, profitMixPct});
  }
  /* دمج نفس المنتج لو تكرر بأسعار مختلفة (نفس الاسم يظهر عدة مرات بالتقرير) */
  const map = {};
  for (const p of products){
    const k = p.name.toUpperCase();
    if (!map[k]) map[k] = {...p};
    else {
      map[k].qty += p.qty||0;
      map[k].netSales += p.netSales||0;
      map[k].netProfit += p.netProfit||0;
      map[k].salesMixPct = +((map[k].salesMixPct||0) + (p.salesMixPct||0)).toFixed(2);
    }
  }
  return Object.values(map);
}
function parsePerformanceLines(lines){
  const boundary = lines.findIndex(l=>/Audience Revenue ATP/i.test(l));
  const summaryLines = boundary>=0 ? lines.slice(0, boundary) : lines;
  const summary = parsePerformanceSummary(summaryLines);
  const films = parsePerformanceFilms(lines, summary);
  const products = parsePerformanceProducts(lines);
  let from = "", to = "";
  const text = lines.join(" ");
  const mf = text.match(/From:\s*([\d/]+)/i); if (mf) from = mf[1];
  const mt = text.match(/To:\s*([\d/]+)/i); if (mt) to = mt[1];
  return {from, to, summary, films, products};
}
/* ---------- تقرير مبيعات الموظفين التفصيلي (كميات المنتجات لكل موظف) ---------- */
const EMPD_NUM_RE = /^-?[\d,]+(\.\d+)?$/;
function isEmpDetailFurniture(l){
  return /^From:|^To:|^As On:|^Page:|^User:\s|^Type\s*:|^User ID User Name|^Onaizah|^Bldg No|^Unaizah\s*,|Zip Code|^Detailed User Transaction/i.test(l.trim());
}
function parseEmpDetailLines(lines){
  let from = "", to = "";
  for (const l of lines){
    const mf = l.match(/From:\s*([\d/]+)/i); if (mf && !from) from = mf[1];
    const mt = l.match(/To:\s*([\d/]+)/i); if (mt && !to) to = mt[1];
  }
  const users = {};
  let curEmp = null;
  for (const raw of lines){
    const l = raw.trim(); if (!l) continue;
    if (isEmpDetailFurniture(l)) continue;
    if (/^Total\s/i.test(l) || /^Grand Total/i.test(l)) continue;
    /* سطر يبدأ بتاريخ = سطر معاملة تفصيلية أو مجموع يومي — نتجاهله */
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(l)) continue;
    /* بداية موظف: كود من 4-6 أرقام ثم الاسم */
    const mEmp = l.match(/^(\d{4,6})\s+([A-Za-z\u0600-\u06FF].*)$/);
    if (mEmp && !EMPD_NUM_RE.test(mEmp[2].trim().split(/\s+/).pop())){
      const code = mEmp[1], name = mEmp[2].trim();
      if (!users[name]) users[name] = {code, name, items:{}};
      curEmp = users[name];
      continue;
    }
    if (!curEmp) continue;
    /* سطر مجموع المنتج: اسم + 3 أرقام بالنهاية (كمية، سعر، مبلغ) */
    const parts = l.split(/\s+/);
    let i = parts.length;
    while (i>0 && EMPD_NUM_RE.test(parts[i-1])) i--;
    const numCount = parts.length - i;
    const name = parts.slice(0,i).join(" ").trim();
    if (numCount === 3 && name && !/^\d/.test(name)){
      const qty = toNum(parts[i]);
      if (qty > 0) curEmp.items[name] = (curEmp.items[name]||0) + qty;
    }
  }
  const list = Object.values(users).map(u=>({
    code: u.code, name: u.name,
    items: Object.entries(u.items).map(([name,qty])=>({name,qty})).sort((a,b)=>b.qty-a.qty),
    totalQty: Object.values(u.items).reduce((s,q)=>s+q,0)
  })).filter(u=>u.items.length).sort((a,b)=>b.totalQty-a.totalQty);
  return {from, to, users: list};
}
function parseSellersLines(lines){
  let from="", to="";
  const ids = {}; const totals = {};
  const headRe = /^(\d{3,6})\s+([A-Za-z][A-Za-z .'\-]+)$/;
  for (const l of lines){
    const x = l.trim();
    const mf = x.match(/From:\s*([\d/]+)/); if (mf && !from) from = mf[1];
    const mt = x.match(/^To:\s*([\d/]+)/); if (mt && !to) to = mt[1];
    if (/^User:/i.test(x)) continue;
    const h = x.match(headRe);
    if (h){ ids[h[2].replace(/\s+/g," ").trim()] = h[1]; continue; }
    const m = x.match(/^(.+?)\s+([\d,]+\.\d{2})$/);
    if (m){
      const name = m[1].replace(/\s+/g," ").trim();
      if (ids[name] !== undefined) totals[name] = (totals[name]||0) + toNum(m[2]);
    }
  }
  return {from, to, sellers: Object.entries(totals).map(([name,amount])=>({name, empId: ids[name]||"", amount}))};
}
/* ============================================================
   (1) تقرير المبيعات اليومي — Daily Sales Report - Period Wise
   يقرأ عدد التذاكر لكل موظف من قسم Box Office فقط.
   يقبل ملف يوم واحد أو ملف فترة كاملة (شهر).
   ============================================================ */
const MON3 = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function anyDateKey(s){
  const x = String(s||"").trim();
  let m = x.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})/);   /* 06-Aug-26 */
  if (m){
    const mo = MON3[m[2].toLowerCase()]; if (!mo) return "";
    let y = +m[3]; if (y < 100) y += 2000;
    return `${y}-${String(mo).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;
  }
  m = x.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);              /* 06/08/2026 */
  if (m) return `${m[3]}-${String(+m[2]).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;
  m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return x.slice(0,10);
  return "";
}
const NAME_RE = /^[A-Za-z][A-Za-z .'\-]{2,60}$/;
function collectStaffCodes(lines){
  /* "Nawaf Hamdi Alharbi" + "(85010)"  أو  "Abdullah Aldubyb(85038)" */
  const people = {};
  const n = s => String(s).replace(/\s+/g," ").trim();
  for (let i=0;i<lines.length;i++){
    const l = n(lines[i]);
    let m = l.match(/^([A-Za-z][A-Za-z .'\-]{2,60}?)\s*\((\d{3,6})\)$/);
    if (m){ people[n(m[1])] = m[2]; continue; }
    const nx = n(lines[i+1]||"");
    if (NAME_RE.test(l) && /^\(\d{3,6}\)$/.test(nx)) people[l] = nx.replace(/[()]/g,"");
  }
  return people;
}
function parseTicketLines(lines){
  const n = s => String(s).replace(/\s+/g," ").trim();
  let from="", to="";
  for (const raw of lines){
    const l = n(raw);
    const mf = l.match(/From\s*:\s*([0-9A-Za-z\/\-]+)/i); if (mf && !from) from = anyDateKey(mf[1]);
    const mt = l.match(/\bTo\s*:\s*([0-9A-Za-z\/\-]+)/i); if (mt && !to)  to  = anyDateKey(mt[1]);
  }
  const people = collectStaffCodes(lines);
  const rows = {};
  let outlet = "";
  for (const raw of lines){
    const l = n(raw);
    if (!l) continue;
    /* الأقسام التلخيصية بآخر التقرير ما فيها تفصيل موظفين — نوقف عندها */
    if (/^(Payment Type Wise Summary|Film Wise Summary|User Wise Summary|Advance Sold Today Summary)/i.test(l)) break;
    if (/^Box\s*Office$/i.test(l)){ outlet = "BO"; continue; }
    if (/^Concession$/i.test(l)) { outlet = "FB"; continue; }
    if (/^(Prepaid|Lounge|Kiosk)$/i.test(l)){ outlet = "OTHER"; continue; }
    /* سطر إجمالي الموظف: الاسم + تذاكر + إيراد + خصم + صافي */
    const m = l.match(/^(.+?)\s+(\d{1,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
    if (!m) continue;
    const name = n(m[1]);
    if (people[name] === undefined) continue;           /* تجاهل مجاميع الأقسام */
    const r = rows[name] = rows[name] || {name, code:people[name], tickets:0, revenue:0, fbItems:0, fbRevenue:0};
    if (outlet === "BO"){ r.tickets += parseInt(m[2],10)||0; r.revenue += toNum(m[5]); }
    else if (outlet === "FB"){ r.fbItems += parseInt(m[2],10)||0; r.fbRevenue += toNum(m[5]); }
  }
  const users = Object.values(rows).filter(r=>r.tickets>0 || r.fbItems>0)
                      .sort((a,b)=>b.tickets-a.tickets);
  return {from, to, users};
}

/* ============================================================
   (2) سجل معاملات الأكل — Summary User Transaction Log
   كمية كل صنف لكل موظف + قيمته + تمييز الكومبو.
   ============================================================ */
const COMBO_RE = /(combo|duo|squad|bundle|meal|pack\b|mission)/i;
function isComboItem(name){ return COMBO_RE.test(String(name)); }
function parseFnbLines(lines){
  const n = s => String(s).replace(/\s+/g," ").trim();
  let from="", to="";
  for (const raw of lines){
    const l = n(raw);
    const mf = l.match(/From\s*:\s*([0-9A-Za-z\/\-]+)/i); if (mf && !from) from = anyDateKey(mf[1]);
    const mt = l.match(/\bTo\s*:\s*([0-9A-Za-z\/\-]+)/i); if (mt && !to)  to  = anyDateKey(mt[1]);
  }
  const users = {};
  let cur = null, pending = "";
  const ITEM_RE = /^(.+?)\s+([\d,]+\.\d{2})\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  /* السطر يبدأ بالأرقام لأن اسم الصنف انقسم على السطر السابق، وبقيته تأتي بعده */
  const ITEM_NUM_RE = /^([\d,]+\.\d{2})\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  let splitTail = false, lastItem = null;
  const addItem = (name, qty, gross) => {
    const item = n(name);
    if (!/[A-Za-z]/.test(item) || !qty) return null;
    const it = cur.items[item] = cur.items[item] || {name:item, qty:0, gross:0, combo:isComboItem(item)};
    it.qty += qty; it.gross += gross;
    cur.qty += qty; cur.gross += gross;
    if (it.combo){ cur.comboQty += qty; cur.comboGross += gross; }
    return it;
  };
  /* دمج بقية الاسم مع الصنف الأخير وإعادة حساب حالة الكومبو */
  const mergeTail = (tail) => {
    if (!lastItem || !cur) return;
    const old = lastItem, name = n(old.name + " " + tail);
    delete cur.items[old.name];
    if (old.combo){ cur.comboQty -= old.qty; cur.comboGross -= old.gross; }
    const it = cur.items[name] = cur.items[name] || {name, qty:0, gross:0, combo:isComboItem(name)};
    it.qty += old.qty; it.gross += old.gross;
    if (it.combo){ cur.comboQty += old.qty; cur.comboGross += old.gross; }
    lastItem = it;
  };
  const TOTAL_RE = /^(.+?)\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  for (const raw of lines){
    const l = n(raw); if (!l) continue;
    if (/^(UserID|Total\b|Page|As On|From\s*:|To\s*:|Bldg|Unaizah|Zip Code|User\s*:|Summary User Transaction)/i.test(l) || /\bFrom\s*:\s*\d/i.test(l) || /\bTo\s*:\s*\d/i.test(l)) { pending=""; continue; }
    /* رأس موظف: كود + اسم */
    const h = l.match(/^(\d{4,6})\s+([A-Za-z][A-Za-z .'\-]{2,60})$/);
    if (h){
      const name = n(h[2]);
      cur = users[name] = users[name] || {code:h[1], name, items:{}, qty:0, gross:0, comboQty:0, comboGross:0};
      pending = ""; splitTail = false; lastItem = null; continue;
    }
    if (!cur) continue;
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(l)) { pending=""; continue; }  /* سطر تاريخ/مجموع يومي */
    let mn = l.match(ITEM_NUM_RE);
    if (mn && pending){                       /* الاسم كان بالسطر السابق */
      lastItem = addItem(pending, parseInt(mn[2],10)||0, toNum(mn[3]));
      pending = ""; splitTail = true; continue;
    }
    let line = pending ? (pending + " " + l) : l;
    let m = line.match(ITEM_RE);
    if (m){
      pending = ""; splitTail = false;
      lastItem = addItem(m[1], parseInt(m[3],10)||0, toNum(m[4]));
      continue;
    }
    /* سطر إجمالي الموظف — نتجاهله لأن المجموع محسوب من الأصناف */
    if (TOTAL_RE.test(line)) { pending=""; splitTail=false; continue; }
    if (splitTail && /[A-Za-z]/.test(l) && l.length < 40){   /* بقية اسم الصنف */
      mergeTail(l); splitTail = false; pending = ""; continue;
    }
    /* اسم صنف مقسوم على سطرين */
    splitTail = false;
    pending = /[A-Za-z]/.test(l) && l.length < 70 ? l : "";
  }
  const list = Object.values(users).map(u=>({
    code:u.code, name:u.name,
    qty:+u.qty.toFixed(2), gross:+u.gross.toFixed(2),
    comboQty:+u.comboQty.toFixed(2), comboGross:+u.comboGross.toFixed(2),
    items: Object.values(u.items).sort((a,b)=>b.qty-a.qty)
  })).filter(u=>u.qty>0).sort((a,b)=>b.qty-a.qty);
  return {from, to, users:list};
}

function parseGRNLines(lines){
  let from="", to="";
  const dts = lines.filter(l=>/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/.test(l.trim()));
  if (dts[0]) from = dts[0].slice(0,10);
  if (dts[1]) to = dts[1].slice(0,10);
  const rows = []; let curDate="", curSupplier=""; let totals=null;
  for (let i=0;i<lines.length;i++){
    const x = lines[i].trim();
    const hd = x.match(/^(\d{2,5})\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)$/);
    if (hd && !/^\d{2}\/\d{2}\/\d{4}/.test(hd[3])){ curDate = hd[2]; curSupplier = (hd[3].replace(/\s+\S*$/,"").trim()||hd[3].trim()); continue; }
    const tot = x.match(/^Total\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
    if (tot){ totals = {qty:toNum(tot[1]), net:toNum(tot[2]), tax:toNum(tot[3])}; continue; }
    const m = x.match(/^(.+?)\s+(No|Kg|Litres|Ltr|Pcs)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
    if (m && /[A-Za-z]/.test(m[1]) && !/^(No Date|Supplier)/i.test(m[1])){
      let tax = 0;
      const nx = (lines[i+1]||"").trim().match(/^VAT ([\d,]+\.\d{2})/);
      if (nx) tax = toNum(nx[1]);
      rows.push({name:m[1].trim(), uom:m[2], qty:toNum(m[3]), rate:toNum(m[4]), net:toNum(m[5]), tax, date:curDate, supplier:curSupplier});
    }
  }
  return {from, to, rows, totals};
}

/* ---------- inventory ---------- */
let latestSnap = null, prevSnap = null, allSnaps = [];
$("invFile").addEventListener("change", e=>{ if(e.target.files[0]) handleInvUpload(e.target.files[0]); e.target.value=""; });
const dz = $("invDrop");
["dragover","dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{
  e.preventDefault();
  dz.classList.toggle("over", ev==="dragover");
  if (ev==="drop" && e.dataTransfer.files[0]) handleInvUpload(e.dataTransfer.files[0]);
}));
async function handleInvUpload(file){
  showLoadingCloud();
  try{
    $("invStatus").textContent = t("inv_reading");
    const lines = await pdfToLines(file, (p, total)=>{
      if (total > 1) $("invStatus").textContent = t("inv_reading") + ` (${p}/${total})`;
    });
    const parsed = parseStockLines(lines);
    if (!parsed.items.length) { $("invStatus").textContent = "❌ " + t("inv_err_parse"); return; }
    const fromLine = lines.find(l=>/From:\s*\d/.test(l))||"";
    const reportFrom = (fromLine.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)||[])[1] || "";
    const key = todayKey();
    const b = curBranch();
    await DB.set("inv_snapshots", snapKeyFor(b, key), {date:key, branch:b, ts:Date.now(), locations:parsed.locations, items:parsed.items, reportFrom});
    $("invStatus").textContent = "✅ " + t("inv_ok",{d:key,a:parsed.items.length,b:parsed.locations.length})
      + (reportFrom ? ` · 📅 ${t("file_of")}: ${monthYearOf(reportFrom)}` : "");
    toast(t("t_saved_inv"));
    DB.pruneSnapshots().catch(()=>{});
    await loadInventory();
    /* ملف التواريخ يتكيّف مع الجرد الجديد مباشرة */
    await loadExpiry().catch(()=>{});
    await reconcileExpiryWithStock(true).catch(()=>{});
  }catch(err){ console.error(err); $("invStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
}
async function loadInventory(){
  const b = curBranch();
  const snaps = (await DB.list("inv_snapshots")).filter(s=>(s.branch||"MAIN")===b).sort((x,y)=>x.date<y.date?1:-1);
  allSnaps = snaps;
  latestSnap = snaps[0]||null; prevSnap = snaps[1]||null;
  rebuildSelects();
  renderInv(); renderAlerts(); renderExpStatus();
  renderFileTimestamps();
}
function fillWarehouseFilter(){
  const sel = $("invLocFilter"); if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">${t("all_wh")}</option>`;
  if (latestSnap) sortLocs(latestSnap.locations).forEach(l=>sel.innerHTML+=`<option value="${esc(l)}">${esc(locLabel(l))}</option>`);
  sel.value = cur;
}
function renderInv(){
  const body = $("invTable")?.querySelector("tbody"); if(!body) return;
  const stats = $("invStats");
  if (!latestSnap){ body.innerHTML=`<tr><td colspan="6">${emptyState("no_inv","box")}</td></tr>`; stats.innerHTML=""; $("invMeta").textContent=""; return; }
  $("invMeta").textContent = `${t("last_inv")}: ${latestSnap.date}` + (latestSnap.reportFrom ? ` (📅 ${monthYearOf(latestSnap.reportFrom)})` : "") + (prevSnap ? ` · ${t("cmp_with")} ${prevSnap.date}` : ` · ${t("no_prev")}`);
  const prevMap = {};
  if (prevSnap) prevSnap.items.forEach(i=>prevMap[i.loc+"|"+i.name]=i.qty);
  const q = ($("invSearch").value||"").toLowerCase();
  const lf = $("invLocFilter").value;
  const rows = latestSnap.items
    .filter(i => (!lf || i.loc===lf) && (!q || i.name.toLowerCase().includes(q)))
    .sort((a,b)=> locRank(a.loc)-locRank(b.loc) || a.name.localeCompare(b.name));
  body.innerHTML = rows.map(i=>{
    const pv = prevMap[i.loc+"|"+i.name];
    const diff = pv===undefined ? null : +(i.qty-pv).toFixed(2);
    const dTxt = diff===null ? `<span class="pill">${t("new_pill")}</span>`
      : diff===0 ? '<span class="zero num">0</span>'
      : `<span class="num ${diff>0?"pos":"neg"}">${diff>0?"+":""}${fmt(diff)}</span>`;
    /* عمود السيلز سبيس: يبيّن إذا الكمية أقل من المطلوب أو إذا ما تحدد أصلاً */
    const sp = spaceTargetFor(i.loc, i.name);
    let spTxt;
    if (sp.min === null) spTxt = `<span class="pill" style="opacity:.5">—</span>`;
    else if (i.qty < sp.min)
      spTxt = `<span class="pill r">${fmt(sp.min)} · ${t("space_short")} ${fmt(+(sp.min-i.qty).toFixed(2))}</span>`;
    else
      spTxt = `<span class="pill g">${fmt(sp.min)}</span>`;
    if (sp.isDefault) spTxt += ` <span class="pill a" style="font-size:10px">${t("rf_default")}</span>`;
    return `<tr><td>${esc(i.name)}</td><td><span class="pill">${esc(locLabel(i.loc))}</span></td>
      <td class="num">${fmt(i.qty)}</td><td>${spTxt}</td><td class="num">${pv===undefined?"—":fmt(pv)}</td><td>${dTxt}</td></tr>`;
  }).join("") || `<tr><td colspan="6">${emptyState("no_results_match","search")}</td></tr>`;
  let grossAll=0, changedAll=0;
  latestSnap.items.forEach(i=>{
    grossAll += i.gross||0;
    const pv = prevMap[i.loc+"|"+i.name];
    if (pv!==undefined && +(i.qty-pv).toFixed(2)!==0) changedAll++;
  });
  const alerts = computeAlerts();
  /* منتجات الريفل اللي ما لها سيلز سبيس محدد — تشتغل بالافتراضي */
  const unsetSpace = latestSnap.items.filter(i=>isRefuel(i.loc) && !parLevels.some(p=>p.loc===i.loc && p.name===i.name)).length;
  stats.innerHTML = `
    <div class="stat"><div class="v">${fmt(latestSnap.items.length)}</div><div class="l">${t("stat_items")}</div></div>
    <div class="stat"><div class="v">${latestSnap.locations.length}</div><div class="l">${t("stat_whs")}</div></div>
    <div class="stat"><div class="v">${fmt(grossAll)}</div><div class="l">${t("stat_value")}</div></div>
    <div class="stat"><div class="v">${prevSnap?changedAll:"—"}</div><div class="l">${t("stat_changed")}</div></div>
    <div class="stat"><div class="v" style="color:${alerts.length? "var(--amber)":"var(--green)"}">${alerts.length}</div><div class="l">${t("needs_refill")}</div></div>
    <div class="stat"><div class="v" style="color:${unsetSpace? "var(--amber)":"var(--green)"}">${unsetSpace}</div><div class="l">${t("space_unset_stat")}</div></div>`;
}

/* ---------- refill & transfer ---------- */
let parLevels = [];
async function loadPars(){ parLevels = await DB.list("par_levels"); renderPars(); renderAlerts(); }