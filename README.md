# Restaurant Autopilot

MVP web aplikacija za automatizaciju marketing sadržaja za restorane.

## Trenutno radi

- registracija i prijava preko Supabase Auth
- onboarding restorana: kuhinja, stil, ton, boje i ritam objava
- meni/proizvodi sa cenama, opisom, aktivno/pauzirano statusom i fotografijama
- Storage upload fotografija sa tenant izolacijom
- nedeljni content plan preko Supabase `content-engine` Edge Function-a
- feed / story / promotion predlozi
- odobravanje, ručna izmena i regeneracija teksta objave
- generator posebne akcije koji pravi feed + story
- podešavanja brenda i komunikacije
- no-login demo ekran
- responsive desktop/mobile UI

## Live preview

Javni demo bez korisničkih podataka:

`https://pkbsveezmjkvfuiplrqb.supabase.co/functions/v1/preview`

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres, Row Level Security i Storage
- Supabase Edge Functions
- GitHub Actions CI

## Sledeći koraci

1. uključiti pravi LLM provider iza `content-engine` funkcije
2. vizuelni template renderer za feed/story export
3. povezivanje Meta naloga i zakazivanje objava
4. naplata i paketi

> Riznica je potpuno odvojen projekat i nije deo ovog repozitorijuma niti ovog razvoja.
