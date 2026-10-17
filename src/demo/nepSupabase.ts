// Nagebootste Supabase-client voor de demomodus (alleen development). Lezen werkt op de
// fictieve tabellen uit gegevens.ts, met eenvoudige filters; schrijven doet niets.
import type { Client } from '../lib/supabase';
import { FUNCTIES, RPC, TABELLEN } from './gegevens';

type Rij = Record<string, unknown>;
type Antwoord = { data: unknown; error: null };

const tekst = (w: unknown) =>
  typeof w === 'string' || typeof w === 'number' || typeof w === 'boolean' ? String(w) : '';

class Query implements PromiseLike<Antwoord> {
  private schrijven = false;
  private rijen: Rij[];

  constructor(rijen: Rij[]) {
    this.rijen = rijen;
  }

  select() {
    return this;
  }

  eq(kolom: string, waarde: unknown) {
    this.rijen = this.rijen.filter((r) => r[kolom] === waarde);
    return this;
  }

  is(kolom: string, waarde: unknown) {
    return this.eq(kolom, waarde);
  }

  in(kolom: string, waarden: unknown[]) {
    this.rijen = this.rijen.filter((r) => waarden.includes(r[kolom]));
    return this;
  }

  order(kolom: string, opties: { ascending?: boolean } = {}) {
    const op = opties.ascending === false ? -1 : 1;
    this.rijen = [...this.rijen].sort(
      (a, b) => op * tekst(a[kolom]).localeCompare(tekst(b[kolom]), 'nl'),
    );
    return this;
  }

  limit(n: number) {
    this.rijen = this.rijen.slice(0, n);
    return this;
  }

  insert() {
    this.schrijven = true;
    return this;
  }

  update() {
    this.schrijven = true;
    return this;
  }

  upsert() {
    this.schrijven = true;
    return this;
  }

  delete() {
    this.schrijven = true;
    return this;
  }

  maybeSingle(): Promise<Antwoord> {
    return Promise.resolve({
      data: this.schrijven ? { id: 'demo' } : (this.rijen[0] ?? null),
      error: null,
    });
  }

  single(): Promise<Antwoord> {
    return this.maybeSingle();
  }

  then<A = Antwoord, B = never>(
    ok?: ((v: Antwoord) => A | PromiseLike<A>) | null,
    fout?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve<Antwoord>({
      data: this.schrijven ? [] : this.rijen,
      error: null,
    }).then(ok, fout);
  }
}

export function maakNepSupabase(): Client {
  const nep = {
    from: (tabel: string) => new Query([...(TABELLEN[tabel] ?? [])]),
    rpc: (naam: string, args: Record<string, unknown> = {}) =>
      Promise.resolve({ data: RPC[naam]?.(args) ?? null, error: null }),
    functions: {
      invoke: (naam: string) => Promise.resolve({ data: FUNCTIES[naam]?.() ?? null, error: null }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
  };
  return nep as unknown as Client;
}
