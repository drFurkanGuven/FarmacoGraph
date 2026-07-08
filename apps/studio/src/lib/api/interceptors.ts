import { createAuthMiddleware } from "./auth";
import { applyDatasetVersionHeader, buildTracingHeaders } from "./headers";
import type { ApiEnvelope } from "./types";
import type { AuthSession } from "./types";

export interface RequestContext {
  url: string;
  init: RequestInit;
  headers: Headers;
  session: AuthSession | null;
  datasetVersion?: string | null;
  attempt: number;
}

export interface ResponseContext<T = unknown> {
  url: string;
  response: Response;
  envelope: ApiEnvelope<T>;
  traceId: string | null;
  datasetVersion: string | null;
}

export type RequestInterceptor = (ctx: RequestContext) => void | Promise<void>;
export type ResponseInterceptor = <T>(ctx: ResponseContext<T>) => void | Promise<void>;
export type ErrorInterceptor = (error: unknown, ctx: RequestContext) => void | Promise<void>;

export class InterceptorRegistry {
  private readonly requestInterceptors: RequestInterceptor[] = [];
  private readonly responseInterceptors: ResponseInterceptor[] = [];
  private readonly errorInterceptors: ErrorInterceptor[] = [];

  useRequest(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index >= 0) this.requestInterceptors.splice(index, 1);
    };
  }

  useResponse(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index >= 0) this.responseInterceptors.splice(index, 1);
    };
  }

  useError(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index >= 0) this.errorInterceptors.splice(index, 1);
    };
  }

  async runRequest(ctx: RequestContext): Promise<void> {
    for (const interceptor of this.requestInterceptors) {
      await interceptor(ctx);
    }
  }

  async runResponse<T>(ctx: ResponseContext<T>): Promise<void> {
    for (const interceptor of this.responseInterceptors) {
      await interceptor(ctx);
    }
  }

  async runError(error: unknown, ctx: RequestContext): Promise<void> {
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error, ctx);
    }
  }
}

export interface DefaultInterceptorOptions {
  getSession?: () => AuthSession | null | undefined;
  getDatasetVersion?: () => string | null | undefined;
}

export function createDefaultInterceptors(
  options: DefaultInterceptorOptions = {},
): InterceptorRegistry {
  const registry = new InterceptorRegistry();

  if (options.getSession) {
    const authMiddleware = createAuthMiddleware(options.getSession);
    registry.useRequest((ctx) => {
      authMiddleware(ctx.headers, ctx.session);
    });
  }

  registry.useRequest((ctx) => {
    const tracing = buildTracingHeaders();
    for (const [key, value] of Object.entries(tracing)) {
      ctx.headers.set(key, value);
    }
    const version = ctx.datasetVersion ?? options.getDatasetVersion?.();
    applyDatasetVersionHeader(ctx.headers, version);
  });

  return registry;
}
