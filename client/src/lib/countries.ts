// ISO 3166-1 alpha-2 country codes used across the checkout / registration UI.
// Keep Deutschland (DE) as the first entry so it is the default selection.
export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = [
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "LU", name: "Luxemburg" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tschechien" },
  { code: "DK", name: "Dänemark" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "IE", name: "Irland" },
];

export const DEFAULT_COUNTRY_CODE = "DE";

export const getCountryName = (code: string): string =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code;
