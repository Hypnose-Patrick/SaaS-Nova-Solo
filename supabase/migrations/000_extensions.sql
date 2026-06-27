-- Extensions requises (doit s'exécuter AVANT 001_init_schema.sql)
-- gen_random_uuid() provient de pgcrypto.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
