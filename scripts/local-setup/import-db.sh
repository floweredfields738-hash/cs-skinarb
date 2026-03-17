#!/bin/bash
# Usage: ./import-db.sh [DATABASE_URL]
# If no DATABASE_URL provided, uses the one from .env file

if [ -z "$1" ]; then
  if [ -f .env ]; then
    source .env
    DB_URL=$DATABASE_URL
  else
    echo "Usage: ./import-db.sh postgresql://user:pass@host:port/dbname"
    exit 1
  fi
else
  DB_URL=$1
fi

echo "Importing database..."

# First run the schema
psql "$DB_URL" < database/schema.sql 2>/dev/null

# Then import the data dump
psql "$DB_URL" < scripts/local-setup/db-dump.sql

echo "Database imported successfully!"
