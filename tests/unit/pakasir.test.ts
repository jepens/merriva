import { describe, expect, it } from "vitest";

import { buildPakasirPaymentUrl } from "@/lib/payment/pakasir";

describe("buildPakasirPaymentUrl", () => {
  it("membangun URL payment link dengan order_id & redirect ter-encode", () => {
    const url = buildPakasirPaymentUrl("merriva", {
      orderCode: "MRV-8F3K2",
      amountIdr: 99000,
      redirectUrl: "https://merriva.id/dashboard?status=ok",
    });

    expect(url).toContain("https://app.pakasir.com/pay/merriva/99000?");
    expect(url).toContain("order_id=MRV-8F3K2");
    // redirect harus di-URL-encode
    expect(url).toContain(
      "redirect=https%3A%2F%2Fmerriva.id%2Fdashboard%3Fstatus%3Dok",
    );
    expect(url).not.toContain("qris_only");
  });

  it("menambahkan qris_only=1 bila diminta", () => {
    const url = buildPakasirPaymentUrl("merriva", {
      orderCode: "MRV-ABCDE",
      amountIdr: 199000,
      redirectUrl: "https://merriva.id/ok",
      qrisOnly: true,
    });

    expect(url).toContain("qris_only=1");
    expect(url).toContain("/pay/merriva/199000?");
  });
});
