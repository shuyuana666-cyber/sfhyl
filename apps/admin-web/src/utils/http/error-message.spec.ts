import { describe, expect, it } from "vitest";
import { getRequestErrorMessage } from "./error-message";

describe("getRequestErrorMessage", () => {
  it("uses a specific API message", () => {
    expect(
      getRequestErrorMessage({
        response: { data: { message: "数据已存在" } },
        message: "Request failed"
      })
    ).toBe("数据已存在");
  });

  it("prefers validation details over a generic parameter error", () => {
    expect(
      getRequestErrorMessage({
        response: {
          data: {
            message: "参数错误",
            errors: [{ message: "库存编号不能为空" }]
          }
        }
      })
    ).toBe("库存编号不能为空");
  });

  it("translates technical validation messages into Chinese", () => {
    expect(
      getRequestErrorMessage({
        response: {
          data: {
            message: "Bad Request",
            errors: [{ message: "media.0.property url should not exist" }]
          }
        }
      })
    ).toBe("第 1 个素材不允许提交字段“预览地址”");
  });

  it("translates common transport errors and uses a stable default", () => {
    expect(getRequestErrorMessage({ message: "Network Error" })).toBe(
      "网络连接失败，请检查网络后重试"
    );
    expect(getRequestErrorMessage(null)).toBe("请求失败");
  });
});
