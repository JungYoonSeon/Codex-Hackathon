import type { DiscoveryProduct } from "../../../shared/discovery.ts";
import { discoveryDemoProducts } from "../../../shared/discovery.ts";
import { loadVerifiedRecords } from "../discovery/verifiedRecords.ts";

export function createProductRegistry() {
  const records = new Map<string, { product: DiscoveryProduct; at: number }>();
  const remember = (products: DiscoveryProduct[]) => {
    for (const product of products) {
      records.delete(product.id);
      records.set(product.id, { product, at: Date.now() });
    }
    while (records.size > 2000) records.delete(records.keys().next().value!);
  };
  remember([...discoveryDemoProducts, ...loadVerifiedRecords()]);
  return {
    remember,
    get(id: string) {
      const entry = records.get(id);
      return entry && Date.now() - entry.at < 6 * 3600000
        ? entry.product
        : undefined;
    },
  };
}
