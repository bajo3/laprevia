export type Category = {
  slug: string;
  label: string;
  emoji: string;
  color: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  emoji: string;
  badge?: "Importado" | "Promo" | "Nuevo";
  image?: string;
  stock?: number;
};

export const categories: Category[] = [
  {
    "slug": "cotillon",
    "label": "Cotillón",
    "emoji": "🎉",
    "color": "var(--color-pink)"
  },
  {
    "slug": "snacks",
    "label": "Snacks",
    "emoji": "🍟",
    "color": "var(--color-orange)"
  },
  {
    "slug": "golosinas",
    "label": "Golosinas",
    "emoji": "🍬",
    "color": "var(--color-violet)"
  },
  {
    "slug": "galletitas",
    "label": "Galletitas",
    "emoji": "🍪",
    "color": "var(--color-orange)"
  },
  {
    "slug": "helados",
    "label": "Helados",
    "emoji": "🍦",
    "color": "var(--color-teal)"
  },
  {
    "slug": "importados",
    "label": "Importados",
    "emoji": "🌐",
    "color": "var(--color-yellow)"
  },
  {
    "slug": "almacen",
    "label": "Almacén",
    "emoji": "🛒",
    "color": "var(--color-teal-dark)"
  },
  {
    "slug": "regalos",
    "label": "Regalos",
    "emoji": "🎁",
    "color": "var(--color-pink-dark)"
  }
];

// Generado automáticamente por scripts/import-excel.mjs a partir del Excel de Codelector — no editar a mano.
export const products: Product[] = [
  {
    "id": "3480057",
    "name": "Antifaz brillante",
    "category": "cotillon",
    "price": 4552,
    "unit": "un",
    "emoji": "🎉",
    "stock": 24
  },
  {
    "id": "3480029",
    "name": "Banderines cumpleaños",
    "category": "cotillon",
    "price": 5881,
    "unit": "un",
    "emoji": "🎉",
    "stock": 20
  },
  {
    "id": "3480001",
    "name": "Bombas de agua x50",
    "category": "cotillon",
    "price": 3925,
    "unit": "un",
    "emoji": "🎉",
    "stock": 35
  },
  {
    "id": "3480072",
    "name": "Confeti x1kg",
    "category": "cotillon",
    "price": 2454,
    "unit": "un",
    "emoji": "🎉",
    "stock": 41
  },
  {
    "id": "3480048",
    "name": "Globos látex x25",
    "category": "cotillon",
    "price": 5244,
    "unit": "un",
    "emoji": "🎉",
    "stock": 58
  },
  {
    "id": "3480027",
    "name": "Globos metalizados x10",
    "category": "cotillon",
    "price": 3124,
    "unit": "un",
    "emoji": "🎉",
    "stock": 36
  },
  {
    "id": "3480077",
    "name": "Gorros de fiesta x10",
    "category": "cotillon",
    "price": 8831,
    "unit": "un",
    "emoji": "🎉",
    "stock": 52
  },
  {
    "id": "3480078",
    "name": "Guirnalda cumpleaños",
    "category": "cotillon",
    "price": 1975,
    "unit": "un",
    "emoji": "🎉",
    "stock": 47
  },
  {
    "id": "3480002",
    "name": "Guirnalda feliz año nuevo",
    "category": "cotillon",
    "price": 4413,
    "unit": "un",
    "emoji": "🎉",
    "stock": 45
  },
  {
    "id": "3480080",
    "name": "Manteles descartables",
    "category": "cotillon",
    "price": 1561,
    "unit": "un",
    "emoji": "🎉",
    "stock": 32
  },
  {
    "id": "3480096",
    "name": "Matracas x6",
    "category": "cotillon",
    "price": 1805,
    "unit": "un",
    "emoji": "🎉",
    "stock": 29
  },
  {
    "id": "3480091",
    "name": "Papel crepé x10",
    "category": "cotillon",
    "price": 6184,
    "unit": "un",
    "emoji": "🎉",
    "stock": 10
  },
  {
    "id": "3480098",
    "name": "Piñata grande",
    "category": "cotillon",
    "price": 4051,
    "unit": "un",
    "emoji": "🎉",
    "stock": 45
  },
  {
    "id": "3480065",
    "name": "Piñata mediana",
    "category": "cotillon",
    "price": 3618,
    "unit": "un",
    "emoji": "🎉",
    "stock": 14
  },
  {
    "id": "3480087",
    "name": "Platos descartables x25",
    "category": "cotillon",
    "price": 3942,
    "unit": "un",
    "emoji": "🎉",
    "stock": 28
  },
  {
    "id": "3480015",
    "name": "Serpentina x10",
    "category": "cotillon",
    "price": 1834,
    "unit": "un",
    "emoji": "🎉",
    "stock": 23
  },
  {
    "id": "3480056",
    "name": "Silbatos de cotillón x10",
    "category": "cotillon",
    "price": 3271,
    "unit": "un",
    "emoji": "🎉",
    "stock": 24
  },
  {
    "id": "3480083",
    "name": "Sombreros de fiesta x6",
    "category": "cotillon",
    "price": 9270,
    "unit": "un",
    "emoji": "🎉",
    "stock": 16
  },
  {
    "id": "3480097",
    "name": "Vasos descartables x25",
    "category": "cotillon",
    "price": 3212,
    "unit": "un",
    "emoji": "🎉",
    "stock": 52
  },
  {
    "id": "3480014",
    "name": "Vela decorativa aromática",
    "category": "cotillon",
    "price": 3927,
    "unit": "un",
    "emoji": "🎉",
    "stock": 41
  },
  {
    "id": "3480059",
    "name": "Velas de cumpleaños x12",
    "category": "cotillon",
    "price": 7206,
    "unit": "un",
    "emoji": "🎉",
    "stock": 57
  },
  {
    "id": "3480006",
    "name": "Velas número gigante",
    "category": "cotillon",
    "price": 4318,
    "unit": "un",
    "emoji": "🎉",
    "stock": 9
  },
  {
    "id": "3480093",
    "name": "Vinchas de fiesta x6",
    "category": "cotillon",
    "price": 4919,
    "unit": "un",
    "emoji": "🎉",
    "stock": 15
  },
  {
    "id": "3480011",
    "name": "Bastoncitos de queso",
    "category": "snacks",
    "price": 2466,
    "unit": "un",
    "emoji": "🍟",
    "stock": 33
  },
  {
    "id": "3480035",
    "name": "Chizitos",
    "category": "snacks",
    "price": 2459,
    "unit": "un",
    "emoji": "🍟",
    "stock": 55
  },
  {
    "id": "3480064",
    "name": "Conitos de queso",
    "category": "snacks",
    "price": 3019,
    "unit": "un",
    "emoji": "🍟",
    "stock": 1
  },
  {
    "id": "3480049",
    "name": "Maní salado x500g",
    "category": "snacks",
    "price": 1763,
    "unit": "un",
    "emoji": "🍟",
    "stock": 22
  },
  {
    "id": "3480047",
    "name": "Nachos con queso",
    "category": "snacks",
    "price": 2426,
    "unit": "un",
    "emoji": "🍟",
    "stock": 56
  },
  {
    "id": "3480005",
    "name": "Palitos salados",
    "category": "snacks",
    "price": 2847,
    "unit": "un",
    "emoji": "🍟",
    "stock": 27
  },
  {
    "id": "3480073",
    "name": "Papas fritas clásicas",
    "category": "snacks",
    "price": 2091,
    "unit": "un",
    "emoji": "🍟",
    "stock": 50
  },
  {
    "id": "3480024",
    "name": "Papas fritas con cheddar",
    "category": "snacks",
    "price": 3093,
    "unit": "un",
    "emoji": "🍟",
    "stock": 33
  },
  {
    "id": "3480058",
    "name": "Papas rústicas",
    "category": "snacks",
    "price": 2423,
    "unit": "un",
    "emoji": "🍟",
    "stock": 4
  },
  {
    "id": "3480020",
    "name": "Pochoclo dulce",
    "category": "snacks",
    "price": 1861,
    "unit": "un",
    "emoji": "🍟",
    "stock": 29
  },
  {
    "id": "3480023",
    "name": "Pochoclo salado",
    "category": "snacks",
    "price": 1748,
    "unit": "un",
    "emoji": "🍟",
    "stock": 14
  },
  {
    "id": "3480051",
    "name": "Rositas de maíz",
    "category": "snacks",
    "price": 2521,
    "unit": "un",
    "emoji": "🍟",
    "stock": 16
  },
  {
    "id": "3480000",
    "name": "Snack coreano picante",
    "category": "snacks",
    "price": 5579,
    "unit": "un",
    "emoji": "🍟",
    "stock": 42
  },
  {
    "id": "3480025",
    "name": "Alfajores triple x6",
    "category": "golosinas",
    "price": 1841,
    "unit": "un",
    "emoji": "🍬",
    "stock": 58
  },
  {
    "id": "3480009",
    "name": "Bombones surtidos",
    "category": "golosinas",
    "price": 2351,
    "unit": "un",
    "emoji": "🍬",
    "stock": 12
  },
  {
    "id": "3480082",
    "name": "Caramelos duros surtidos",
    "category": "golosinas",
    "price": 1908,
    "unit": "un",
    "emoji": "🍬",
    "stock": 53
  },
  {
    "id": "3480042",
    "name": "Caramelos importados ácidos",
    "category": "golosinas",
    "price": 5689,
    "unit": "un",
    "emoji": "🍬",
    "stock": 15
  },
  {
    "id": "3480090",
    "name": "Caramelos masticables",
    "category": "golosinas",
    "price": 2155,
    "unit": "un",
    "emoji": "🍬",
    "stock": 27
  },
  {
    "id": "3480046",
    "name": "Chicles de menta",
    "category": "golosinas",
    "price": 1982,
    "unit": "un",
    "emoji": "🍬",
    "stock": 34
  },
  {
    "id": "3480044",
    "name": "Chicles importados sabores",
    "category": "golosinas",
    "price": 4970,
    "unit": "un",
    "emoji": "🍬",
    "stock": 10
  },
  {
    "id": "3480037",
    "name": "Chocolate suizo",
    "category": "golosinas",
    "price": 5470,
    "unit": "un",
    "emoji": "🍬",
    "stock": 44
  },
  {
    "id": "3480085",
    "name": "Chocolates surtidos",
    "category": "golosinas",
    "price": 3166,
    "unit": "un",
    "emoji": "🍬",
    "stock": 58
  },
  {
    "id": "3480052",
    "name": "Chupetines surtidos x10",
    "category": "golosinas",
    "price": 1693,
    "unit": "un",
    "emoji": "🍬",
    "stock": 13
  },
  {
    "id": "3480062",
    "name": "Galletitas rellenas de chocolate",
    "category": "golosinas",
    "price": 2312,
    "unit": "un",
    "emoji": "🍬",
    "stock": 58
  },
  {
    "id": "3480099",
    "name": "Gomitas ácidas",
    "category": "golosinas",
    "price": 3874,
    "unit": "un",
    "emoji": "🍬",
    "stock": 59
  },
  {
    "id": "3480081",
    "name": "Gomitas de ositos",
    "category": "golosinas",
    "price": 3854,
    "unit": "un",
    "emoji": "🍬",
    "stock": 37
  },
  {
    "id": "3480028",
    "name": "Mentitas",
    "category": "golosinas",
    "price": 2695,
    "unit": "un",
    "emoji": "🍬",
    "stock": 14
  },
  {
    "id": "3480021",
    "name": "Obleas de chocolate",
    "category": "golosinas",
    "price": 3026,
    "unit": "un",
    "emoji": "🍬",
    "stock": 2
  },
  {
    "id": "3480008",
    "name": "Obleas rellenas",
    "category": "golosinas",
    "price": 1755,
    "unit": "un",
    "emoji": "🍬",
    "stock": 27
  },
  {
    "id": "3480060",
    "name": "Toffees",
    "category": "golosinas",
    "price": 3330,
    "unit": "un",
    "emoji": "🍬",
    "stock": 43
  },
  {
    "id": "3480076",
    "name": "Turrón de maní",
    "category": "golosinas",
    "price": 1882,
    "unit": "un",
    "emoji": "🍬",
    "stock": 60
  },
  {
    "id": "3480075",
    "name": "Galletitas de agua",
    "category": "galletitas",
    "price": 2307,
    "unit": "un",
    "emoji": "🍪",
    "stock": 10
  },
  {
    "id": "3480034",
    "name": "Galletitas dulces surtidas",
    "category": "galletitas",
    "price": 2209,
    "unit": "un",
    "emoji": "🍪",
    "stock": 17
  },
  {
    "id": "3480019",
    "name": "Galletitas integrales",
    "category": "galletitas",
    "price": 1991,
    "unit": "un",
    "emoji": "🍪",
    "stock": 34
  },
  {
    "id": "3480018",
    "name": "Galletitas japonesas surtidas",
    "category": "galletitas",
    "price": 5982,
    "unit": "un",
    "emoji": "🍪",
    "stock": 25
  },
  {
    "id": "3480039",
    "name": "Galletitas saladas con salvado",
    "category": "galletitas",
    "price": 2398,
    "unit": "un",
    "emoji": "🍪",
    "stock": 20
  },
  {
    "id": "3480063",
    "name": "Vainillas",
    "category": "galletitas",
    "price": 2543,
    "unit": "un",
    "emoji": "🍪",
    "stock": 33
  },
  {
    "id": "3480038",
    "name": "Helado 1L chocolate",
    "category": "helados",
    "price": 4814,
    "unit": "un",
    "emoji": "🍦",
    "stock": 45
  },
  {
    "id": "3480092",
    "name": "Helado 1L dulce de leche",
    "category": "helados",
    "price": 6193,
    "unit": "un",
    "emoji": "🍦",
    "stock": 25
  },
  {
    "id": "3480045",
    "name": "Helado 1L frutilla",
    "category": "helados",
    "price": 5735,
    "unit": "un",
    "emoji": "🍦",
    "stock": 4
  },
  {
    "id": "3480040",
    "name": "Helado 1L vainilla",
    "category": "helados",
    "price": 5527,
    "unit": "un",
    "emoji": "🍦",
    "stock": 27
  },
  {
    "id": "3480041",
    "name": "Helado balde 2L",
    "category": "helados",
    "price": 3882,
    "unit": "un",
    "emoji": "🍦",
    "stock": 40
  },
  {
    "id": "3480030",
    "name": "Paletas de crema x6",
    "category": "helados",
    "price": 5565,
    "unit": "un",
    "emoji": "🍦",
    "stock": 41
  },
  {
    "id": "3480055",
    "name": "Palitos de agua x8",
    "category": "helados",
    "price": 5884,
    "unit": "un",
    "emoji": "🍦",
    "stock": 29
  },
  {
    "id": "3480007",
    "name": "Sorbete de limón 1L",
    "category": "helados",
    "price": 4281,
    "unit": "un",
    "emoji": "🍦",
    "stock": 11
  },
  {
    "id": "3480003",
    "name": "Té helado importado",
    "category": "helados",
    "price": 5917,
    "unit": "un",
    "emoji": "🍦",
    "stock": 3
  },
  {
    "id": "3480068",
    "name": "Energizante importado",
    "category": "importados",
    "price": 5153,
    "unit": "un",
    "emoji": "🌐",
    "stock": 58
  },
  {
    "id": "3480022",
    "name": "Gaseosa importada sabor uva",
    "category": "importados",
    "price": 6083,
    "unit": "un",
    "emoji": "🌐",
    "stock": 30
  },
  {
    "id": "3480016",
    "name": "Papas importadas onda ranch",
    "category": "importados",
    "price": 5869,
    "unit": "un",
    "emoji": "🌐",
    "stock": 22
  },
  {
    "id": "3480074",
    "name": "Aceite de girasol 900ml",
    "category": "almacen",
    "price": 2591,
    "unit": "un",
    "emoji": "🛒",
    "stock": 50
  },
  {
    "id": "3480004",
    "name": "Arroz largo fino 1kg",
    "category": "almacen",
    "price": 4457,
    "unit": "un",
    "emoji": "🛒",
    "stock": 10
  },
  {
    "id": "3480013",
    "name": "Atún en lata",
    "category": "almacen",
    "price": 822,
    "unit": "un",
    "emoji": "🛒",
    "stock": 50
  },
  {
    "id": "3480010",
    "name": "Cerveza lata 473ml",
    "category": "almacen",
    "price": 4231,
    "unit": "un",
    "emoji": "🛒",
    "stock": 5
  },
  {
    "id": "3480070",
    "name": "Detergente 750ml",
    "category": "almacen",
    "price": 3012,
    "unit": "un",
    "emoji": "🛒",
    "stock": 35
  },
  {
    "id": "3480071",
    "name": "Fideos guiseros 500g",
    "category": "almacen",
    "price": 3333,
    "unit": "un",
    "emoji": "🛒",
    "stock": 39
  },
  {
    "id": "3480067",
    "name": "Gaseosa 2.25L",
    "category": "almacen",
    "price": 4027,
    "unit": "un",
    "emoji": "🛒",
    "stock": 6
  },
  {
    "id": "3480043",
    "name": "Harina 0000 1kg",
    "category": "almacen",
    "price": 3313,
    "unit": "un",
    "emoji": "🛒",
    "stock": 28
  },
  {
    "id": "3480061",
    "name": "Jabón en polvo 800g",
    "category": "almacen",
    "price": 2547,
    "unit": "un",
    "emoji": "🛒",
    "stock": 35
  },
  {
    "id": "3480088",
    "name": "Lavandina 1L",
    "category": "almacen",
    "price": 2850,
    "unit": "un",
    "emoji": "🛒",
    "stock": 36
  },
  {
    "id": "3475227",
    "name": "LECHE",
    "category": "almacen",
    "price": 1300,
    "unit": "un",
    "emoji": "🛒",
    "stock": 10
  },
  {
    "id": "3480053",
    "name": "Leche descremada 1L",
    "category": "almacen",
    "price": 1703,
    "unit": "un",
    "emoji": "🛒",
    "stock": 49
  },
  {
    "id": "3480079",
    "name": "Leche entera 1L",
    "category": "almacen",
    "price": 4128,
    "unit": "un",
    "emoji": "🛒",
    "stock": 4
  },
  {
    "id": "3475831",
    "name": "MERMELADA",
    "category": "almacen",
    "price": 900,
    "unit": "un",
    "emoji": "🛒",
    "stock": 25
  },
  {
    "id": "3480066",
    "name": "Mermelada de durazno",
    "category": "almacen",
    "price": 1898,
    "unit": "un",
    "emoji": "🛒",
    "stock": 47
  },
  {
    "id": "3480017",
    "name": "Mermelada de frutilla",
    "category": "almacen",
    "price": 3666,
    "unit": "un",
    "emoji": "🛒",
    "stock": 30
  },
  {
    "id": "3480026",
    "name": "Puré de tomate 520g",
    "category": "almacen",
    "price": 1521,
    "unit": "un",
    "emoji": "🛒",
    "stock": 44
  },
  {
    "id": "3480095",
    "name": "Sal fina 500g",
    "category": "almacen",
    "price": 1727,
    "unit": "un",
    "emoji": "🛒",
    "stock": 16
  },
  {
    "id": "3480089",
    "name": "Té en saquitos x25",
    "category": "almacen",
    "price": 1908,
    "unit": "un",
    "emoji": "🛒",
    "stock": 53
  },
  {
    "id": "3480032",
    "name": "Vinagre de alcohol 500ml",
    "category": "almacen",
    "price": 978,
    "unit": "un",
    "emoji": "🛒",
    "stock": 19
  },
  {
    "id": "3480069",
    "name": "Agenda 2026",
    "category": "regalos",
    "price": 5648,
    "unit": "un",
    "emoji": "🎁",
    "stock": 29
  },
  {
    "id": "3480012",
    "name": "Cuaderno decorado",
    "category": "regalos",
    "price": 3494,
    "unit": "un",
    "emoji": "🎁",
    "stock": 21
  },
  {
    "id": "3480094",
    "name": "Lapicera con luz",
    "category": "regalos",
    "price": 4172,
    "unit": "un",
    "emoji": "🎁",
    "stock": 35
  },
  {
    "id": "3480031",
    "name": "Llavero temático",
    "category": "regalos",
    "price": 4384,
    "unit": "un",
    "emoji": "🎁",
    "stock": 37
  },
  {
    "id": "3480036",
    "name": "Peluche grande",
    "category": "regalos",
    "price": 2831,
    "unit": "un",
    "emoji": "🎁",
    "stock": 41
  },
  {
    "id": "3480033",
    "name": "Peluche mediano",
    "category": "regalos",
    "price": 3005,
    "unit": "un",
    "emoji": "🎁",
    "stock": 48
  },
  {
    "id": "3480086",
    "name": "Portarretrato",
    "category": "regalos",
    "price": 5336,
    "unit": "un",
    "emoji": "🎁",
    "stock": 47
  },
  {
    "id": "3480054",
    "name": "Set de bijou",
    "category": "regalos",
    "price": 6690,
    "unit": "un",
    "emoji": "🎁",
    "stock": 22
  },
  {
    "id": "3480050",
    "name": "Set de manualidades",
    "category": "regalos",
    "price": 1848,
    "unit": "un",
    "emoji": "🎁",
    "stock": 40
  },
  {
    "id": "3480084",
    "name": "Taza sorpresa temática",
    "category": "regalos",
    "price": 7392,
    "unit": "un",
    "emoji": "🎁",
    "stock": 45
  }
];
