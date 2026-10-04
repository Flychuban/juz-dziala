import { getRequestConfig } from "next-intl/server";

import { TIME_ZONE } from "./config";
import { MESSAGES } from "./messages";
import { getServerLocale } from "./server";

/** next-intl without i18n routing: the locale comes from the jd_lang cookie. */
export default getRequestConfig(async () => {
  const locale = await getServerLocale();
  return { locale, messages: MESSAGES[locale], timeZone: TIME_ZONE };
});
