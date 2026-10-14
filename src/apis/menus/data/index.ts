/**
 * The regional menus dataset: one JSON file per region.
 * To add a region, create `<slug>.json` next to this file and import it below.
 * `pnpm test` validates every file against the schema.
 */
import goa from "./goa.json";
import gujarat from "./gujarat.json";
import hyderabad from "./hyderabad.json";
import italy from "./italy.json";
import japan from "./japan.json";
import karnataka from "./karnataka.json";
import kashmir from "./kashmir.json";
import kerala from "./kerala.json";
import lebanon from "./lebanon.json";
import maharashtra from "./maharashtra.json";
import mexico from "./mexico.json";
import punjab from "./punjab.json";
import rajasthan from "./rajasthan.json";
import tamilNadu from "./tamil-nadu.json";
import thailand from "./thailand.json";
import westBengal from "./west-bengal.json";

export const regionFiles: unknown[] = [
  goa,
  gujarat,
  hyderabad,
  italy,
  japan,
  karnataka,
  kashmir,
  kerala,
  lebanon,
  maharashtra,
  mexico,
  punjab,
  rajasthan,
  tamilNadu,
  thailand,
  westBengal,
];
