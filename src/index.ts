import { fetchWithTimeout } from './FetchWithTimeout';
import { HeadersBuilder } from './HeadersBuilder';
import { HTTPMethod, RequestBuilder } from './RequestBuilder';

export { fetchWithTimeout, RequestBuilder, HTTPMethod, HeadersBuilder };

class MovieListApi {
  static apiPath = '/getall';

  static addMovie = (body: Record<string, unknown>) =>
    new RequestBuilder(MovieListApi.apiPath)
      .withHeaders(new HeadersBuilder().withContentTypeJson().build())
      .withMethod(HTTPMethod.POST)
      .withBody(body)
      .withErrorHandling(apiErrorHandler)
      .build();
}

MovieListApi.addMovie({});
function apiErrorHandler(
  _error: unknown,
  _status?: number | undefined,
  statusText?: string | undefined
): void {
  throw new Error('ERROR: ' + statusText);
}
