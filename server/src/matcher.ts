import type { FurnitureRequest, RecommendationsResponse, RoomInput } from '../../shared/contracts.ts';
import { catalog, type CatalogItem } from './catalog.ts';
import { AppError } from './errors.ts';
const aliases: Record<string, string> = { couch: 'sofa', couches: 'sofa', sofas: 'sofa', chairs: 'chair',
  wooden: 'wood', minimalist: 'minimal', small: 'compact', cream: 'beige', navy: 'blue', grey: 'gray' };
const vocabulary = new Set(catalog.flatMap(item => item.tags));
export function fitsDimensions(item: CatalogItem, room: RoomInput): boolean {
  return ((item.widthCm <= room.widthCm && item.depthCm <= room.lengthCm) ||
    (item.depthCm <= room.widthCm && item.widthCm <= room.lengthCm)) &&
    (room.heightCm === undefined || item.heightCm === undefined || item.heightCm <= room.heightCm);
}
export function recommend(room: RoomInput, request: FurnitureRequest, items = catalog): RecommendationsResponse {
  const words = request.description.toLowerCase().match(/[a-z]+/g) ?? [];
  const tokens = words.map(w => aliases[w] ?? w);
  // Intentionally narrow positive request patterns, not full language understanding.
  // Negations such as "not a sofa" or comparisons such as "chair beside my sofa" must not trigger.
  const other = request.category === 'chair' ? 'sofa' : 'chair';
  const hasNegation = tokens.some(t => ['not', 'no', 'without', 'avoid'].includes(t));
  const primary = tokens.findIndex(t => t === 'chair' || t === 'sofa');
  const before = primary < 0 ? [] : tokens.slice(0, primary);
  const positiveLead = before.every(t => ['a', 'an', 'the', 'please', 'want', 'i', 'add', 'need', 'new', ...vocabulary].includes(t));
  if (!hasNegation && primary >= 0 && tokens[primary] === other && !tokens.includes(request.category) && positiveLead)
    throw new AppError(400, 'CATEGORY_CONFLICT', `Your description asks for a ${other}, but ${request.category} is selected. Change the category or description.`);
  // Avoid treating negated preferences as positive matches; fall back honestly.
  const tags = hasNegation ? [] : [...new Set(tokens.filter(t => vocabulary.has(t)))];
  const ranked = items.map((item, order) => ({ item, order, matched: tags.filter(t => item.tags.includes(t)) }))
    .filter(({ item }) => item.category === request.category && fitsDimensions(item, room))
    .sort((a, b) => b.matched.length - a.matched.length || a.order - b.order);
  const seen = new Set<string>();
  const candidates = ranked.filter(({ item }) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; }).slice(0, 2)
    .map(({ item, matched }) => {
      const { referencePath: _path, provenance: _source, ...publicItem } = item;
      return { ...publicItem, tags: [...item.tags], matchReason: matched.length
        ? `Matched on category and dimensions; recognized preferences: ${matched.join(', ')}.` : 'Matched on category and dimensions.' };
    });
  return { candidates, notice: candidates.length === 0
    ? 'No demo furniture matches this category and these dimensions. Check your measurements or change category.'
    : 'Demo furniture. Dimensions only reject obviously oversized items; existing furniture, doorways and exact fit are not checked.' };
}
