import type { ButtonHTMLAttributes } from 'react';
import { Pictogram, type PictogramNaam } from './Pictogram';

export type KnopVariant = 'primair' | 'secundair' | 'stil';

interface KnopProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KnopVariant;
  /** Tijdens opslaan: knop uit, met een laadindicator en aria-busy. */
  bezig?: boolean;
}

export function Knop({
  variant = 'primair',
  bezig = false,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: KnopProps) {
  const klassen = [variant === 'primair' ? '' : variant, className ?? ''].filter(Boolean).join(' ');
  return (
    <button
      {...rest}
      type={type}
      className={klassen || undefined}
      disabled={disabled === true || bezig}
      aria-busy={bezig || undefined}
    >
      <span className="knop-inhoud">
        {bezig ? <span className="laden-draai" aria-hidden="true" /> : null}
        {children}
      </span>
    </button>
  );
}

interface PictogramKnopProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  pictogram: PictogramNaam;
  /** Verplicht: de toegankelijke naam, want er staat geen tekst op de knop. */
  label: string;
}

/** Knop met alleen een pictogram (minstens 44×44 px). */
export function PictogramKnop({ pictogram, label, className, ...rest }: PictogramKnopProps) {
  return (
    <button
      type="button"
      {...rest}
      className={['stil knop-pictogram', className ?? ''].join(' ').trim()}
      aria-label={label}
      title={label}
    >
      <Pictogram naam={pictogram} />
    </button>
  );
}
