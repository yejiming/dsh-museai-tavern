export const filterExistingValues = <T>(selectedValues: T[], availableValues: Iterable<T>): T[] => {
  const availableValueSet = new Set(availableValues);
  return selectedValues.filter((value) => availableValueSet.has(value));
};

export const filterItemsById = <T extends { id: string }>(items: T[], selectedIds: Iterable<string>): T[] => {
  const selectedIdSet = new Set(selectedIds);
  return items.filter((item) => selectedIdSet.has(item.id));
};

export const filterSelectedItems = <T extends { id: string }>(
  items: T[],
  selectedIds: Iterable<string>,
  predicate: (item: T) => unknown,
): T[] => {
  const selectedIdSet = new Set(selectedIds);
  return items.filter((item) => selectedIdSet.has(item.id) && predicate(item));
};
