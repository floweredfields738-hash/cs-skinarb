# Running Without Docker

## Option A: Local PostgreSQL + Redis

1. Install PostgreSQL 15 and Redis 7 on your machine
2. Create the database:
   ```
   createdb cs_skin_platform
   psql cs_skin_platform < database/schema.sql
   ```
3. Copy env file:
   ```
   cp scripts/local-setup/.env.local.example backend/.env
   ```
4. Export data from Docker (if you have existing data):
   ```
   bash scripts/local-setup/export-db.sh
   bash scripts/local-setup/import-db.sh
   ```
5. Start:
   ```
   # Windows:
   scripts\local-setup\start.bat

   # Mac/Linux:
   bash scripts/local-setup/start.sh
   ```

## Option B: Cloud Database (Railway/Supabase) — Recommended

1. Sign up at https://railway.app
2. Create a new project with PostgreSQL and Redis
3. Copy the connection strings
4. Copy env file and fill in cloud credentials:
   ```
   cp scripts/local-setup/.env.cloud.example backend/.env
   ```
5. Import schema and data:
   ```
   bash scripts/local-setup/export-db.sh
   bash scripts/local-setup/import-db.sh postgresql://your-cloud-url
   ```
6. Start:
   ```
   # Windows:
   scripts\local-setup\start.bat

   # Mac/Linux:
   bash scripts/local-setup/start.sh
   ```

## Notes
- The backend reads .env from its own directory (backend/.env)
- The frontend gets VITE_API_URL from the start script
- All market data, skins, and prices will be preserved after migration
