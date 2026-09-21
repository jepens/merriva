import { describe, expect, it } from "vitest";

import { stepForPath } from "@/components/dashboard/editor/step-fields";

describe("stepForPath — awalan terpanjang menang", () => {
  it("nama panggilan milik langkah Info, walau berada di dalam content.groom (Mempelai)", () => {
    expect(stepForPath("content.groom.nickname", ["couple", "info"])).toBe(
      "info",
    );
    expect(stepForPath("content.groom.nickname", ["info", "couple"])).toBe(
      "info",
    );
  });

  it("isian mempelai lainnya milik langkah Mempelai", () => {
    expect(stepForPath("content.groom.name", ["info", "couple"])).toBe(
      "couple",
    );
    expect(stepForPath("content.bride.childOrder", ["info", "couple"])).toBe(
      "couple",
    );
  });

  it("awalan dicocokkan per segmen, bukan per huruf", () => {
    // "content.story" tidak boleh menangkap "content.storyline".
    expect(stepForPath("content.storyline", ["story"])).toBeNull();
    expect(stepForPath("content.story.3.narrative", ["story"])).toBe("story");
  });

  it("hanya langkah milik editor ini yang dipertimbangkan", () => {
    expect(
      stepForPath("content.agenda.0.title", ["story", "settings"]),
    ).toBeNull();
    expect(stepForPath("settings.timezone", ["info", "settings"])).toBe(
      "settings",
    );
  });
});
