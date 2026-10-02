import { account } from './account';
import { auth } from './auth';
import { blog } from './blog';
import { cart } from './cart';
import { catalog } from './catalog';
import { checkout } from './checkout';
import { cmsappearance } from './cmsappearance';
import { cmscatalog } from './cmscatalog';
import { cmscommon } from './cmscommon';
import { cmscontent } from './cmscontent';
import { cmscustomers } from './cmscustomers';
import { cmsdash } from './cmsdash';
import { cmsnav } from './cmsnav';
import { cmsorders } from './cmsorders';
import { cmspromo } from './cmspromo';
import { cmssettings } from './cmssettings';
import { cmsshared } from './cmsshared';
import { contact } from './contact';
import { footer } from './footer';
import { header } from './header';
import { home } from './home';
import { login } from './login';
import { pages } from './pages';
import { tools } from './tools';

/**
 * Merged English dictionary — flat, surface-prefixed keys. English defines the
 * shape: every key here MUST exist in `../sq` (TypeScript enforces it).
 */
export const en = {
  ...account,
  ...auth,
  ...blog,
  ...cart,
  ...catalog,
  ...checkout,
  ...cmsappearance,
  ...cmscatalog,
  ...cmscommon,
  ...cmscontent,
  ...cmscustomers,
  ...cmsdash,
  ...cmsnav,
  ...cmsorders,
  ...cmspromo,
  ...cmssettings,
  ...cmsshared,
  ...contact,
  ...footer,
  ...header,
  ...home,
  ...login,
  ...pages,
  ...tools,
};

export type Dictionary = typeof en;
