-- Create Keycloak schema (used by Keycloak KC_DB_SCHEMA)
CREATE SCHEMA IF NOT EXISTS keycloak;

-- Enable PostGIS extension for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE safecity_db TO safecity_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO safecity_user;
GRANT ALL PRIVILEGES ON SCHEMA keycloak TO safecity_user;
