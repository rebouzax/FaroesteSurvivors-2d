export function menuPageSize(height) {
  if (height < 465) return 1;
  if (height < 650) return 2;
  if (height < 835) return 3;
  return 4;
}

export function showSingleOffer(width, height) {
  return height <= 300 || (width < 491 && height <= 490);
}

export function bestiaryPageSize(width, height) {
  if (width <= 540) return height < 530 ? 2 : 4;
  if (height <= 380 && width < 690) return 3;
  return 4;
}

export function menuPage(items, offset, size) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const index = Math.min(pages - 1, Math.max(0, Math.floor(offset / size)));
  return { items: items.slice(index * size, (index + 1) * size), index, pages };
}
