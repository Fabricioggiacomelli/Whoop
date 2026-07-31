import { logger } from "@/lib/logger";

import {
  buildMockCycles,
  buildMockRecoveries,
  buildMockSleeps,
  buildMockWorkouts,
} from "./__mocks__/fixtures";
import type {
  WhoopBodyMeasurementRaw,
  WhoopCycleRaw,
  WhoopPaginated,
  WhoopProfileRaw,
  WhoopRecoveryRaw,
  WhoopSleepRaw,
  WhoopTokenResponse,
  WhoopWorkoutRaw,
} from "./whoop.types";

const API_HOST = "https://api.prod.whoop.com";
const API_PREFIX = "/developer/v2";
const MAX_RETRIES = 3;

export type PageParams = { limit?: number; start?: string; end?: string; nextToken?: string };

export class WhoopApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function isMockMode(): boolean {
  return (process.env.WHOOP_MODE ?? "mock") !== "live";
}

function buildQuery(params: PageParams): string {
  const search = new URLSearchParams();
  search.set("limit", String(Math.min(params.limit ?? 25, 25)));
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.nextToken) search.set("nextToken", params.nextToken);
  return search.toString();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper HTTP fino sobre a API real da WHOOP (https://api.prod.whoop.com/developer/v2) —
 * ver WHOOP_INTEGRATION.md §1. Não conhece regras de negócio; só busca e devolve o payload
 * cru (o `WhoopNormalizer` traduz). Em `WHOOP_MODE=mock` (default sem credenciais), devolve
 * fixtures determinísticas em vez de bater na rede — usado para exercitar todo o pipeline
 * de sync/import sem precisar de um app real no WHOOP Developer Dashboard.
 */
export class WhoopClient {
  constructor(
    private readonly accessToken: string,
    private readonly mockUserSeed = 1,
  ) {}

  private async request<T>(path: string, params: PageParams = {}): Promise<T> {
    const url = `${API_HOST}${API_PREFIX}${path}?${buildQuery(params)}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const backoffMs = 2 ** attempt * 500 + Math.random() * 250;
        logger.warn("whoop.client.retry", { path, status: response.status, attempt, backoffMs });
        await sleep(backoffMs);
        continue;
      }

      throw new WhoopApiError(`WHOOP API ${path} respondeu ${response.status}`, response.status);
    }

    throw new WhoopApiError(`WHOOP API ${path} esgotou as tentativas`, 0);
  }

  async getCycles(params: PageParams = {}): Promise<WhoopPaginated<WhoopCycleRaw>> {
    if (isMockMode()) return buildMockCycles(this.mockUserSeed, new Date());
    return this.request<WhoopPaginated<WhoopCycleRaw>>("/cycle", params);
  }

  async getRecoveries(params: PageParams = {}): Promise<WhoopPaginated<WhoopRecoveryRaw>> {
    if (isMockMode()) return buildMockRecoveries(this.mockUserSeed, new Date());
    return this.request<WhoopPaginated<WhoopRecoveryRaw>>("/recovery", params);
  }

  async getSleeps(params: PageParams = {}): Promise<WhoopPaginated<WhoopSleepRaw>> {
    if (isMockMode()) return buildMockSleeps(this.mockUserSeed, new Date());
    return this.request<WhoopPaginated<WhoopSleepRaw>>("/activity/sleep", params);
  }

  async getWorkouts(params: PageParams = {}): Promise<WhoopPaginated<WhoopWorkoutRaw>> {
    if (isMockMode()) return buildMockWorkouts(this.mockUserSeed, new Date());
    return this.request<WhoopPaginated<WhoopWorkoutRaw>>("/activity/workout", params);
  }

  /** Busca pontual usada por webhooks — nunca confiamos no payload do evento como fonte de verdade. */
  async getSleepById(id: string): Promise<WhoopSleepRaw> {
    if (isMockMode()) return buildMockSleeps(this.mockUserSeed, new Date()).records[0];
    return this.request<WhoopSleepRaw>(`/activity/sleep/${id}`);
  }

  async getWorkoutById(id: string): Promise<WhoopWorkoutRaw> {
    if (isMockMode()) return buildMockWorkouts(this.mockUserSeed, new Date()).records[0];
    return this.request<WhoopWorkoutRaw>(`/activity/workout/${id}`);
  }

  /** Webhooks de recovery (v2) trazem o UUID do sleep no `id` — recovery é buscada pelo ciclo. */
  async getRecoveryForCycle(cycleId: number): Promise<WhoopRecoveryRaw> {
    if (isMockMode()) return buildMockRecoveries(this.mockUserSeed, new Date()).records[0];
    return this.request<WhoopRecoveryRaw>(`/cycle/${cycleId}/recovery`);
  }

  async getProfile(): Promise<WhoopProfileRaw> {
    if (isMockMode()) {
      return { user_id: this.mockUserSeed, email: "mock@apex4.dev", first_name: "Mock", last_name: "User" };
    }
    return this.request<WhoopProfileRaw>("/user/profile/basic");
  }

  async getBodyMeasurement(): Promise<WhoopBodyMeasurementRaw> {
    if (isMockMode()) {
      return { height_meter: 1.75, weight_kilogram: 75, max_heart_rate: 190 };
    }
    return this.request<WhoopBodyMeasurementRaw>("/user/measurement/body");
  }

  async revokeAccess(): Promise<void> {
    if (isMockMode()) return;
    const response = await fetch(`${API_HOST}${API_PREFIX}/user/access`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok && response.status !== 404) {
      throw new WhoopApiError(`Falha ao revogar acesso: ${response.status}`, response.status);
    }
  }

  static async exchangeCode(params: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  }): Promise<WhoopTokenResponse> {
    const response = await fetch(`${API_HOST}/oauth/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.clientId,
        client_secret: params.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new WhoopApiError(`Falha ao trocar code por token: ${response.status}`, response.status);
    }
    return (await response.json()) as WhoopTokenResponse;
  }

  static async refreshToken(params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<WhoopTokenResponse> {
    const response = await fetch(`${API_HOST}/oauth/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: params.refreshToken,
        client_id: params.clientId,
        client_secret: params.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new WhoopApiError(`Falha ao renovar token: ${response.status}`, response.status);
    }
    return (await response.json()) as WhoopTokenResponse;
  }
}
