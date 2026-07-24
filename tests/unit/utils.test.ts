import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("menggabungkan className bersyarat", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("meresolusi konflik utility Tailwind (kelas terakhir menang)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
