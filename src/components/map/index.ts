/**
 * Maps. PowiatMap is a server component (reads data/powiaty.topo.json);
 * import it only from server components. POWIAT_NAMES / powiatKey are
 * client-safe — import them from "~/components/map/powiaty" in client code.
 */
export { PowiatMap } from "./powiat-map";
export { POWIAT_NAMES, powiatKey } from "./powiaty";
