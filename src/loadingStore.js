let activeCrudRequests = 0;
const listeners = new Set();

const notify = () => {
  for (const listener of listeners) listener();
};

export const beginCrudLoading = () => {
  activeCrudRequests += 1;
  notify();
};

export const endCrudLoading = () => {
  activeCrudRequests = Math.max(0, activeCrudRequests - 1);
  notify();
};

export const getCrudLoadingSnapshot = () => activeCrudRequests > 0;

export const subscribeCrudLoading = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
