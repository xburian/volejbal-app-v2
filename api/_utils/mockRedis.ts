import fs from 'node:fs';

export interface RedisOptions {
  ex?: number;
}

export class MockRedis {
  private data = new Map<string, any>();
  private sets = new Map<string, Set<string>>();
  private ttls = new Map<string, number>();
  private persistPath: string | null = null;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(options?: { persistPath?: string }) {
    if (options?.persistPath) {
      this.persistPath = options.persistPath;
      this.loadFromFile();
    }
  }

  private scheduleSave() {
    if (!this.persistPath) return;
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveToFile();
    }, 200);
  }

  public saveToFile() {
    if (!this.persistPath) return;
    try {
      const dump = this.dump();
      fs.writeFileSync(this.persistPath, JSON.stringify(dump, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to save mock Redis to file:', err);
    }
  }

  public loadFromFile(): boolean {
    if (!this.persistPath) return false;
    try {
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, 'utf-8');
        const dump = JSON.parse(raw);
        this.restore(dump);
        return true;
      }
    } catch (err) {
      console.warn('Failed to load mock Redis from file:', err);
    }
    return false;
  }

  public dump() {
    const dataObj: Record<string, any> = {};
    for (const [k, v] of this.data.entries()) {
      dataObj[k] = v;
    }
    const setsObj: Record<string, string[]> = {};
    for (const [k, v] of this.sets.entries()) {
      setsObj[k] = Array.from(v);
    }
    return { data: dataObj, sets: setsObj };
  }

  public restore(dump: { data: Record<string, any>; sets: Record<string, string[]> }) {
    this.data.clear();
    this.sets.clear();
    this.ttls.clear();
    if (dump.data) {
      for (const [k, v] of Object.entries(dump.data)) {
        this.data.set(k, v);
      }
    }
    if (dump.sets) {
      for (const [k, v] of Object.entries(dump.sets)) {
        this.sets.set(k, new Set(v));
      }
    }
  }

  public clear() {
    this.data.clear();
    this.sets.clear();
    this.ttls.clear();
    this.scheduleSave();
  }

  // --- Redis Commands ---

  async get<T = any>(key: string): Promise<T | null> {
    const val = this.data.get(key);
    return (val as T) ?? null;
  }

  async set(key: string, value: any, options?: RedisOptions): Promise<string> {
    this.data.set(key, value);
    if (options?.ex) {
      this.ttls.set(key, Date.now() + options.ex * 1000);
    }
    this.scheduleSave();
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.data.delete(k)) count++;
      if (this.sets.delete(k)) count++;
      this.ttls.delete(k);
    }
    if (count > 0) this.scheduleSave();
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = Number(this.data.get(key)) || 0;
    const next = current + 1;
    this.data.set(key, next);
    this.scheduleSave();
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const exp = this.ttls.get(key);
    if (!exp) return -1;
    const remaining = Math.round((exp - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async sadd(key: string, ...members: (string | number)[]): Promise<number> {
    let s = this.sets.get(key);
    if (!s) {
      s = new Set<string>();
      this.sets.set(key, s);
    }
    let added = 0;
    for (const m of members) {
      const str = String(m);
      if (!s.has(str)) {
        s.add(str);
        added++;
      }
    }
    if (added > 0) this.scheduleSave();
    return added;
  }

  async srem(key: string, ...members: (string | number)[]): Promise<number> {
    const s = this.sets.get(key);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) {
      const str = String(m);
      if (s.delete(str)) {
        removed++;
      }
    }
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const s = this.sets.get(key);
    return s ? Array.from(s) : [];
  }

  async sismember(key: string, member: string | number): Promise<number> {
    const s = this.sets.get(key);
    return s && s.has(String(member)) ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      get: <T = any>(key: string) => {
        operations.push(() => this.get<T>(key));
        return pipe;
      },
      set: (key: string, val: any, options?: RedisOptions) => {
        operations.push(() => this.set(key, val, options));
        return pipe;
      },
      del: (...keys: string[]) => {
        operations.push(() => this.del(...keys));
        return pipe;
      },
      sadd: (key: string, ...members: (string | number)[]) => {
        operations.push(() => this.sadd(key, ...members));
        return pipe;
      },
      srem: (key: string, ...members: (string | number)[]) => {
        operations.push(() => this.srem(key, ...members));
        return pipe;
      },
      scard: (key: string) => {
        operations.push(() => this.scard(key));
        return pipe;
      },
      smembers: (key: string) => {
        operations.push(() => this.smembers(key));
        return pipe;
      },
      incr: (key: string) => {
        operations.push(() => this.incr(key));
        return pipe;
      },
      exec: async () => {
        const results = [];
        for (const op of operations) {
          results.push(await op());
        }
        return results;
      },
    };
    return pipe;
  }
}
