import { brandUpdateData } from "./catalog-data.mapper";

describe("brand logo updates", () => {
  it("clears an assigned logo when the admin removes it", () => {
    expect(brandUpdateData({ logoMediaId: null }).logoMediaId).toBeNull();
  });

  it("keeps the logo untouched when the field is omitted", () => {
    expect(brandUpdateData({}).logoMediaId).toBeUndefined();
  });
});
