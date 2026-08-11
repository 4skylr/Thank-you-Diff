/* ==========================================================
   Noir Cinema · 09-charts.js
   الرسوم البيانية (ApexCharts)
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   الرسوم البيانية (ApexCharts) — كلها من الملفات المرفوعة
   ============================================================ */
const CH = {};                       /* مراجع الرسوم حتى نتخلص منها قبل إعادة الرسم */
const CH_COLORS = ["#8B5CF6","#FBBF24","#34D399","#60A5FA","#F87171","#F472B6","#22D3EE","#A78BFA"];
function chBase(height){
  return {
    chart:{ type:"line", height: height||300, background:"transparent",
            toolbar:{show:false}, fontFamily:"Almarai, system-ui, sans-serif",
            animations:{enabled:true, easing:"easeinout", speed:600} },
    theme:{ mode:"dark" },
    grid:{ borderColor:"rgba(255,255,255,.07)", strokeDashArray:4 },
    dataLabels:{ enabled:false },
    tooltip:{ theme:"dark", style:{fontFamily:"Almarai"} },
    legend:{ labels:{colors:"#9C9AA8"}, fontFamily:"Almarai" },
    colors: CH_COLORS,
    noData:{ text: t("ch_nodata"), style:{color:"#9C9AA8", fontFamily:"Almarai", fontSize:"13px"} }
  };
}
function drawChart(id, opts){
  const el = $(id); if (!el) return;
  if (CH[id]){ try{ CH[id].destroy(); }catch(e){} delete CH[id]; }
  if (typeof ApexCharts === "undefined"){
    el.innerHTML = `<div class="empty" style="padding:26px"><div>${t("ch_lib_missing")}</div></div>`;
    return;
  }
  el.innerHTML = "";
  const c = new ApexCharts(el, opts);
  c.render(); CH[id] = c;
}
function renderCharts(){
  if (typeof ApexCharts === "undefined"){
    ["chTrend","chTickets","chCats","chProfit","chFilms","chStock"].forEach(id=>{
      const el = $(id); if (el) el.innerHTML = `<div class="empty" style="padding:26px"><div>${t("ch_lib_missing")}</div></div>`;
    });
    return;
  }
  chartTrend(); chartTickets(); chartCats(); chartProfit(); chartFilms(); chartStock();
}

/* 1) اتجاه الأداء اليومي: الزوار (أعمدة) + الإيراد (خط) */
function chartTrend(){
  const days = [...(perfDaily||[])].sort((a,b)=>a.date<b.date?-1:1).slice(-30);
  drawChart("chTrend", {...chBase(320),
    chart:{...chBase(320).chart, type:"line", stacked:false},
    series:[
      {name:t("bs_visitors"), type:"column", data: days.map(d=>d.summary?.totalAdmits||0)},
      {name:t("bs_total"),    type:"line",   data: days.map(d=>+(d.summary?.totalRevenue||0).toFixed(0))}
    ],
    stroke:{width:[0,3], curve:"smooth"},
    xaxis:{ categories: days.map(d=>d.date.slice(5)), labels:{style:{colors:"#9C9AA8", fontSize:"11px"}} },
    yaxis:[
      {title:{text:t("bs_visitors"), style:{color:"#9C9AA8"}}, labels:{style:{colors:"#9C9AA8"}}},
      {opposite:true, title:{text:t("sar"), style:{color:"#9C9AA8"}}, labels:{style:{colors:"#9C9AA8"}}}
    ],
    plotOptions:{ bar:{ borderRadius:5, columnWidth:"52%" } }
  });
}
/* 2) مبيعات التذاكر لكل موظف */
function chartTickets(){
  const list = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets).slice(0,10);
  drawChart("chTickets", {...chBase(300),
    chart:{...chBase(300).chart, type:"bar"},
    series:[{name:t("tkt_unit"), data:list.map(x=>x.tickets)}],
    xaxis:{ categories:list.map(x=>x.name), labels:{style:{colors:"#9C9AA8", fontSize:"11px"}} },
    plotOptions:{ bar:{ horizontal:true, borderRadius:6, distributed:true, barHeight:"64%" } },
    legend:{show:false}, dataLabels:{enabled:true, style:{fontSize:"11px"}}
  });
}
/* 3) توزيع مبيعات الأكل حسب التصنيف */
function chartCats(){
  const cats = categoryChampions();
  drawChart("chCats", {...chBase(300),
    chart:{...chBase(300).chart, type:"donut"},
    series: cats.map(c=>+c.gross.toFixed(2)),
    labels: cats.map(c=>catMeta(c.id).emo + " " + catMeta(c.id).label),
    legend:{position:"bottom", labels:{colors:"#9C9AA8"}, fontFamily:"Almarai"},
    plotOptions:{ pie:{ donut:{ size:"62%", labels:{ show:true,
      total:{ show:true, label:t("prof_revenue"), color:"#9C9AA8",
              formatter: w => fmt(w.globals.seriesTotals.reduce((a,b)=>a+b,0).toFixed(0)) } } } } },
    dataLabels:{enabled:true, formatter: v => v.toFixed(0)+"%"}
  });
}
/* 4) أعلى المنتجات ربحاً: الإيراد مقابل التكلفة */
function chartProfit(){
  const rows = profitRows().filter(r=>r.hasRecipe).slice(0,10);
  drawChart("chProfit", {...chBase(340),
    chart:{...chBase(340).chart, type:"bar", stacked:false},
    series:[
      {name:t("prof_revenue"), data:rows.map(r=>+r.revenue.toFixed(2))},
      {name:t("prof_cost"),    data:rows.map(r=>+(r.cost||0).toFixed(2))}
    ],
    colors:["#34D399","#F87171"],
    xaxis:{ categories:rows.map(r=>r.name.length>26?r.name.slice(0,25)+"…":r.name),
            labels:{style:{colors:"#9C9AA8", fontSize:"10.5px"}, rotate:-35, trim:true} },
    plotOptions:{ bar:{ borderRadius:5, columnWidth:"66%" } }
  });
}
/* 5) أقوى الأفلام في آخر يوم */
function chartFilms(){
  const last = latestPerfDay();
  const films = [...(last?.films||[])].sort((a,b)=>(b.bor||0)-(a.bor||0)).slice(0,8);
  drawChart("chFilms", {...chBase(300),
    chart:{...chBase(300).chart, type:"bar"},
    series:[{name:t("th_bor"), data:films.map(f=>+(f.bor||0).toFixed(2))}],
    xaxis:{ categories:films.map(f=>f.name.length>22?f.name.slice(0,21)+"…":f.name),
            labels:{style:{colors:"#9C9AA8", fontSize:"11px"}} },
    plotOptions:{ bar:{ horizontal:true, borderRadius:6, distributed:true, barHeight:"62%" } },
    legend:{show:false}, dataLabels:{enabled:true, style:{fontSize:"11px"}}
  });
}
/* 6) حالة المخزون: جيد / يحتاج تعبئة / نافد لكل مستودع */
function chartStock(){
  const locs = latestSnap ? sortLocs([...new Set([...(latestSnap.locations||[]), ...parLevels.map(x=>x.loc)])]) : [];
  const ok=[], low=[], zero=[];
  locs.forEach(loc=>{
    let a=0,b=0,c=0;
    locItemsWithZeros(loc).forEach(i=>{
      const sp = spaceTargetFor(loc, i.name);
      if (i.qty <= 0) c++;
      else if (sp.min !== null && i.qty < sp.min) b++;
      else a++;
    });
    ok.push(a); low.push(b); zero.push(c);
  });
  drawChart("chStock", {...chBase(300),
    chart:{...chBase(300).chart, type:"bar", stacked:true},
    series:[
      {name:t("bars_lg_ok"),   data:ok},
      {name:t("bars_lg_low"),  data:low},
      {name:t("bars_lg_zero"), data:zero}
    ],
    colors:["#34D399","#FBBF24","#F87171"],
    xaxis:{ categories:locs.map(locLabel), labels:{style:{colors:"#9C9AA8", fontSize:"11px"}} },
    plotOptions:{ bar:{ borderRadius:5, columnWidth:"48%" } }
  });
}
