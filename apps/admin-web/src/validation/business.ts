export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const vehiclePricePattern = /^\d{1,12}(?:\.\d{1,2})?$/;

export interface PageFormValues {
  titleZh: string;
  contentZh: string;
}

export function pageFormValidationMessage(
  values: PageFormValues
): string | null {
  if (!values.titleZh || !values.contentZh) {
    return "请填写中文标题和中文正文";
  }
  return null;
}
