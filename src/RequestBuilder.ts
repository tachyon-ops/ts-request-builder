import { DEFAULT_TIMEOUT, fetchWithTimeout } from './FetchWithTimeout';

export enum HTTPMethod {
  // eslint-disable-next-line no-unused-vars
  POST = 'POST',
  // eslint-disable-next-line no-unused-vars
  GET = 'GET',
  // eslint-disable-next-line no-unused-vars
  PATCH = 'PATCH',
  // eslint-disable-next-line no-unused-vars
  PUT = 'PUT',
  // eslint-disable-next-line no-unused-vars
  DELETE = 'DELETE',
  // eslint-disable-next-line no-unused-vars
  HEAD = 'HEAD',
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  CONNECT = 'CONNECT',
  // eslint-disable-next-line no-unused-vars
  TRACE = 'TRACE',
  // eslint-disable-next-line no-unused-vars
  OPTIONS = 'OPTIONS',
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
    message?: string
  ) {
    super(message || `HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
}

type ErrorHandlerType<T extends Error> = (
  error: T,
  status?: number,
  statusText?: string
) => void | Promise<void>;

export class RequestBuilder {
  private route = '';

  private body: Record<string, unknown> | null = null;

  private plainBody: string | null = null;

  private headers: Headers = new Headers();

  private method: HTTPMethod = HTTPMethod.GET;

  private mode: RequestMode | null = null;

  private errorHandling: ErrorHandlerType<Error> | null = null;

  private timeout: number = DEFAULT_TIMEOUT;

  private redirect?: RequestRedirect | undefined;

  private credentials?: RequestCredentials | undefined;

  private formData: FormData | null = null;

  private queryParams = new URLSearchParams();

  private maxRetries = 0;

  private retryBackoffMs = 1000;

  private throwOnHttpError = false;

  private authRefreshInterceptor: (() => Promise<void>) | null = null;

  constructor(
    route: string,
    private debug = false
  ) {
    this.route = route;
    return this;
  }

  withErrorHandling<T extends Error>(callback: ErrorHandlerType<T>) {
    this.errorHandling = callback as ErrorHandlerType<Error>;
    return this;
  }

  withBody(body: Record<string, unknown> = {}) {
    this.body = body;
    return this;
  }

  withPlainBody(body = '') {
    this.plainBody = body;
    return this;
  }

  withFormData(formData: FormData) {
    this.formData = formData;
    return this;
  }

  withHeaders(headers: Headers) {
    this.headers = headers;
    return this;
  }

  withMethod(method: HTTPMethod) {
    this.method = method;
    return this;
  }

  withMode(mode: RequestMode) {
    this.mode = mode;
    return this;
  }

  withTimeout(timeout: number) {
    this.timeout = timeout;
    return this;
  }

  withRedirect(redirect: RequestRedirect) {
    this.redirect = redirect;
    return this;
  }

  withCredentials(credentials: RequestCredentials) {
    this.credentials = credentials;
    return this;
  }

  withQueryParam(key: string, value: string | number | boolean) {
    this.queryParams.append(key, String(value));
    return this;
  }

  withRetries(maxRetries: number, backoffMs = 1000) {
    this.maxRetries = maxRetries;
    this.retryBackoffMs = backoffMs;
    return this;
  }

  withThrowOnHttpError(throwError = true) {
    this.throwOnHttpError = throwError;
    return this;
  }

  withAuthRefreshInterceptor(interceptor: () => Promise<void>) {
    this.authRefreshInterceptor = interceptor;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeRequest<T>(parser: 'json' | 'text' | 'blob' | 'auto', returnFullResponse = false): Promise<any> {
    let res: Response | null = null;
    let attempt = 0;

    const routeQS = this.queryParams.toString();
    const finalUrl = routeQS ? `${this.route}${this.route.includes('?') ? '&' : '?'}${routeQS}` : this.route;

    while (attempt <= this.maxRetries) {
      try {
        const opts: RequestInit = {
          method: this.method,
          headers: this.headers,
          redirect: this.redirect,
          credentials: this.credentials,
        };
        if (this.mode) opts.mode = this.mode;
        if (
          this.method !== HTTPMethod.GET &&
          this.method !== HTTPMethod.HEAD &&
          (this.body || this.plainBody || this.formData)
        ) {
          if (this.formData) {
            opts.body = this.formData;
            this.headers.delete('Content-Type');
          } else {
            opts.body = this.body ? JSON.stringify(this.body) : this.plainBody || '';
          }
        }

        if (this.debug) {
          const debugHeaders: Record<string, string> = {};
          this.headers.forEach((v, k) => { debugHeaders[k] = v; });
          // eslint-disable-next-line no-console
          console.log(`[RequestBuilder] [Attempt ${attempt + 1}] Requesting: `, finalUrl, this.method, JSON.stringify(debugHeaders));
        }

        res = await fetchWithTimeout(finalUrl, opts, this.timeout);

        if (res.status === 401 && this.authRefreshInterceptor) {
          const interceptor = this.authRefreshInterceptor;
          this.authRefreshInterceptor = null; // Only run once
          await interceptor();
          continue; // Re-run the request
        }

        if (!res.ok && [502, 503, 504].includes(res.status) && attempt < this.maxRetries) {
          throw new HttpError(res.status, res.statusText, null, `Temporary server error: ${res.status}`);
        }

        break;
      } catch (e) {
        if (attempt < this.maxRetries) {
          attempt++;
          const delay = this.retryBackoffMs * Math.pow(2, attempt - 1);
          if (this.debug) {
            // eslint-disable-next-line no-console
            console.log(`[RequestBuilder] Attempt ${attempt} failed, retrying in ${delay}ms...`);
          }
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (this.errorHandling) {
          await this.errorHandling(e as Error, undefined, undefined);
        }
        throw e;
      }
    }

    if (!res) throw new Error('Request execution failed unexpectedly');

    let result: unknown;
    try {
      const contentType = res.headers.get('content-type');
      const isJsonContentType = contentType?.includes('application/json');
      let effectiveParser = parser;

      if (parser === 'auto') {
        effectiveParser = isJsonContentType ? 'json' : 'text';
      } else if (parser === 'json' && !res.ok && !isJsonContentType) {
        effectiveParser = 'text';
      }

      if (effectiveParser === 'json') {
        result = await res.json();
      } else if (effectiveParser === 'blob') {
        result = await res.blob();
      } else {
        result = await res.text();
      }
    } catch (e) {
      if (this.errorHandling) {
        await this.errorHandling(e as Error, res.status, res.statusText);
      }
      throw e;
    }

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('request yielded: ', result, ' success? ', res.ok ? 'yes' : 'no');
    }

    if (!res.ok) {
      const errorObj = new HttpError(res.status, res.statusText, result);
      if (this.errorHandling) {
        await this.errorHandling(errorObj, res.status, res.statusText);
      }
      if (this.throwOnHttpError) {
        throw errorObj;
      }
    }

    if (returnFullResponse) {
      return { data: result as T, status: res.status, headers: res.headers };
    }

    return result as T;
  }

  async buildFull<T>(): Promise<{ data: T, status: number, headers: Headers }> {
    return this.executeRequest<T>('auto', true);
  }

  async buildFullAsJson<T>(): Promise<{ data: T, status: number, headers: Headers }> {
    return this.executeRequest<T>('json', true);
  }

  async buildFullAsText(): Promise<{ data: string, status: number, headers: Headers }> {
    return this.executeRequest<string>('text', true);
  }

  async buildFullAsBlob(): Promise<{ data: Blob, status: number, headers: Headers }> {
    return this.executeRequest<Blob>('blob', true);
  }

  async build<T>(): Promise<T> {
    return this.executeRequest<T>('auto');
  }

  async buildAsJson<T>(): Promise<T> {
    return this.executeRequest<T>('json');
  }

  async buildAsText(): Promise<string> {
    return this.executeRequest<string>('text');
  }

  async buildAsBlob(): Promise<Blob> {
    return this.executeRequest<Blob>('blob');
  }
}
