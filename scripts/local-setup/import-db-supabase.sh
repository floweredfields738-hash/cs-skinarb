#!/bin/bash
# Import database into Supabase
# Usage: ./import-db-supabase.sh <SUPABASE_DATABASE_URL>
# Example: ./import-db-supabase.sh "postgresql://postgres:MyPassword@db.abcdefgh.supabase.co:5432/postgres"

if [ -z "$1" ]; then
  echo "Usage: ./import-db-supabase.sh <SUPABASE_DATABASE_URL>"
  echo ""
  echo "Get your DATABASE_URL from:"
  echo "  Supabase Dashboard → Project Settings → Database → Connection string → URI"
  echo ""
  echo "Example:"
  echo "  ./import-db-supabase.sh \"postgresql://postgres:MyPassword@db.abcdefgh.supabase.co:5432/postgres\""
  exit 1
fi

DB_URL="$1?sslmode=require"

echo "================================================"
echo "  Importing to Supabase"
echo "================================================"
echo ""

# Step 1: Run schema
echo "[1/3] Creating tables..."
psql "$DB_URL" < database/schema.sql 2>&1 | grep -c "CREATE\|ALTER" | xargs -I{} echo "  {} statements executed"

# Step 2: Check if dump exists
if [ ! -f scripts/local-setup/db-dump.sql ]; then
  echo ""
  echo "[2/3] No data dump found. Exporting from Docker first..."
  bash scripts/local-setup/export-db.sh
fi

# Step 3: Import data
echo ""
echo "[3/3] Importing data..."
psql "$DB_URL" < scripts/local-setup/db-dump.sql 2>&1 | tail -5

echo ""
echo "================================================"
echo "  Import complete!"
echo "  Your Supabase database is ready."
echo ""
echo "  Next steps:"
echo "  1. Copy .env.supabase.example to backend/.env"
echo "  2. Fill in your Supabase credentials"
echo "  3. Run: scripts/local-setup/start.bat"
echo "================================================"
