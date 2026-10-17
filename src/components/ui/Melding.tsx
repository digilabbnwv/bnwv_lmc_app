import type { ReactNode } from 'react';
import { Pictogram, type PictogramNaam } from './Pictogram';

export type MeldingSoort = 'info' | 'let-op' | 'fout' | 'gelukt';

const PICTOGRAM: Record<MeldingSoort, PictogramNaam> = {
  info: 'info',
  'let-op': 'let-op',
  fout: 'fout',
  gelukt: 'gelukt',
};

/** Voorvoegsel voor schermlezers; de soort blijkt dus niet alleen uit vorm of kleur. */
const VOORVOEGSEL: Record<MeldingSoort, string> = {
  info: 'Informatie: ',
  'let-op': 'Let op: ',
  fout: 'Fout: ',
  gelukt: 'Gelukt: ',
};

interface Props {
  soort?: MeldingSoort;
  titel?: string;
  children: ReactNode;
}

/**
 * Een blijvende melding in de pagina. Een fout wordt direct voorgelezen (role="alert"),
 * de rest beleefd (role="status").
 */
export function Melding({ soort = 'info', titel, children }: Props) {
  return (
    <div
      className={`meldingblok meldingblok-${soort}`}
      role={soort === 'fout' ? 'alert' : 'status'}
    >
      <Pictogram naam={PICTOGRAM[soort]} />
      <div className="meldingblok-tekst">
        <span className="verborgen">{VOORVOEGSEL[soort]}</span>
        {titel ? <strong className="meldingblok-titel">{titel}</strong> : null}
        {children}
      </div>
    </div>
  );
}
