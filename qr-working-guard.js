(function () {
  "use strict";
  const api = window.QRPositionSync;
  if (!api || api.__workingAisleGuardInstalled) return;
  api.__workingAisleGuardInstalled = true;

  // All open tabs share localStorage queues. Serialize their read/write/sync
  // operations so multiple tabs cannot replay the same add/remove at once.
  const LOCK_NAME = "qr-position-working-aisles-sync-v2";
  const LOCK_KEY = "qr-position-working-aisles-sync-lease-v2";

  function readLease() {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); }
    catch (_) { return null; }
  }

  function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function localLease(task) {
    const token = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const current = readLease();
      if (!current || Number(current.until) < Date.now()) {
        try {
          localStorage.setItem(LOCK_KEY, JSON.stringify({ token, until: Date.now() + 10000 }));
          const check = readLease();
          if (check && check.token === token) {
            const heartbeat = setInterval(() => {
              const latest = readLease();
              if (latest && latest.token === token) {
                localStorage.setItem(LOCK_KEY, JSON.stringify({ token, until: Date.now() + 10000 }));
              }
            }, 2500);
            try {
              return await task();
            } finally {
              clearInterval(heartbeat);
              const latest = readLease();
              if (latest && latest.token === token) localStorage.removeItem(LOCK_KEY);
            }
          }
        } catch (_) {
          // Keep trying until the lease deadline; then return a clear error.
        }
      }
      await pause(80 + Math.floor(Math.random() * 80));
    }
    throw new Error("Synchronizace uliček už běží v jiné kartě. Zavřete duplicitní karty QR Position a zkuste to znovu.");
  }

  function withSharedLock(task) {
    if (navigator.locks && typeof navigator.locks.request === "function") {
      return navigator.locks.request(LOCK_NAME, { mode: "exclusive" }, task);
    }
    return localLease(task);
  }

  function hasPendingWork() {
    try {
      const rows = JSON.parse(localStorage.getItem("qr-working-pending-v1") || "[]");
      return Array.isArray(rows) && rows.length > 0;
    } catch (_) { return false; }
  }

  let localReadPromise = null;
  ["markWorkingAisle", "clearWorkingAisle", "getWorkingAisles"].forEach(name => {
    if (typeof api[name] !== "function") return;
    const original = api[name].bind(api);
    api[name] = function (...args) {
      if (name === "getWorkingAisles") {
        if (localReadPromise) return localReadPromise;
        // Routine polling with an empty queue is read-only, so do not serialize
        // all refreshes from many open tabs unnecessarily.
        if (!hasPendingWork()) return original(...args);
      }
      const operation = withSharedLock(() => original(...args));
      if (name === "getWorkingAisles") {
        localReadPromise = Promise.resolve(operation);
        return localReadPromise.finally(() => { localReadPromise = null; });
      }
      return operation;
    };
  });
})();