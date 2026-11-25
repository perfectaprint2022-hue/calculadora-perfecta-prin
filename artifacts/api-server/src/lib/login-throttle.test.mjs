import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  getLoginThrottleKeys,
  LOGIN_THROTTLE_FAILURE_LIMITS,
} from "./login-throttle.ts";

process.env.SESSION_SECRET = "unit-test-session-secret";

function simulateFailedLogin(counters, keys) {
  for (const { keyHash } of keys) {
    counters.set(keyHash, (counters.get(keyHash) ?? 0) + 1);
  }
}

function isThrottled(counters, keys) {
  return keys.some(({ keyHash, failureLimit }) =>
    (counters.get(keyHash) ?? 0) >= failureLimit
  );
}

test("rotating IP addresses still reaches the account limit", () => {
  const counters = new Map();
  const username = "shared-account";

  for (let attempt = 0; attempt < LOGIN_THROTTLE_FAILURE_LIMITS.account; attempt += 1) {
    const keys = getLoginThrottleKeys(`192.0.2.${attempt + 1}`, username);
    simulateFailedLogin(counters, keys);
    if (attempt < LOGIN_THROTTLE_FAILURE_LIMITS.account - 1) {
      assert.equal(isThrottled(counters, keys), false);
    }
  }

  assert.equal(isThrottled(counters, getLoginThrottleKeys("198.51.100.10", username)), true);
});

test("rotating usernames still reaches the origin limit", () => {
  const counters = new Map();
  const ip = "192.0.2.50";

  for (let attempt = 0; attempt < LOGIN_THROTTLE_FAILURE_LIMITS.origin; attempt += 1) {
    const keys = getLoginThrottleKeys(ip, `account-${String(attempt).padStart(3, "0")}`);
    simulateFailedLogin(counters, keys);
    if (attempt < LOGIN_THROTTLE_FAILURE_LIMITS.origin - 1) {
      assert.equal(isThrottled(counters, keys), false);
    }
  }

  assert.equal(isThrottled(counters, getLoginThrottleKeys(ip, "another-account")), true);
});

test("failures for one account do not block other users on a shared network", () => {
  const counters = new Map();
  const sharedIp = "192.0.2.60";

  for (let attempt = 0; attempt < LOGIN_THROTTLE_FAILURE_LIMITS.account; attempt += 1) {
    simulateFailedLogin(counters, getLoginThrottleKeys(sharedIp, "alice"));
  }

  assert.equal(isThrottled(counters, getLoginThrottleKeys(sharedIp, "alice")), true);
  assert.equal(isThrottled(counters, getLoginThrottleKeys(sharedIp, "bob")), false);

  for (let user = 0; user < 20; user += 1) {
    const keys = getLoginThrottleKeys(sharedIp, `colleague-${user}`);
    simulateFailedLogin(counters, keys);
    assert.equal(isThrottled(counters, keys), false);
  }
});

test("stored identities are HMAC digests and the combined key remains compatible", () => {
  const ip = "203.0.113.8";
  const username = "Example.User";
  const keys = getLoginThrottleKeys(ip, username);

  assert.equal(keys.length, 3);
  assert.ok(keys.every(({ keyHash }) => /^[a-f0-9]{64}$/.test(keyHash)));
  assert.ok(keys.every(({ keyHash }) => !keyHash.includes(ip) && !keyHash.includes(username)));
  assert.equal(
    keys[0].keyHash,
    createHmac("sha256", process.env.SESSION_SECRET)
      .update("login-throttle\0")
      .update(JSON.stringify([ip, username.toLowerCase()]))
      .digest("hex"),
  );
});
