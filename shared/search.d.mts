type Searchable = { title: string; category: string; summary: string; keywords: string };
export declare function searchScored<T extends Searchable>(corpus: readonly T[], query: string, limit?: number, fallback?: readonly T[]): { item: T; score: number }[];
export declare function searchCorpus<T extends Searchable>(corpus: readonly T[], query: string, limit?: number, fallback?: readonly T[]): T[];
