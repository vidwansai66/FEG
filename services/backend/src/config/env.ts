import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPORTS_API_BASE_URL = process.env.SPORTS_API_BASE_URL;

if (!SUPABASE_URL) {
  throw new Error('Missing required environment variable: SUPABASE_URL');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
}

if (!SPORTS_API_BASE_URL) {
  throw new Error('Missing required environment variable: SPORTS_API_BASE_URL');
}

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: SUPABASE_URL,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  sportsApiBaseUrl: SPORTS_API_BASE_URL
};
