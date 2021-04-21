import { livealertApi as api } from './config.js';
import { setSkin, setCountdown } from './lib/alertlive.js';
import {
  isAfter,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
} from 'date-fns';

const sleep = (time) =>
  new Promise((resolve) => setTimeout(resolve, time * 1000));

const poll = async (promiseFn, time) => {
  await promiseFn();
  await sleep(time);
  poll(promiseFn, time);
};

const fetchLive = async () => {
  const url = new URL(`${api.version}${api.path}`, api.url);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': `${window.chrome.runtime.id}`,
    },
    cache: 'default',
  });

  if (!res.ok) {
    throw new Error(
      'failed to fetch api',
      `statusCode: ${res.status}`,
      `url: ${api.url}/${api.version}${api.path}`
    );
  }

  return res.json();
};

const handleChange = ({ onair = false, next, skins = [] }) => {
  const now = new Date();
  const nextLive = new Date(next ?? 0);
  const hasSchedule = isAfter(nextLive, now);
  const isDisplayed = hasSchedule && differenceInHours(nextLive, now) <= 12;
  const isCounted = hasSchedule && differenceInMinutes(nextLive, now) <= 5;

  if (isCounted) {
    setCountdown(differenceInSeconds(nextLive, now));
  }

  return setSkin({
    badgetxt: onair ? 'Live' : 'Off',
    badgecolor: 'dodgerblue',
    badge: onair ? 'icons/128-light.png' : 'icons/128-dark.png',
    ...skins[onair],
    ...(!onair && isDisplayed && { badgetxt: format(nextLive, 'HH:mm') }),
  });
};

poll(async () => {
  let offlineTimeout = null;

  try {
    const live = await fetchLive();

    clearTimeout(offlineTimeout);
    offlineTimeout = null;

    window.chrome.storage.local.set({ live });
    handleChange(live);
  } catch (err) {
    console.error(err);
    if (offlineTimeout) return;

    console.error(
      "setting the live to off in 5min if the api isn't back online"
    );

    offlineTimeout = setTimeout(() => {
      window.chrome.storage.local.set({});
      handleChange({});
    }, 300 * 1000);
  }
}, 9);
