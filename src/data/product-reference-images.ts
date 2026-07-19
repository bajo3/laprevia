import type { Product } from "./products";

type ReferenceRule = {
  match: string[];
  tags: string;
};

const referenceRules: ReferenceRule[] = [
  { match: ["antifaz"], tags: "glitter,party,mask" },
  { match: ["banderin"], tags: "birthday,bunting" },
  { match: ["bomba de agua"], tags: "water,balloons" },
  { match: ["confeti"], tags: "colorful,confetti" },
  { match: ["globo"], tags: "party,balloons" },
  { match: ["gorro", "sombrero"], tags: "party,hats" },
  { match: ["guirnalda"], tags: "party,garland" },
  { match: ["mantel"], tags: "party,tablecloth" },
  { match: ["matraca", "silbato"], tags: "party,noisemaker" },
  { match: ["papel crepe"], tags: "colorful,crepe,paper" },
  { match: ["pinata"], tags: "colorful,pinata" },
  { match: ["plato descartable", "vaso descartable"], tags: "party,tableware" },
  { match: ["serpentina"], tags: "party,streamers" },
  { match: ["vela decorativa"], tags: "scented,candle" },
  { match: ["vela"], tags: "birthday,candles" },
  { match: ["vincha"], tags: "party,headband" },
  { match: ["bastoncito", "chizito", "conito", "rosita"], tags: "cheese,snacks" },
  { match: ["mani"], tags: "salted,peanuts" },
  { match: ["nacho"], tags: "nachos,cheese" },
  { match: ["papas"], tags: "potato,chips" },
  { match: ["palito salado"], tags: "pretzel,sticks" },
  { match: ["pochoclo"], tags: "popcorn" },
  { match: ["alfajor"], tags: "chocolate,cookies" },
  { match: ["bombon"], tags: "chocolate,bonbons" },
  { match: ["caramelo"], tags: "colorful,candy" },
  { match: ["chicle"], tags: "chewing,gum" },
  { match: ["chocolate"], tags: "chocolate,sweets" },
  { match: ["chupetin"], tags: "colorful,lollipops" },
  { match: ["gomita"], tags: "gummy,candy" },
  { match: ["mentita"], tags: "mint,candy" },
  { match: ["oblea"], tags: "wafer,cookies" },
  { match: ["toffee"], tags: "toffee,candy" },
  { match: ["turron"], tags: "peanut,nougat" },
  { match: ["galletita", "vainilla"], tags: "cookies,biscuits" },
  { match: ["helado", "sorbete"], tags: "ice,cream" },
  { match: ["paleta", "palito de agua"], tags: "popsicles" },
  { match: ["te helado"], tags: "iced,tea" },
  { match: ["energizante"], tags: "energy,drink" },
  { match: ["gaseosa"], tags: "soda,drink" },
  { match: ["aceite"], tags: "sunflower,oil" },
  { match: ["arroz"], tags: "rice,bag" },
  { match: ["atun"], tags: "canned,tuna" },
  { match: ["cerveza"], tags: "beer,can" },
  { match: ["detergente"], tags: "dish,soap" },
  { match: ["fideo"], tags: "dry,pasta" },
  { match: ["harina"], tags: "flour,bag" },
  { match: ["jabon en polvo"], tags: "laundry,detergent" },
  { match: ["lavandina"], tags: "cleaning,bottle" },
  { match: ["leche"], tags: "milk,carton" },
  { match: ["mermelada"], tags: "fruit,jam" },
  { match: ["pure de tomate"], tags: "tomato,sauce" },
  { match: ["sal fina"], tags: "table,salt" },
  { match: ["te en saquitos"], tags: "tea,bags" },
  { match: ["vinagre"], tags: "vinegar,bottle" },
  { match: ["agenda", "cuaderno"], tags: "colorful,notebook" },
  { match: ["lapicera"], tags: "colorful,pen" },
  { match: ["llavero"], tags: "cute,keychain" },
  { match: ["peluche"], tags: "teddy,bear" },
  { match: ["portarretrato"], tags: "photo,frame" },
  { match: ["bijou"], tags: "colorful,jewelry" },
  { match: ["manualidades"], tags: "craft,supplies" },
  { match: ["taza"], tags: "cute,mug" },
];

const categoryTags: Record<string, string> = {
  cotillon: "colorful,party,supplies",
  snacks: "savory,snacks",
  golosinas: "colorful,candy",
  galletitas: "cookies,biscuits",
  helados: "ice,cream",
  importados: "international,snacks",
  almacen: "grocery,product",
  regalos: "colorful,gift",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function getProductReferenceImage(product: Product) {
  const normalizedName = normalize(product.name);
  const matchedRule = referenceRules.find((rule) =>
    rule.match.some((term) => normalizedName.includes(term)),
  );
  const tags = matchedRule?.tags ?? categoryTags[product.category] ?? "grocery,product";

  return `https://loremflickr.com/640/480/${tags}?lock=${encodeURIComponent(product.id)}`;
}
