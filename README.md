# Makerble Onboarding App

React + Vite + Supabase + Vercel

## Setup steps (in order)

### 1. Supabase
- Create a new project at supabase.com
- Go to SQL Editor and run the entire contents of `supabase-schema.sql`
- Go to Storage, create a bucket called `assets`, set it to Public
- Note your project URL and anon key from Settings > API

### 2. Environment variables
```
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 3. Place icon assets in public/icons/
- shield.png, full_logo.png
- icon_signup.png, icon_assess.png, icon_assign.png, icon_inform.png
- icon_provide.png, icon_reassess.png, icon_complete.png

### 4. Local dev
```
npm install && npm run dev
```

### 5. First user (superuser)
1. Sign up at /login with matt@makerble.com
2. In Supabase SQL Editor run:
   `update profiles set role = 'superuser' where email = 'matt@makerble.com';`
3. Sign in — Super User badge, can create orgs and programmes

### 6. Deploy to Vercel
Connect the GitHub repo in Vercel dashboard, set the two env vars.
vercel.json handles SPA routing automatically.

## Database tables
- profiles — display name, role, avatar (extends auth.users)
- organisations — client orgs
- org_members — user<>org with manager/member role
- programmes — journey stored as JSONB per programme
- data_collection — responsible person + uploaded files per journey item
