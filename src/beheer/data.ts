import { useQuery } from '@tanstack/react-query';
import { Constants, type Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import type { Optie } from './types';

type Enums = Database['public']['Enums'];
export type Vestiging = Enums['vestiging'];
export type Schooltype = Enums['schooltype'];
export type Categorie = Enums['boeking_categorie'];
export type Bron = Enums['uren_bron'];
export type Verdeling = Enums['verdeling'];
export type AliasBron = Enums['alias_bron'];
export type WerkpakketSoort = Enums['werkpakket_soort'];

export const VESTIGINGEN = Constants.public.Enums.vestiging;
export const SCHOOLTYPEN = Constants.public.Enums.schooltype;
export const CATEGORIEEN = Constants.public.Enums.boeking_categorie;
export const BRONNEN = Constants.public.Enums.uren_bron;
export const VERDELINGEN = Constants.public.Enums.verdeling;
export const ALIASBRONNEN = Constants.public.Enums.alias_bron;

export const CATEGORIENAAM: Record<Categorie, string> = {
  uitvoering: 'Uitvoering',
  voorbereiding_afronding: 'Voorbereiding en afronding',
  relatiebeheer: 'Relatiebeheer',
};
export const BRONNAAM: Record<Bron, string> = {
  staffel: 'Staffel',
  norm_x_aantal: 'Normuren × aantal keer',
  handmatig: 'Handmatig',
};
export const VERDELINGNAAM: Record<Verdeling, string> = {
  schoolweken: 'Over de schoolweken',
  looptijd: 'Over een looptijd',
  op_datum: 'Op vaste datums',
};

export const opties = <T extends string>(lijst: readonly T[], naam?: Record<T, string>): Optie[] =>
  lijst.map((w) => ({ waarde: w, label: naam ? naam[w] : w }));

interface Antwoord<T> {
  data: T | null;
  error: unknown;
}

/** Maakt van een databasefout een Error, met de velden (code, message) van de fout erbij. */
export function alsFout(fout: unknown): Error {
  if (fout instanceof Error) return fout;
  const tekst = (fout as { message?: unknown } | null)?.message;
  return Object.assign(new Error(typeof tekst === 'string' ? tekst : 'Databasefout'), fout);
}

/** Wacht op een Supabase-query en gooit de fout, zodat TanStack Query hem toont. */
export async function ophalen<T>(query: PromiseLike<Antwoord<T>>): Promise<T> {
  const { data, error } = await query;
  if (error) throw alsFout(error);
  if (data === null) throw new Error('Geen gegevens ontvangen.');
  return data;
}

export async function uitvoeren(query: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await query;
  if (error) throw alsFout(error);
}

export type Schooljaar = Database['public']['Tables']['schooljaar']['Row'];

export function useSchooljaren() {
  return useQuery({
    queryKey: ['schooljaar'],
    queryFn: () => ophalen(supabase().from('schooljaar').select('*').order('startdatum')),
  });
}

/** Het schooljaar waarin vandaag valt, of anders het laatste. */
export function huidigSchooljaar(lijst: Schooljaar[] | undefined): Schooljaar | undefined {
  if (!lijst || lijst.length === 0) return undefined;
  const vandaag = new Date().toISOString().slice(0, 10);
  return (
    lijst.find((s) => s.startdatum <= vandaag && vandaag <= s.einddatum) ?? lijst[lijst.length - 1]
  );
}

export interface MedewerkerKort {
  id: string;
  voornaam: string;
  achternaam: string;
  actief: boolean;
}

export function useMedewerkers() {
  return useQuery({
    queryKey: ['medewerker'],
    queryFn: () =>
      ophalen(
        supabase()
          .from('medewerker')
          .select('id, voornaam, achternaam, email, actief')
          .order('achternaam'),
      ),
  });
}

export const naamVan = (m: { voornaam: string; achternaam: string }) =>
  `${m.voornaam} ${m.achternaam}`;

export function useWerkpakketten() {
  return useQuery({
    queryKey: ['werkpakket'],
    queryFn: () =>
      ophalen(
        supabase()
          .from('werkpakket')
          .select('id, soort, naam, vestiging, actief, activiteittype_id')
          .order('naam'),
      ),
  });
}
