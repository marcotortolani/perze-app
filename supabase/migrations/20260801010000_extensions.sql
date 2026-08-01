-- Los IDs de entidades raíz se generan en el cliente (UUID v7) para
-- idempotencia offline — el servidor no necesita generar UUIDs para esas
-- filas. pgcrypto se habilita igual porque algunas filas server-side
-- (auditoría, catálogos sembrados) sí generan su propio id acá.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
