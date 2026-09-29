-- Runs once, the first time the Postgres volume is created.
-- Tests use their own database so `npm test` never wipes your local app data.
CREATE DATABASE taskops_test;
