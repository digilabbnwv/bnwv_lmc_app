import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import type { Rechten } from '../auth/rechten';
import { Pictogram } from '../components/ui/Pictogram';
import { documentTitel, paginaTitel, zichtbareGroepen } from './navigatie';

interface Props {
  rechten: Rechten;
  /** E-mailadres van de ingelogde gebruiker, ter herkenning. */
  email: string | null;
  uitloggen: () => void;
  /** Vaste paginatitel; standaard afgeleid van het pad. */
  titel?: string;
  children: ReactNode;
}

/**
 * Indeling na inloggen: hoofdmenu in groepen (links; op tablet inklapbaar boven de inhoud)
 * en de inhoud in <main>. Zet document.title per pagina. Na een keuze in het menu gaat de
 * focus naar de inhoud, zodat toetsenbord- en schermlezergebruikers niet opnieuw door het
 * menu hoeven.
 */
export function Indeling({ rechten, email, uitloggen, titel: vasteTitel, children }: Props) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const inhoud = useRef<HTMLElement>(null);
  const knop = useRef<HTMLButtonElement>(null);
  const viaMenu = useRef(false);
  const menuId = useId();
  const titel = vasteTitel ?? paginaTitel(pathname, rechten);

  useEffect(() => {
    document.title = documentTitel(titel);
  }, [titel]);

  useEffect(() => {
    if (viaMenu.current) {
      viaMenu.current = false;
      inhoud.current?.focus();
    }
  }, [pathname]);

  return (
    <div className="indeling">
      <nav
        aria-label="Hoofdmenu"
        className={open ? 'navigatie open' : 'navigatie'}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            setOpen(false);
            knop.current?.focus();
          }
        }}
      >
        <button
          ref={knop}
          type="button"
          className="secundair navigatie-knop"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          <Pictogram naam={open ? 'sluiten' : 'menu'} />
          Menu
        </button>
        <div id={menuId} className="navigatie-menu">
          {zichtbareGroepen(rechten).map((groep) => (
            <NavGroep key={groep.titel} titel={groep.titel}>
              {groep.items.map((item) => (
                <li key={item.pad}>
                  <NavLink
                    to={item.pad}
                    onClick={() => {
                      viaMenu.current = true;
                      setOpen(false);
                    }}
                  >
                    {item.titel}
                  </NavLink>
                </li>
              ))}
            </NavGroep>
          ))}
          {email ? <p className="navigatie-gebruiker">Ingelogd als {email}</p> : null}
          <button type="button" className="navigatie-uitloggen" onClick={uitloggen}>
            Uitloggen
          </button>
        </div>
      </nav>
      <main id="inhoud" ref={inhoud} tabIndex={-1} className="app-inhoud">
        {children}
      </main>
    </div>
  );
}

function NavGroep({ titel, children }: { titel: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="navigatie-groep">
      <p id={id} className="navigatie-groep-titel">
        {titel}
      </p>
      <ul aria-labelledby={id}>{children}</ul>
    </div>
  );
}
