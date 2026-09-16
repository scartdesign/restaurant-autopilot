
create index if not exists discovery_engine_settings_updated_by_idx
  on private.discovery_engine_settings(updated_by)
  where updated_by is not null;
