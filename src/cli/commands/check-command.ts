import type { BuiltSite } from "../../core/index.ts";
import { count } from "../report.ts";
import { DRAFTS_OPTION, SiteCommand, pagesOf } from "./site-command.ts";

/** Builds everything a build does, but writes nothing, so it can run in CI on every change. */
export class CheckCommand extends SiteCommand {
  readonly name = "check";
  readonly summary = "Check the site for problems, without writing anything";
  readonly options = { drafts: DRAFTS_OPTION } as const;
  protected readonly whenStopped = "";

  protected async finish(site: BuiltSite): Promise<string> {
    return `Checked ${count(pagesOf(site), "page")}`;
  }
}
