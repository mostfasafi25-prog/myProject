/** أصناف وتصنيفات تجريبية للعرض الأولي (localStorage فارغ) — باراسيتامول بمستويات متعددة وخيارات بيع */

const IMG =
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80";

export const DEMO_CATEGORY_NAMES = [
  "مسكنات",
  "مضادات حيوية",
  "فيتامينات",
  "أطفال",
  "هضمية",
  "عناية",
  "أمراض مزمنة",
  "جلدية",
  "أنف وأذن وحنجرة",
  "مكملات",
  "أعصاب",
  "قلب وأوعية",
  "سكر وغدد",
  "روماتيزم",
  "مسالك بولية",
  "نساء وحمل",
  "مضادات فيروسات",
  "عيون",
  "تنفسية",
  "مطهرات ومعقمات",
];

function opt(id, label, priceDelta = 0) {
  return { id, label, priceDelta };
}

/** خيارات بيع نموذجية لنفس المادة بجرعات/أشكال مختلفة */
function paracetamolSaleOptions(suffix) {
  const s = suffix || "p";
  return [
    opt(`${s}-1`, "شريط واحد (10 أقراص)", 0),
    opt(`${s}-2`, "علبة 2 شريط", -1),
    opt(`${s}-3`, "علبة عرض (10 علب)", -8),
  ];
}

function row(id, fields) {
  return {
    id,
    active: true,
    image: IMG,
    createdAt: "2026-04-10T08:00:00Z",
    ...fields,
  };
}

export function buildInitialDemoProducts() {
  const out = [];
  let id = 1;

  const add = (fields) => {
    out.push(row(id++, fields));
  };

  const paraVariants = [
    { vl: "100mg/5ml شراب أطفال", st: "bottle", cat: "أطفال", pr: 9, q: 40, min: 15 },
    { vl: "120mg أقراص", st: "strip", cat: "أطفال", pr: 7, q: 55, min: 20 },
    { vl: "125mg لبوس", st: "strip", cat: "أطفال", pr: 8, q: 48, min: 18 },
    { vl: "250mg أقراص مضغ", st: "strip", cat: "أطفال", pr: 10, q: 60, min: 22 },
    { vl: "500mg أقراص", st: "strip", cat: "مسكنات", pr: 12, q: 200, min: 50 },
    { vl: "500mg فوار", st: "box", cat: "مسكنات", pr: 14, q: 90, min: 30 },
    { vl: "650mg أقراص", st: "strip", cat: "مسكنات", pr: 13, q: 75, min: 25 },
    { vl: "1000mg أقراص", st: "strip", cat: "مسكنات", pr: 15, q: 65, min: 22 },
    { vl: "1000mg شراب", st: "bottle", cat: "مسكنات", pr: 16, q: 42, min: 15 },
    { vl: "80mg/ml قطرة (عيّنة)", st: "bottle", cat: "أطفال", pr: 11, q: 28, min: 10 },
  ];
  paraVariants.forEach((v, i) => {
    add({
      name: "باراسيتامول",
      variantLabel: v.vl,
      category: v.cat,
      saleType: v.st,
      qty: v.q,
      min: v.min,
      price: v.pr,
      saleOptions: paracetamolSaleOptions(`pa-${i}`),
    });
  });

  const ibu = [
    { vl: "200mg أقراص", pr: 10, q: 110 },
    { vl: "400mg أقراص", pr: 14, q: 95 },
    { vl: "400mg شراب", pr: 18, q: 38, st: "bottle" },
    { vl: "600mg أقراص", pr: 16, q: 72 },
  ];
  ibu.forEach((v, i) => {
    add({
      name: "إيبوبروفين",
      variantLabel: v.vl,
      category: "مسكنات",
      saleType: v.st || "strip",
      qty: v.q,
      min: 28,
      price: v.pr,
      saleOptions: [opt(`ib-${i}-1`, "شريط", 0), opt(`ib-${i}-2`, "علبة عرض", -5)],
    });
  });

  const antibiotics = [
    ["أموكسيسيلين", "250mg كبسول", 22, "مضادات حيوية"],
    ["أموكسيسيلين", "500mg كبسول", 26, "مضادات حيوية"],
    ["أموكسيسيلين", "شراب 250mg/5ml", 30, "مضادات حيوية"],
    ["أزيثروميسين", "250mg", 32, "مضادات حيوية"],
    ["أزيثروميسين", "500mg", 38, "مضادات حيوية"],
    ["سيفيكسيم", "400mg", 31, "مضادات حيوية"],
    ["كلاريثروميسين", "500mg", 39, "مضادات حيوية"],
    ["ميترونيدازول", "400mg", 12, "مضادات حيوية"],
    ["سيبروفلوكساسين", "500mg أقراص", 24, "مضادات حيوية"],
  ];
  antibiotics.forEach(([n, vl, pr, cat]) => {
    add({
      name: n,
      variantLabel: vl,
      category: cat,
      saleType: vl.includes("شراب") ? "bottle" : "strip",
      qty: 40 + (id % 40),
      min: 15,
      price: pr,
    });
  });

  const vitamins = [
    ["فيتامين C", "500mg", 14],
    ["فيتامين C", "1000mg", 18],
    ["فيتامين D3", "1000 وحدة", 16],
    ["فيتامين D3", "5000 وحدة", 24],
    ["فيتامين B مركب", "شراب", 20],
    ["زنك", "15mg", 12],
    ["زنك", "50mg", 15],
    ["حديد + حمض فوليك", "كبسول", 19],
    ["أوميغا 3", "1000mg", 32],
    ["مغنيسيوم", "400mg", 26],
  ];
  vitamins.forEach(([n, vl, pr]) => {
    add({
      name: n,
      variantLabel: vl,
      category: "فيتامينات",
      saleType: vl.includes("شراب") ? "bottle" : "strip",
      qty: 55 + (id % 50),
      min: 20,
      price: pr,
    });
  });

  const chronic = [
    ["ميتفورمين", "500mg", 14, "سكر وغدد"],
    ["ميتفورمين", "850mg", 18, "سكر وغدد"],
    ["جليكلازيد", "80mg", 22, "سكر وغدد"],
    ["أملوديبين", "5mg", 20, "قلب وأوعية"],
    ["أملوديبين", "10mg", 24, "قلب وأوعية"],
    ["أتورفاستاتين", "20mg", 28, "قلب وأوعية"],
    ["أسبرين", "81mg", 9, "قلب وأوعية"],
    ["كلوبيدوجريل", "75mg", 34, "قلب وأوعية"],
  ];
  chronic.forEach(([n, vl, pr, cat]) => {
    add({ name: n, variantLabel: vl, category: cat, saleType: "strip", qty: 80, min: 25, price: pr });
  });

  const misc = [
    ["أوميبرازول", "20mg", "هضمية", 16],
    ["أوميبرازول", "40mg", "هضمية", 19],
    ["لوراتادين", "10mg", "عناية", 13],
    ["سيتريزين", "10mg", "عناية", 11],
    ["سالبيوتامول", "بخاخ", "تنفسية", 22],
    ["فنتولين", "بخاخ", "تنفسية", 24],
    ["قطرة عين مرطبة", "10ml", "عيون", 14],
    ["كريم واقي شمس", "SPF50", "جلدية", 36],
    ["معقم يدين", "500ml", "مطهرات ومعقمات", 12],
    ["ORSS", "أطفال", "أطفال", 8],
    ["غليسيرين", "شراب ملين", "هضمية", 9],
    ["ميلاتونين", "3mg", "أعصاب", 25],
    ["ميلاتونين", "5mg", "أعصاب", 28],
    ["باراسيتامول + كافيين", "أقراص", "مسكنات", 13],
    ["ديكلوفيناك", "50mg أقراص", "روماتيزم", 11],
    ["ديكلوفيناك", "75mg أمبول", "روماتيزم", 18],
    ["نابروكسين", "250mg", "روماتيزم", 15],
    ["نابروكسين", "500mg", "روماتيزم", 17],
    ["أوسلتاميفير", "75mg كبسول", "مضادات فيروسات", 45],
    ["أسيكلوفير", "5% مرهم", "جلدية", 16],
    ["حمض فوليك", "5mg", "نساء وحمل", 10],
    ["فينازوبيريد", "100mg", "مسالك بولية", 14],
  ];
  misc.forEach(([n, vl, cat, pr]) => {
    const st = vl.includes("بخاخ") || vl.includes("شراب") ? "bottle" : vl.includes("مرهم") ? "box" : "strip";
    add({ name: n, variantLabel: vl, category: cat, saleType: st, qty: 50 + (id % 40), min: 18, price: pr });
  });

  return out;
}
