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
  CONNECT = 'CONNECT',
  // eslint-disable-next-line no-unused-vars
  TRACE = 'TRACE',
}

type ErrorHandlerType<T extends Error> = (
  error: T,
  status?: number,
  statusText?: string
) => void;

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

  private request() {
    if (this.debug) {
      const debugHeaders: Record<string, string> = {};
      this.headers.forEach((value: string, key: string) => {
        debugHeaders[key] = value;
      });
      // eslint-disable-next-line no-console
      console.log(
        'will request: ',
        this.route,
        this.method,
        JSON.stringify(debugHeaders),
        JSON.stringify(this.body)
      );
    }

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
        // Do not set 'Content-Type' manually; browser will add correct boundary
        this.headers.delete('Content-Type');
      } else {
        opts.body = this.body
          ? JSON.stringify(this.body)
          : this.plainBody || '';
      }
    }
    return fetchWithTimeout(this.route, opts, this.timeout);
  }

  async build<T>(): Promise<T> {
    try {
      const res = await this.request();
      let result: T;
      const contentType = res.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        result = await res.json();
      } else {
        result = (await res.text()) as unknown as T;
      }

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(
          'request yielded: ',
          result,
          ' success? ',
          res.ok ? 'yes' : 'no'
        );
      }

      if (!res.ok && this.errorHandling) {
        this.errorHandling(
          result as unknown as Error,
          res.status,
          res.statusText
        );
      }

      return result as T;
    } catch (e) {
      if (this.errorHandling) {
        this.errorHandling(e as Error, undefined, undefined);
      }
      throw e;
    }
  }

  async buildAsJson<T>(): Promise<T> {
    try {
      const res = await this.request();
      const result = await res.json();

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(
          'request yielded: ',
          result,
          ' success? ',
          res.ok ? 'yes' : 'no'
        );
      }

      if (!res.ok && this.errorHandling)
        this.errorHandling(result as Error, res.status, res.statusText);
      return result as T;
    } catch (e) {
      if (this.errorHandling) {
        this.errorHandling(e as Error, undefined, undefined);
      }
      throw e;
    }
  }

  async buildAsText(): Promise<string> {
    try {
      const res = await this.request();
      const result = await res.text();

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(
          'request yielded: ',
          result,
          ' success? ',
          res.ok ? 'yes' : 'no'
        );
      }

      if (!res.ok && this.errorHandling)
        this.errorHandling(
          result as unknown as Error,
          res.status,
          res.statusText
        );
      return result;
    } catch (e) {
      if (this.errorHandling) {
        this.errorHandling(e as Error, undefined, undefined);
      }
      throw e;
    }
  }

  async buildAsBlob() {
    try {
      const res = await this.request();
      const blob = await res.blob();

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(
          'request yielded: ',
          blob,
          ' success? ',
          res.ok ? 'yes' : 'no'
        );
      }

      if (!res.ok && this.errorHandling)
        this.errorHandling(res as unknown as Error, res.status, res.statusText);
      return blob;
    } catch (e) {
      if (this.errorHandling) {
        this.errorHandling(e as Error, undefined, undefined);
      }
      throw e;
    }
  }
}
