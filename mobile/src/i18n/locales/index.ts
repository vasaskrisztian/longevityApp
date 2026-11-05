import type { Language } from '@/src/i18n/languages';
import type { Messages } from '@/src/i18n/translate';

import { common as en_common } from './en/common';
import { enums as en_enums } from './en/enums';
import { auth as en_auth } from './en/auth';
import { account as en_account } from './en/account';
import { nav as en_nav } from './en/nav';
import { onboarding as en_onboarding } from './en/onboarding';
import { dashboard as en_dashboard } from './en/dashboard';
import { body as en_body } from './en/body';
import { plan as en_plan } from './en/plan';
import { community as en_community } from './en/community';
import { groups as en_groups } from './en/groups';
import { admin as en_admin } from './en/admin';
import { content as en_content } from './en/content';
import { common as hu_common } from './hu/common';
import { enums as hu_enums } from './hu/enums';
import { auth as hu_auth } from './hu/auth';
import { account as hu_account } from './hu/account';
import { nav as hu_nav } from './hu/nav';
import { onboarding as hu_onboarding } from './hu/onboarding';
import { dashboard as hu_dashboard } from './hu/dashboard';
import { body as hu_body } from './hu/body';
import { plan as hu_plan } from './hu/plan';
import { community as hu_community } from './hu/community';
import { groups as hu_groups } from './hu/groups';
import { admin as hu_admin } from './hu/admin';
import { content as hu_content } from './hu/content';
import { common as de_common } from './de/common';
import { enums as de_enums } from './de/enums';
import { auth as de_auth } from './de/auth';
import { account as de_account } from './de/account';
import { nav as de_nav } from './de/nav';
import { onboarding as de_onboarding } from './de/onboarding';
import { dashboard as de_dashboard } from './de/dashboard';
import { body as de_body } from './de/body';
import { plan as de_plan } from './de/plan';
import { community as de_community } from './de/community';
import { groups as de_groups } from './de/groups';
import { admin as de_admin } from './de/admin';
import { content as de_content } from './de/content';

const en = { ...en_common, ...en_enums, ...en_auth, ...en_account, ...en_nav, ...en_onboarding, ...en_dashboard, ...en_body, ...en_plan, ...en_community, ...en_groups, ...en_admin, ...en_content } as const;
const hu = { ...hu_common, ...hu_enums, ...hu_auth, ...hu_account, ...hu_nav, ...hu_onboarding, ...hu_dashboard, ...hu_body, ...hu_plan, ...hu_community, ...hu_groups, ...hu_admin, ...hu_content } as const;
const de = { ...de_common, ...de_enums, ...de_auth, ...de_account, ...de_nav, ...de_onboarding, ...de_dashboard, ...de_body, ...de_plan, ...de_community, ...de_groups, ...de_admin, ...de_content } as const;

/** Every key of the app, defined by the English source. */
export type MessageKey = keyof typeof en;

/** The namespaces, per language — used by the catalogue test to find a key defined twice. */
export const namespaces: Record<Language, Record<string, Messages>> = {
  en: { common: en_common, enums: en_enums, auth: en_auth, account: en_account, nav: en_nav, onboarding: en_onboarding, dashboard: en_dashboard, body: en_body, plan: en_plan, community: en_community, groups: en_groups, admin: en_admin, content: en_content },
  hu: { common: hu_common, enums: hu_enums, auth: hu_auth, account: hu_account, nav: hu_nav, onboarding: hu_onboarding, dashboard: hu_dashboard, body: hu_body, plan: hu_plan, community: hu_community, groups: hu_groups, admin: hu_admin, content: hu_content },
  de: { common: de_common, enums: de_enums, auth: de_auth, account: de_account, nav: de_nav, onboarding: de_onboarding, dashboard: de_dashboard, body: de_body, plan: de_plan, community: de_community, groups: de_groups, admin: de_admin, content: de_content },
};

export const catalogs: Record<Language, Messages> = { en, hu, de };
