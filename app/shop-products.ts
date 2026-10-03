export const SHOP_PRODUCTS = [
  {
    id: "switch_drop_coins_2500",
    title: "+2,500",
    label: "COINS",
    price: "$0.99",
    image: "/shop-coins.png?v=1",
    tone: "gold",
  },
  {
    id: "switch_drop_lives_10",
    title: "+10",
    label: "LIVES",
    price: "$0.99",
    image: "/shop-life.png?v=1",
    tone: "cyan",
  },
] as const;

export type ShopProductId = (typeof SHOP_PRODUCTS)[number]["id"];

/**
 * Stable purchase seam for the native Google Play/Apphud bridge.
 * Both providers use the same product id from their dashboards.
 */
export function requestShopPurchase(productId: ShopProductId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("switch-drop-purchase-request", {
      detail: {
        productId,
        googlePlayProductId: productId,
        apphudProductId: productId,
      },
    }),
  );
}
