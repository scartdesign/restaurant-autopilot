# Restaurant Autopilot

MVP web aplikacija koja pretvara meni, fotografije, brend i ponude restorana u nedeljni marketing sadržaj spreman za pregled, dizajn i objavu.

## Trenutno radi

- Supabase Auth: registracija i prijava
- onboarding restorana: kuhinja, grad/kraj, ciljna publika, ton, stil, boje i ritam objava
- upload logotipa i fotografija u Supabase Storage
- ručni unos menija + bulk CSV import do 500 stavki + CSV šablon
- photo coverage indikator za meni
- nedeljni content plan sa različitim content pillarima umesto ponavljanja istog tipa objave
- feed / story / promotion formati
- odvojeni Instagram i Facebook tekstovi, hashtagovi i search keywords
- Smart Discovery sa lokalnim, niche i brand signalima
- weighted discovery term bank u Supabase-u za rangiranje hashtagova po popularnosti, konkurenciji i nameri
- discovery score i pre-publish quality check
- odobravanje, ručna izmena, regeneracija i ponovno discovery optimizovanje
- Campaign Autopilot sa presetima: lunch, happy hour, vikend, dostava i večera za dvoje
- **Visual Studio** sa Editorial / Bold / Minimal template-ima
- pravi browser-side PNG export u 1080×1350 i 1080×1920
- **Publish Center** sa content queue pregledom
- CSV export cele nedelje
- ICS calendar export za Google / Apple / Outlook
- copy bundle svih odobrenih objava
- status `published` za ručno praćenje objavljenog sadržaja
- javni interaktivni demo bez korisničkih podataka
- responsive desktop/mobile UI
- GitHub CI + automatski build javnog preview-a

## Bitna napomena o hashtagovima

Aplikacija ne predstavlja interne skorove kao dokaz stvarnog live Instagram/Facebook search volumena. Trenutni Discovery Bank je kuriran i ponderisan sloj koji daje prednost relevantnosti, lokalnoj nameri, cuisine/dish fit-u i nižoj konkurenciji. Arhitektura je spremna da kasnije prima periodično osvežene podatke iz dozvoljenog eksternog trend/data izvora.

## Deployment / preview

`preview-app/` se automatski kompajlira kroz GitHub Actions posle izmena na `main` grani.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres, RLS i Storage
- Supabase Edge Functions
- PostgreSQL discovery ranking trigger
- GitHub Actions CI / preview build

## Sledeći ozbiljni slojevi

1. pravi LLM provider za sofisticiraniji copywriting i više jezičkih varijanti
2. Meta OAuth / Graph API za zvanično povezivanje naloga i zakazivanje
3. periodično osvežavanje Discovery Bank-a iz dozvoljenog trend/data izvora
4. billing, planovi i usage limiti
5. analytics loop: rezultate objava vraćati u engine da sistem uči šta konkretno tom restoranu radi

> Riznica je potpuno odvojen projekat i nije deo ovog repozitorijuma niti ovog razvoja.
