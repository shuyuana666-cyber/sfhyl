import { describe, expect, it } from "vitest";
import {
  pageFormValidationMessage,
  slugPattern,
  vehiclePricePattern
} from "./business";

describe("business form validation", () => {
  it("accepts valid vehicle slugs and bounded prices", () => {
    expect(slugPattern.test("toyota-camry-2025")).toBe(true);
    expect(vehiclePricePattern.test("123456789012.99")).toBe(true);
  });

  it("rejects unsafe slugs and malformed prices", () => {
    expect(slugPattern.test("Toyota Camry")).toBe(false);
    expect(vehiclePricePattern.test("1200.999")).toBe(false);
  });

  it("returns the first actionable page validation message", () => {
    expect(
      pageFormValidationMessage({
        titleZh: "",
        contentZh: "<p>内容</p>"
      })
    ).toBe("请填写中文标题和中文正文");
    expect(
      pageFormValidationMessage({
        titleZh: "关于",
        contentZh: "<p>内容</p>"
      })
    ).toBeNull();
  });
});
