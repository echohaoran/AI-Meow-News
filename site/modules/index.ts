// The modules this site runs (modules/<name>/, see docs/architecture.md). A module has a line in each list
// it has an entry for: here for its addresses (module.ts), in server.ts for its backend, in web.ts for its
// pages' parts. Each list keeps the order its entries appear in on the site.
import type { ModuleDeclaration } from "@aihot/contracts/modules";
import rankings from "@aihot/openrouter-rankings/module";
import companyMarks from "../../modules/company-marks/module.ts";
import chineseReading from "../../modules/chinese-reading/module.ts";

export const MODULES: readonly ModuleDeclaration[] = [rankings, companyMarks, chineseReading];
