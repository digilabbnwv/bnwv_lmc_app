# LMC-capaciteit — Bibliotheek Noordwest Veluwe

Webapplicatie voor team Programmering: capaciteitsplanning en werkverdeling voor leesmediacoaches.

> Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.

- Specificatie: [docs/SPEC.md](docs/SPEC.md)
- Ontwerpkeuzes: [docs/DECISIONS.md](docs/DECISIONS.md)
- Handmatige installatiestappen: [docs/SETUP.md](docs/SETUP.md)
- Werkregels voor ontwikkeling: [CLAUDE.md](CLAUDE.md)

Deze repository is publiek en bevat uitsluitend synthetische testdata.

## Snel starten

```bash
npm ci
supabase start
npm run dev
```

## Controles

```bash
npm run lint && npm run typecheck && npm test
supabase test db
cd supabase/functions && deno task check
```
