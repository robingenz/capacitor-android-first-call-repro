// Each round makes one plugin call as the first bridge call of the page, then reloads the page.
const ROUND_LIMIT = 300;
const TIMEOUT_MS = 10000;
const STORAGE_KEY = 'firstCallRepro';

const readCounts = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : { rounds: 0, settled: 0, notSettled: 0 };
};

const writeCounts = counts => localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));

const showCounts = counts => {
  for (const [key, value] of Object.entries(counts)) {
    document.getElementById(key).textContent = String(value);
  }
};

const settlesInTime = promise =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), TIMEOUT_MS);
    const settle = () => {
      clearTimeout(timer);
      resolve(true);
    };
    promise.then(settle, settle);
  });

const runRound = async counts => {
  const startedAt = Date.now();
  const settled = await settlesInTime(Capacitor.Plugins.WebView.getServerBasePath());
  const round = counts.rounds + 1;
  if (settled) {
    console.log(`FIRSTCALL round ${round} settled after ${Date.now() - startedAt} ms`);
  } else {
    console.log(`FIRSTCALL round ${round} NOT settled after ${TIMEOUT_MS} ms`);
  }
  return {
    rounds: round,
    settled: counts.settled + (settled ? 1 : 0),
    notSettled: counts.notSettled + (settled ? 0 : 1),
  };
};

const main = async () => {
  document.getElementById('restart').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
  const counts = readCounts();
  showCounts(counts);
  if (counts.rounds >= ROUND_LIMIT) {
    return;
  }
  const nextCounts = await runRound(counts);
  writeCounts(nextCounts);
  showCounts(nextCounts);
  if (nextCounts.rounds >= ROUND_LIMIT) {
    console.log(
      `FIRSTCALL SUMMARY rounds=${nextCounts.rounds} settled=${nextCounts.settled} notSettled=${nextCounts.notSettled}`,
    );
    return;
  }
  window.location.reload();
};

main();
