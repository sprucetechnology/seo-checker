/**
 * Central entry to push SEO metadata updates back to a CMS.
 * Currently supports AEM via Sling POST servlet but designed to be extended
 * to WordPress and Drupal in the future.
 */

import { CmsOptions, PageMetadata } from "../types.ts";
import { pushToAem } from "./pushAem.ts";

export async function pushToCms(options: CmsOptions, pages: PageMetadata[]) {
  switch (options.type) {
    case "aem":
      await pushToAem(options, pages);
      break;
    case "wordpress":
      console.warn("WordPress push not implemented yet. Skipping.");
      break;
    case "drupal":
      console.warn("Drupal push not implemented yet. Skipping.");
      break;
    default:
      throw new Error(`Unsupported CMS type: ${options.type}`);
  }
} 