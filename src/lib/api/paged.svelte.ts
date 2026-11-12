// Lista paginada de obras con «ver más». Un `reset` invalida las peticiones anteriores.
import type { WorkCard } from '$lib/types';
import { PAGE_SIZE } from './public';

export type PagedStatus = 'idle' | 'loading' | 'ready' | 'error';
export type WorkFetcher = (limit: number, offset: number) => Promise<WorkCard[]>;

export class PagedWorks {
  items = $state<WorkCard[]>([]);
  status = $state<PagedStatus>('idle');
  more = $state(false);
  loadingMore = $state(false);
  moreError = $state(false);

  #fetcher: WorkFetcher | null = null;
  #gen = 0;

  async reset(fetcher: WorkFetcher) {
    const gen = ++this.#gen;
    this.#fetcher = fetcher;
    this.items = [];
    this.more = false;
    this.loadingMore = false;
    this.moreError = false;
    this.status = 'loading';
    try {
      const rows = await fetcher(PAGE_SIZE, 0);
      if (gen !== this.#gen) return;
      this.items = rows;
      this.more = rows.length >= PAGE_SIZE;
      this.status = 'ready';
    } catch {
      if (gen !== this.#gen) return;
      this.status = 'error';
    }
  }

  async next() {
    const fetcher = this.#fetcher;
    if (!fetcher || this.loadingMore || !this.more) return;
    const gen = this.#gen;
    this.loadingMore = true;
    this.moreError = false;
    try {
      const rows = await fetcher(PAGE_SIZE, this.items.length);
      if (gen !== this.#gen) return;
      const seen = new Set(this.items.map((w) => w.id));
      this.items = [...this.items, ...rows.filter((w) => !seen.has(w.id))];
      this.more = rows.length >= PAGE_SIZE;
    } catch {
      if (gen === this.#gen) this.moreError = true;
    } finally {
      if (gen === this.#gen) this.loadingMore = false;
    }
  }
}
