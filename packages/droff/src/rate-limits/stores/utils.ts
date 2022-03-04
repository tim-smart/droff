export const delayFrom = (
  window: number,
  limit: number,
  count: number,
  ttl: number,
) => {
  const perRequest = Math.ceil(window / limit);

  const totalTime = count * perRequest;
  const elapsedTime = totalTime - ttl;
  const elapsedWindows = Math.floor(elapsedTime / window);
  const completedRequests = elapsedWindows * limit;
  const remainingRequests = count - completedRequests;
  const remainingWindows = Math.floor((remainingRequests - 1) / limit);
  const delayRemainder = elapsedTime % window;

  if (remainingWindows === 0) {
    return 0;
  }

  return remainingWindows * window - delayRemainder;
};
