import { HeadersBuilder } from './../src/HeadersBuilder';
import { HTTPMethod, RequestBuilder, HttpError } from './../src/RequestBuilder';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('RequestBuilder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('should call error handler when fetch fails', async () => {
    const mockError = new Error('Network failure');
    const mockFetch = vi.fn().mockRejectedValue(mockError);
    vi.stubGlobal('fetch', mockFetch);

    const errorHandler = vi.fn();
    const builder = new RequestBuilder('/getall')
      .withMethod(HTTPMethod.POST)
      .withErrorHandling(errorHandler);

    await expect(builder.build()).rejects.toThrow('Network failure');
    expect(errorHandler).toHaveBeenCalledWith(mockError, undefined, undefined);
  });

  it('should correctly build query parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', mockFetch);

    await new RequestBuilder('/api')
      .withQueryParam('page', 2)
      .withQueryParam('search', 'hello world')
      .build();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api?page=2&search=hello+world',
      expect.anything()
    );
  });

  it('should auto-retry on 502 Bad Gateway and succeed', async () => {
    const fetchFail = new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    const fetchSuccess = new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(fetchFail)
      .mockResolvedValueOnce(fetchSuccess);
    
    vi.stubGlobal('fetch', mockFetch);

    const builder = new RequestBuilder('/api')
      .withRetries(2, 50)
      .build();

    // Advance timers so backoff delay passes
    vi.runAllTimersAsync();

    const data = await builder;
    expect(data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw HttpError when withThrowOnHttpError is active', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => 
      Promise.resolve(new Response('{"error":"Not Found"}', { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/json' } }))
    ));

    const builder = new RequestBuilder('/api').withThrowOnHttpError(true);

    await expect(builder.build()).rejects.toThrow(HttpError);
    await expect(builder.build()).rejects.toThrow('HTTP 404: Not Found');
  });

  it('should trigger auth refresh interceptor on 401', async () => {
    const fetchFail = new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    const fetchSuccess = new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(fetchFail)
      .mockResolvedValueOnce(fetchSuccess);
    
    vi.stubGlobal('fetch', mockFetch);

    const interceptor = vi.fn().mockResolvedValue(undefined);

    const builder = new RequestBuilder('/api')
      .withAuthRefreshInterceptor(interceptor)
      .build();

    vi.runAllTimersAsync();
    const data = await builder;

    expect(data).toEqual({ ok: true });
    expect(interceptor).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retrieve full response via buildFull', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{"msg":"hi"}', { 
      status: 201, 
      headers: { 'content-type': 'application/json', 'x-pages': '5' } 
    }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await new RequestBuilder('/api').buildFull();

    expect(result.status).toBe(201);
    expect(result.data).toEqual({ msg: 'hi' });
    expect(result.headers.get('x-pages')).toBe('5');
  });
});
