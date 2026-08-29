import { supabase } from './config/supabase.js';

async function testConnection() {
  try {
    const { error } = await supabase.from('sessions').select('id').limit(1);
    
    if (error) {
      console.error('Supabase connection failed');
      process.exit(1);
    }
    
    console.log('Supabase connection successful');
    process.exit(0);
  } catch (err) {
    console.error('Supabase connection failed');
    process.exit(1);
  }
}

testConnection();
