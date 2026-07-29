import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAuthorizedCron } from "@/server/cron/auth";

const SECRET = "sup3r-s3cret-cron";

function reqWith(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/expire-orders", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("isAuthorizedCron", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("menerima `Authorization: Bearer <secret>` yang tepat", () => {
    expect(isAuthorizedCron(reqWith(`Bearer ${SECRET}`))).toBe(true);
  });

  it("menolak secret salah", () => {
    expect(isAuthorizedCron(reqWith("Bearer salah"))).toBe(false);
  });

  it("menolak tanpa header Authorization", () => {
    expect(isAuthorizedCron(reqWith())).toBe(false);
  });

  it("menolak tanpa skema Bearer (secret telanjang)", () => {
    expect(isAuthorizedCron(reqWith(SECRET))).toBe(false);
  });

  it("menolak skema salah / spasi berbeda", () => {
    expect(isAuthorizedCron(reqWith(`bearer ${SECRET}`))).toBe(false);
    expect(isAuthorizedCron(reqWith(`Bearer  ${SECRET}`))).toBe(false);
  });

  it("FAIL-CLOSED: CRON_SECRET tak di-set → tolak semua", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCron(reqWith(`Bearer ${SECRET}`))).toBe(false);
    expect(isAuthorizedCron(reqWith("Bearer "))).toBe(false);
  });
});
