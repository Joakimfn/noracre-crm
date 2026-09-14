export const moduleCatalog = [
  { key: "ringelister", name: "Ringelister", priceKey: "ringPrice" },
  { key: "markedsforing", name: "Markedsføring", priceKey: "marketingPrice" },
] as const;
export type ModuleKey = typeof moduleCatalog[number]["key"];
