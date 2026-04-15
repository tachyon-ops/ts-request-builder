# TS-REQUEST-BUILDER

<!-- STORY -->

This module is aimed at helping you do requests the easy way, in a clean and concise style.
It follows the Keep It Super Simple philosophy.

## Import

```js
import { RequestBuilder } from 'ts-request-builder';
```

## Usage

`ts-request-builder` allows you to chain configuration methods to construct and execute HTTP requests seamlessly.

### Basic Request
```ts
const data = await new RequestBuilder('/api/users')
  .withMethod(HTTPMethod.GET)
  .buildAsJson();
```

### Advanced Features

**1. Query Parameters**
Safely encode variables into the URL without manual string concatenation:
```ts
const movies = await new RequestBuilder('/api/movies')
  .withQueryParam('genre', 'sci-fi')
  .withQueryParam('page', 2)
  .buildAsJson();
```

**2. Auto-Retries & Exponential Backoff**
Automatically retry requests if the network drops or the server returns a 5xx gateway error. It uses exponential backoff:
```ts
const data = await new RequestBuilder('/api/sync')
  .withRetries(3, 500) // max 3 retries, starting at 500ms delay
  .buildAsJson();
```

**3. Token Refresh Interceptor**
Provide an async callback that intercepts `401 Unauthorized` responses. The builder will pause the request, fire your callback (e.g. to fetch a new token), and automatically replay the request.
```ts
const data = await new RequestBuilder('/api/protected')
  .withAuthRefreshInterceptor(async () => {
    await fetchNewTokens(); // Implement your refresh logic here
  })
  .buildAsJson();
```

**4. Rich Error Handling**
By default, failing HTTP statuses don't throw errors. You can force the builder to throw structured `HttpError` exceptions containing the `.status` and `.data`:
```ts
try {
  await new RequestBuilder('/api')
    .withThrowOnHttpError(true)
    .buildAsJson();
} catch (e) {
  if (e instanceof HttpError) {
    console.error(`Failed with status ${e.status}:`, e.data);
  }
}
```

**5. Full Response Details**
If you need HTTP response headers (e.g., for pagination), use `.buildFullAsJson()` or `.buildFull()`:
```ts
const { data, status, headers } = await new RequestBuilder('/api/items')
  .buildFullAsJson();
  
const totalItems = headers.get('X-Total-Count');
```

Have fun!

### Help with work

Just fork and do a PR :) I will add you to the colaborators list with a BIG thank you!

- If you want to buy me a coffee or a beer as a thank you, I'm very much appreciated :stuck_out_tongue_winking_eye: [![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=D3J2WXTXLAWK8&source=url)

### Guidelines

Whenever a new `master` is deployed, it should be tagged with the new deployed version.
After we reach version 1.0.0 as the first release (production ready). After that, we follow semantic versioning.

### Publishing

Remember to always publish on a merge request. Pipeline `master:only` actions will be created in the future, once we stabilize this library.

Enjoy!

## Troubleshooting

- Create an issue
