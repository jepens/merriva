import { describe, expect, it } from "vitest";

import {
  httpsUrlSchema,
  noDangerousUrlScheme,
  youtubeUrlSchema,
} from "@/lib/validation/content/shared";

describe("youtubeUrlSchema (host allowlist + https)", () => {
  it("menerima URL YouTube resmi (https)", () => {
    for (const u of [
      "https://youtu.be/abc123",
      "https://www.youtube.com/watch?v=abc123",
      "https://m.youtube.com/watch?v=abc",
      "https://music.youtube.com/watch?v=abc",
    ]) {
      expect(youtubeUrlSchema.safeParse(u).success).toBe(true);
    }
  });

  it("menolak bypass substring & skema berbahaya", () => {
    for (const u of [
      "javascript:alert(1)//youtu.be",
      "data:text/html,<script></script>//youtube.com",
      "vbscript:msgbox//youtu.be",
      "https://evil.example/?x=youtube.com", // host bukan YouTube
      "http://youtube.com/watch?v=x", // bukan https
      "https://notyoutube.com/watch", // host mirip tapi bukan
    ]) {
      expect(youtubeUrlSchema.safeParse(u).success).toBe(false);
    }
  });
});

describe("httpsUrlSchema", () => {
  it("hanya menerima https absolut", () => {
    expect(
      httpsUrlSchema(500).safeParse("https://live.example.com/x").success,
    ).toBe(true);
    for (const u of [
      "http://live.example.com",
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      "ftp://a.com",
      "bukan-url",
    ]) {
      expect(httpsUrlSchema(500).safeParse(u).success).toBe(false);
    }
  });
});

describe("noDangerousUrlScheme (guard draft)", () => {
  it("menolak skema berbahaya termasuk yang diobfuscasi", () => {
    for (const u of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "java\tscript:alert(1)",
      "java script:alert(1)",
      " data:text/html,x",
      "vbscript:x",
      "file:///etc/passwd",
    ]) {
      expect(noDangerousUrlScheme(u)).toBe(false);
    }
  });

  it("mengizinkan URL biasa (divalidasi ketat kemudian)", () => {
    expect(noDangerousUrlScheme("https://youtu.be/x")).toBe(true);
    expect(noDangerousUrlScheme("youtu")).toBe(true); // ketikan parsial
    expect(noDangerousUrlScheme("")).toBe(true);
  });
});
