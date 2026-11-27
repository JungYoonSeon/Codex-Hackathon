export const MOODS = ["minimal", "modern", "natural", "cozy", "classic"];
export const PALETTES = ["beige", "white", "wood", "green", "blue", "black"];
const aliases = {
  minimal: ["minimal", "미니멀", "compact"],
  modern: ["modern", "모던"],
  natural: ["natural", "내추럴", "wood", "원목", "oak"],
  cozy: ["cozy", "패브릭", "fabric", "linen"],
  classic: ["classic", "클래식"],
  beige: ["beige", "베이지", "linen"],
  white: ["white", "화이트"],
  wood: ["wood", "원목", "oak"],
  green: ["green", "sage", "초록", "세이지"],
  blue: ["blue", "파랑"],
  black: ["black", "검정"],
};
export function styleRank(products, { mood = "", color = "" } = {}) {
  return products
    .map((product, index) => {
      const words = [product.name, product.description, ...(product.tags ?? [])]
        .join(" ")
        .toLowerCase();
      const matches = [mood, color].filter(
        (v) => v && (aliases[v] ?? [v]).some((term) => words.includes(term)),
      );
      return {
        product,
        score: matches.length,
        index,
        reason: matches.length
          ? `${matches.join(" + ")} matches the listed product details.`
          : "Style/color not confirmed in the listed details.",
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
