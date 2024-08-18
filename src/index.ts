import {
  createQuery,
  cache,
  inMemoryCache,
  localStorageCache
  concurrency,
  onAbort,
} from "@farfetched/core";
import { createEvent, sample, allSettled, fork, createEffect } from "effector";

let counter = 0;

const cachedQuery = createQuery({
  async handler(id: number) {
    console.log("query", id, "started at", ++counter);
    const ac = new AbortController();

    onAbort(() => {
      ac.abort("early aborted");
    });

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        ac.signal.addEventListener("abort", (ev) => reject(ev));
        resolve(id);
      }, 50 * id);
    });
  },
});

cachedQuery.__.meta.sid = "cool SID";

const startJob = createEvent<number>();

const purgeCache = createEvent();
const hit = createEvent<{ key: string }>();
const miss = createEvent<{ key: string }>();

hit.watch((payload) => console.log("hit", payload));
miss.watch((payload) => console.log("miss", payload));

cache(cachedQuery, {
  adapter: localStorageCache({ observability: { hit, miss } }),
  staleAfter: "1m",
  humanReadableKeys: true,
  purge: purgeCache,
});
concurrency(cachedQuery, { strategy: "TAKE_LATEST" });

sample({
  clock: startJob,
  target: cachedQuery.start,
});

cachedQuery.start.watch((id) => console.log(`🚀 Job ${id} scheduled`));

cachedQuery.finished.finally.watch((data) =>
  console.log(`🎉 Job ${data.params} resulted with ${data.status}`),
);
cachedQuery.aborted.watch((data) => {
  console.log(`💀 Job ${data.params} was aborted`);
});

cachedQuery.$data.watch((value) => console.log("🔎 value is", value));

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  startJob(1);

  await delay(100);

  console.info("-------------- Both 1 and 2 cached --------------");

  startJob(2);
  console.log("2 scheduled");
  startJob(1);
  console.log("1 scheduled, so 2 must be cancelled");
}

const printReceivedFx = createEffect((value: unknown) => {
  const el = document.getElementById("received");

  el!.textContent = `Received ${value}`;
});

const printExpectedFx = createEffect((value: unknown) => {
  const el = document.getElementById("expected");

  el!.textContent = `Expected ${value}`;
});

sample({
  clock: cachedQuery.$data,
  target: printReceivedFx,
});

sample({
  clock: cachedQuery.start,
  target: printExpectedFx,
});

const button = document.getElementById("start");

button?.addEventListener("click", () => {
  main();
});

const purgeButton = document.getElementById("purgeButton");

purgeButton?.addEventListener("click", () => {
  purgeCache();
});
