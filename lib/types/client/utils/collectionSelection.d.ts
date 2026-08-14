export declare const filterExistingValues: <T>(selectedValues: T[], availableValues: Iterable<T>) => T[];
export declare const filterItemsById: <T extends {
    id: string;
}>(items: T[], selectedIds: Iterable<string>) => T[];
export declare const filterSelectedItems: <T extends {
    id: string;
}>(items: T[], selectedIds: Iterable<string>, predicate: (item: T) => unknown) => T[];
