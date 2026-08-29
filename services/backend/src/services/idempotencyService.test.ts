import { describe, it, expect, vi, beforeEach } from 'vitest';
import { idempotencyService } from './idempotencyService.js';
import { supabase } from '../config/supabase.js';

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn()
        }))
      }))
    }))
  }
}));

describe('IdempotencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquire', () => {
    it('returns ACQUIRED when insert succeeds', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const result = await idempotencyService.acquire('key123', 'slip123');
      expect(result).toEqual({ status: 'ACQUIRED' });
      expect(mockInsert).toHaveBeenCalledWith({
        idempotency_key: 'key123',
        slip_id: 'slip123',
        status: 'IN_PROGRESS'
      });
    });

    it('returns IN_PROGRESS if key exists and is in progress for same slip', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { code: '23505' } });
      const mockSingle = vi.fn().mockResolvedValue({
        data: { slip_id: 'slip123', status: 'IN_PROGRESS' },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'idempotency_records') return { insert: mockInsert, select: mockSelect };
      });

      const result = await idempotencyService.acquire('key123', 'slip123');
      expect(result).toEqual({ status: 'IN_PROGRESS' });
    });

    it('throws IDEMPOTENCY_KEY_REUSED if key exists for different slip', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { code: '23505' } });
      const mockSingle = vi.fn().mockResolvedValue({
        data: { slip_id: 'differentSlip', status: 'IN_PROGRESS' },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'idempotency_records') return { insert: mockInsert, select: mockSelect };
      });

      await expect(idempotencyService.acquire('key123', 'slip123')).rejects.toThrow('Idempotency key reused for different slip');
    });

    it('returns COMPLETED and payload if already completed', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { code: '23505' } });
      const mockSingle = vi.fn().mockResolvedValue({
        data: { slip_id: 'slip123', status: 'COMPLETED', response_payload: { ok: true }, http_status_code: 200 },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'idempotency_records') return { insert: mockInsert, select: mockSelect };
      });

      const result = await idempotencyService.acquire('key123', 'slip123');
      expect(result).toEqual({ status: 'COMPLETED', response: { ok: true }, httpStatus: 200 });
    });
  });

  describe('complete and fail', () => {
    it('updates record to COMPLETED', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await idempotencyService.complete('key123', { success: true }, 200);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'COMPLETED',
        response_payload: { success: true },
        http_status_code: 200
      }));
      expect(mockEq).toHaveBeenCalledWith('idempotency_key', 'key123');
    });

    it('updates record to FAILED', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await idempotencyService.fail('key123', { success: false }, 409);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'FAILED',
        response_payload: { success: false },
        http_status_code: 409
      }));
      expect(mockEq).toHaveBeenCalledWith('idempotency_key', 'key123');
    });
  });

  describe('release', () => {
    it('deletes IN_PROGRESS record', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase.from as any).mockReturnValue({ delete: mockDelete });

      await idempotencyService.release('key123');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq1).toHaveBeenCalledWith('idempotency_key', 'key123');
      expect(mockEq2).toHaveBeenCalledWith('status', 'IN_PROGRESS');
    });
  });
});
