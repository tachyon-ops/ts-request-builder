export const DEFAULT_TIMEOUT = 10000;

export const fetchWithTimeout = async (
  requestInfo: RequestInfo,
  requestInit: RequestInit = {},
  timeout = DEFAULT_TIMEOUT
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const { signal } = controller;
  try {
    return await fetch(requestInfo, { ...requestInit, signal });
  } finally {
    clearTimeout(timer);
  }
};
