import { supabase } from '../config/supabase.js';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type AcquireResult = 
  | { status: 'ACQUIRED' }
  | { status: 'IN_PROGRESS' }
  | { status: 'COMPLETED'; response: any; httpStatus: number }
  | { status: 'FAILED'; response: any; httpStatus: number };

export class IdempotencyService {
  async acquire(key: string, slipId: string): Promise<AcquireResult> {
    const { error } = await supabase
      .from('idempotency_records')
      .insert({
        idempotency_key: key,
        slip_id: slipId,
        status: 'IN_PROGRESS'
      });

    if (error) {
      if (error.code === '23505') {
        // Unique violation, key already exists
        return this.getExisting(key, slipId);
      }
      throw new Error(`DB_ERROR: Failed to acquire idempotency lock - ${error.message}`);
    }

    return { status: 'ACQUIRED' };
  }

  async getExisting(key: string, slipId: string): Promise<AcquireResult> {
    const { data, error } = await supabase
      .from('idempotency_records')
      .select('*')
      .eq('idempotency_key', key)
      .single();

    if (error || !data) {
      throw new Error(`DB_ERROR: Could not fetch existing idempotency record - ${error?.message}`);
    }

    if (data.slip_id !== slipId) {
      const err: any = new Error('Idempotency key reused for different slip');
      err.statusCode = 409;
      err.code = 'IDEMPOTENCY_KEY_REUSED';
      throw err;
    }

    if (data.status === 'IN_PROGRESS') {
      return { status: 'IN_PROGRESS' };
    }

    return {
      status: data.status as 'COMPLETED' | 'FAILED',
      response: data.response_payload,
      httpStatus: data.http_status_code!
    };
  }

  async complete(key: string, response: any, httpStatus: number = 200) {
    const { error } = await supabase
      .from('idempotency_records')
      .update({
        status: 'COMPLETED',
        response_payload: response,
        http_status_code: httpStatus,
        updated_at: new Date().toISOString()
      })
      .eq('idempotency_key', key);
    
    if (error) throw new Error(`DB_ERROR: Failed to complete idempotency - ${error.message}`);
  }

  async fail(key: string, response: any, httpStatus: number) {
    const { error } = await supabase
      .from('idempotency_records')
      .update({
        status: 'FAILED',
        response_payload: response,
        http_status_code: httpStatus,
        updated_at: new Date().toISOString()
      })
      .eq('idempotency_key', key);
    
    if (error) throw new Error(`DB_ERROR: Failed to mark idempotency as failed - ${error.message}`);
  }

  async release(key: string) {
    const { error } = await supabase
      .from('idempotency_records')
      .delete()
      .eq('idempotency_key', key)
      .eq('status', 'IN_PROGRESS');
      
    if (error) throw new Error(`DB_ERROR: Failed to release idempotency - ${error.message}`);
  }
}

export const idempotencyService = new IdempotencyService();
