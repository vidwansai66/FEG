import { config } from '../config/env.js';

export interface ResolveBetRequest {
  eventQuery?: string;
  eventId?: string;
  marketQuery?: string;
  marketId?: string;
  selectionQuery?: string;
  selectionId?: string;
}

export interface OddsRequest {
  selectionIds: string[];
}

export interface DemoSlipLeg {
  eventId: string;
  marketId: string;
  selectionId: string;
  acceptedOdds: number;
  oddsTimestamp?: string;
}

export interface SlipValidationRequest {
  slipId?: string;
  legs: DemoSlipLeg[];
}

export interface DemoConfirmationRequest {
  slipId?: string;
  legs: DemoSlipLeg[];
}

export interface ClientResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: any;
}

class SportsClient {
  private baseUrl = config.sportsApiBaseUrl;

  private async fetchWithTimeout(endpoint: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  private async parseResponse<T>(response: Response): Promise<ClientResponse<T>> {
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      return { ok: true, status: response.status, data };
    } else {
      return { ok: false, status: response.status, error: data || response.statusText };
    }
  }

  public async resolve(payload: ResolveBetRequest): Promise<ClientResponse<any>> {
    try {
      const res = await this.fetchWithTimeout('/api/sports/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return this.parseResponse(res);
    } catch (error: any) {
      return { ok: false, status: 0, error: { message: error.message } };
    }
  }

  public async getOdds(payload: OddsRequest): Promise<ClientResponse<any>> {
    try {
      const res = await this.fetchWithTimeout('/api/sports/odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return this.parseResponse(res);
    } catch (error: any) {
      return { ok: false, status: 0, error: { message: error.message } };
    }
  }

  public async validateSlip(payload: SlipValidationRequest): Promise<ClientResponse<any>> {
    try {
      const res = await this.fetchWithTimeout('/api/sports/slips/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return this.parseResponse(res);
    } catch (error: any) {
      return { ok: false, status: 0, error: { message: error.message } };
    }
  }

  public async confirmDemoBet(payload: DemoConfirmationRequest): Promise<ClientResponse<any>> {
    try {
      const res = await this.fetchWithTimeout('/api/sports/demo-bets/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return this.parseResponse(res);
    } catch (error: any) {
      return { ok: false, status: 0, error: { message: error.message } };
    }
  }
}

export const sportsClient = new SportsClient();
