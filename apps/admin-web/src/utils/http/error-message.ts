interface ErrorDetail {
  message?: unknown;
}

interface ErrorPayload {
  message?: unknown;
  errors?: unknown;
}

const fieldLabels: Record<string, string> = {
  altEn: "英文 ALT 文案",
  altRu: "俄文 ALT 文案",
  altZh: "中文 ALT 文案",
  brandId: "品牌",
  categoryId: "分类",
  coverMediaId: "封面素材",
  email: "邮箱",
  media: "素材",
  mediaId: "素材",
  mimeType: "文件类型",
  modelId: "车型",
  password: "密码",
  seriesId: "车系",
  thumbnailUrl: "缩略图地址",
  url: "预览地址",
  username: "用户名"
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isGenericPayloadMessage(message: string | null): boolean {
  return (
    !message ||
    ["参数错误", "Bad Request", "Validation failed"].includes(message)
  );
}

function fieldLabel(field: string): string {
  return fieldLabels[field] || field;
}

function fieldPathLabel(path: string): string {
  const mediaField = /^media\.(\d+)\.(.+)$/i.exec(path);
  if (mediaField)
    return `第 ${Number(mediaField[1]) + 1} 个素材的${fieldLabel(mediaField[2])}`;

  const mediaItem = /^media\.(\d+)$/i.exec(path);
  if (mediaItem) return `第 ${Number(mediaItem[1]) + 1} 个素材`;

  return `字段“${fieldLabel(path)}”`;
}

function translateTechnicalMessage(message: string): string {
  const text = message.trim();
  const forbidden =
    /^(?:(.+)\.)?property ([A-Za-z0-9_]+) should not exist$/i.exec(text);
  if (forbidden) {
    const target = forbidden[1] ? fieldPathLabel(forbidden[1]) : "请求参数";
    return `${target}不允许提交字段“${fieldLabel(forbidden[2])}”`;
  }

  const required = /^(.+?) should not be empty$/i.exec(text);
  if (required) return `${fieldPathLabel(required[1])}不能为空`;

  const maxLength =
    /^(.+?) must be shorter than or equal to (\d+) characters$/i.exec(text);
  if (maxLength)
    return `${fieldPathLabel(maxLength[1])}长度不能超过 ${maxLength[2]} 个字符`;

  const minLength =
    /^(.+?) must be longer than or equal to (\d+) characters$/i.exec(text);
  if (minLength)
    return `${fieldPathLabel(minLength[1])}长度不能少于 ${minLength[2]} 个字符`;

  const type =
    /^(.+?) must be (a string|an array|an integer number|a number|a boolean value)$/i.exec(
      text
    );
  if (type) {
    const typeLabels: Record<string, string> = {
      "a string": "文本",
      "an array": "列表",
      "an integer number": "整数",
      "a number": "数字",
      "a boolean value": "开关值"
    };
    return `${fieldPathLabel(type[1])}格式不正确，应为${typeLabels[type[2].toLowerCase()]}`;
  }

  if (/^(Network Error|Failed to fetch|Network request failed)$/i.test(text))
    return "网络连接失败，请检查网络后重试";
  if (/^Request failed with status code \d+$/i.test(text))
    return "请求失败，请稍后重试";
  if (/^(Unauthorized|Invalid credentials)$/i.test(text))
    return "登录信息错误或已失效";
  if (/^Forbidden$/i.test(text)) return "没有执行此操作的权限";
  if (/^Not Found$/i.test(text)) return "请求的资源不存在";

  if (
    /(should not exist|must be|should be|invalid|validation|forbidden|unauthorized|not found|internal server error)/i.test(
      text
    )
  )
    return "请求参数不符合要求";

  return text;
}

export function getRequestErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "请求失败";
  const errorRecord = error as {
    message?: unknown;
    response?: { data?: unknown };
  };
  const payload =
    errorRecord.response?.data && typeof errorRecord.response.data === "object"
      ? (errorRecord.response.data as ErrorPayload)
      : undefined;
  const payloadMessage = nonEmptyString(payload?.message);
  const detail = Array.isArray(payload?.errors)
    ? payload.errors
        .map(item =>
          item && typeof item === "object"
            ? nonEmptyString((item as ErrorDetail).message)
            : null
        )
        .find(Boolean)
    : null;
  const message =
    detail && isGenericPayloadMessage(payloadMessage)
      ? detail
      : payloadMessage ||
        detail ||
        nonEmptyString(errorRecord.message) ||
        "请求失败";

  return translateTechnicalMessage(message);
}
