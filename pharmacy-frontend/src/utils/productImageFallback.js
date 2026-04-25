const BRAND_IMAGE_RULES = [
  { keys: ["acamol"], url: "https://images.unsplash.com/photo-1540420773426-5e698572b6a7?w=600" },
  { keys: ["adol"], url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600" },
  { keys: ["brufen", "ibuprofen"], url: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600" },
  { keys: ["voltaren", "diclofenac"], url: "https://images.unsplash.com/photo-1620916566392-39f1143ab5be?w=600" },
  { keys: ["cetal", "panadol", "novalgin", "spasmalgon"], url: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600" },
  { keys: ["amoxil", "augmentin", "ciproxin", "zithromax", "klacid", "cefixime", "flagyl", "doxycycline"], url: "https://images.unsplash.com/photo-1603398938378-e54eab446d59?w=600" },
  { keys: ["vitamin", "omega", "zinc", "magnesium", "calcium", "collagen", "biotin", "folic", "iron", "probiotic"], url: "https://images.unsplash.com/photo-1571844307880-751c6d86f3f3?w=600" },
  { keys: ["concor", "diovan", "norvasc", "lasix", "capoten", "zestril", "lipitor", "crestor"], url: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=600" },
  { keys: ["glucophage", "diamicron", "januvia", "galvus", "forxiga", "jardiance", "lantus", "novorapid", "trulicity"], url: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=600" },
  { keys: ["ventolin", "seretide", "pulmicort", "atrovent", "flixotide", "zyrtec", "claritin", "telfast", "aerius"], url: "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600" },
  { keys: ["gaviscon", "nexium", "omeprazole", "pantoloc", "motilium", "buscopan", "imodium", "duphalac", "colofac", "creon"], url: "https://images.unsplash.com/photo-1607619056574-7b8d3ee067b3?w=600" },
  { keys: ["canesten", "daktarin", "betnovate", "elocon", "protopic", "differin", "acnelyse", "fucidin", "sudocrem", "vichy"], url: "https://images.unsplash.com/photo-1601049676869-702ea24cfd58?w=600" },
  { keys: ["xanax", "lexotan", "rivotril", "prozac", "cipralex", "lyrica", "neurontin"], url: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600" },
  { keys: ["calpol", "nurofen", "pediakid", "otrivin", "rhinathiol", "smecta", "pediasure"], url: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=600" },
];

const CATEGORY_IMAGE_RULES = [
  { keys: ["مسكن", "pain"], url: "https://images.unsplash.com/photo-1540420773426-5e698572b6a7?w=600" },
  { keys: ["مضاد", "antibi"], url: "https://images.unsplash.com/photo-1603398938378-e54eab446d59?w=600" },
  { keys: ["فيتامين", "مكمل", "vitamin"], url: "https://images.unsplash.com/photo-1571844307880-751c6d86f3f3?w=600" },
  { keys: ["قلب", "ضغط", "cardio"], url: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=600" },
  { keys: ["سكري", "diab"], url: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=600" },
  { keys: ["تنفسي", "resp"], url: "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600" },
  { keys: ["هضمي", "gastro"], url: "https://images.unsplash.com/photo-1607619056574-7b8d3ee067b3?w=600" },
  { keys: ["جلدي", "derma"], url: "https://images.unsplash.com/photo-1601049676869-702ea24cfd58?w=600" },
  { keys: ["أعصاب", "neuro"], url: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600" },
  { keys: ["أطفال", "pedi"], url: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=600" },
];

const DEFAULT_PHARMACY_IMAGE = "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600";

function containsAny(text, keys) {
  return keys.some((k) => text.includes(k));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function getProductImageFallback(productName, categoryName) {
  const name = normalizeText(productName);
  const category = normalizeText(categoryName);
  for (const rule of BRAND_IMAGE_RULES) {
    if (containsAny(name, rule.keys)) return rule.url;
  }
  for (const rule of CATEGORY_IMAGE_RULES) {
    if (containsAny(category, rule.keys)) return rule.url;
  }
  return DEFAULT_PHARMACY_IMAGE;
}

