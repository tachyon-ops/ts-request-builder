import { HeadersBuilder } from './../src/HeadersBuilder';
import { HTTPMethod, RequestBuilder } from './../src/RequestBuilder';
import { describe, it, expect, vi } from 'vitest';

describe('RequestBuilder', () => {
  it('should call error handler when fetch fails', async () => {
    const mockError = new Error('Network failure');
    const mockFetch = vi.fn().mockRejectedValue(mockError);

    // Replace global fetch with mock
    vi.stubGlobal('fetch', mockFetch);

    const errorHandler = vi.fn(
      (error: unknown, status?: number, statusText?: string) => {
        console.log('ERROR:', error, status, statusText);
      }
    );

    class MovieListApi {
      static apiPath = '/getall';
      static addMovie = (body: Record<string, unknown>) =>
        new RequestBuilder(MovieListApi.apiPath)
          .withHeaders(new HeadersBuilder().withContentTypeJson().build())
          .withMethod(HTTPMethod.POST)
          .withBody(body)
          .withErrorHandling(errorHandler)
          .build();
    }

    await expect(MovieListApi.addMovie({})).rejects.toThrow('Network failure');

    // Check that error handler was called
    expect(errorHandler).toHaveBeenCalledWith(mockError, undefined, undefined);

    // Cleanup
    vi.unstubAllGlobals();
  });
});
