import { CmsOptions, PageMetadata } from "../types.ts";
import * as colors from "https://deno.land/std/fmt/colors.ts";

// Utility to map public URL to JCR path
function urlToJcrPath(pageUrl: string, opts: CmsOptions): string {
  if (!opts.authorUrl) throw new Error("authorUrl is required for AEM push");
  // Derive the path *inside* AEM from the public URL.
  // Strategy: take the URL pathname (everything after the host), strip .html, then (optionally)
  // prefix with sitePathPrefix unless it is already present.
  const pathname = new URL(pageUrl).pathname.replace(/\.html?$/, "");

  if (!opts.sitePathPrefix) return pathname;

  // Case 1: pathname already contains the full prefix (e.g. /content/site/...)
  if (pathname.startsWith(opts.sitePathPrefix)) return pathname;

  // Case 2: pathname starts with the *public* part of the site prefix (e.g. /site/...)
  const publicPrefix =
    "/" + opts.sitePathPrefix.split("/").filter(Boolean).slice(-1)[0]; // last segment after /content

  if (pathname.startsWith(publicPrefix)) {
    return `${opts.sitePathPrefix}${pathname.slice(publicPrefix.length)}`;
  }

  // Fallback: just prepend the full prefix
  const prefix = opts.sitePathPrefix.endsWith("/")
    ? opts.sitePathPrefix.slice(0, -1)
    : opts.sitePathPrefix;
  const pathNoSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${prefix}${pathNoSlash}`;
}

async function patchNode(
  opts: CmsOptions,
  jcrPath: string,
  props: Record<string, string>
) {
  // Write properties to the jcr:content child of the page.
  const endpoint = `${opts.authorUrl}${jcrPath}${jcrPath.endsWith("/jcr:content") ? "" : "/jcr:content"}`;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(props)) {
    if (k === 'cq:tags' && Array.isArray(v)) {
      // Special handling: append each tag as its own field
      for (const tag of v) {
        body.append(k, tag);
      }
    } else {
      body.append(k, String(v));
    }
  }
  console.log(colors.yellow(`AEM PATCH: ${endpoint}`));
  console.log(colors.yellow(`AEM PROPS: ${JSON.stringify(props, null, 2)}`));
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${opts.username}:${opts.password}`)}`,
    },
    body,
  });
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch (_) {}
  if (!res.ok) {
    console.error(colors.red(`AEM PATCH ERROR: ${endpoint} - ${res.status} ${res.statusText}\n${bodyText}`));
    throw new Error(`Failed to patch ${endpoint}: ${res.status} ${res.statusText}`);
  } else {
    console.log(colors.gray(`AEM PATCH RESPONSE: ${bodyText}`));
  }
}

async function replicate(opts: CmsOptions, jcrPath: string) {
  if (!opts.replicateAfterUpdate) return;
  const endpoint = `${opts.authorUrl}${jcrPath}`;
  const body = new URLSearchParams({ ":operation": "replicate" });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${opts.username}:${opts.password}`)}`,
    },
    body,
  });
  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (_) {}
    console.warn(colors.red(`Replication failed for ${jcrPath}: ${res.status}\n${bodyText}`));
  }
}

async function tagExists(opts: CmsOptions, tag: string): Promise<boolean> {
  const tagPath = `${opts.tagNamespace?.replace(/\/$/, "")}/${tag}`;
  const url = `${opts.authorUrl}${tagPath}.tidy.json`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${btoa(`${opts.username}:${opts.password}`)}`,
      },
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function createTag(opts: CmsOptions, tag: string) {
  // Use lowercase/camelcase for node name, but keep jcr:title as original
  const tagNodeName = tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const tagNamespacePath = opts.tagNamespace?.replace(/\/$/, "");
  const url = `${opts.authorUrl}${tagNamespacePath}`;
  const body = new URLSearchParams();
  body.append(`./${tagNodeName}/jcr:primaryType`, "cq:Tag");
  body.append(`./${tagNodeName}/jcr:title`, tag);
  body.append(`./${tagNodeName}/sling:resourceType`, "cq/tagging/components/tag");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${opts.username}:${opts.password}`)}`,
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to create tag ${tag}: ${res.status} ${msg}`);
  }
}

export async function pushToAem(opts: CmsOptions, pages: PageMetadata[]) {
  console.log(
    colors.blue(`Pushing metadata to AEM (${pages.length} pages)...`)
  );
  const defaultMap = {
    title: "jcr:title",
    description: "cq:description",
    keywords: "cq:keywords",
  };
  const propertyMap = opts.propertyMap || defaultMap;

  // Only consider fields present in propertyMap
  const want = opts.updateFields?.length
    ? opts.updateFields.filter(f => propertyMap[f])
    : Object.keys(propertyMap);

  for (const page of pages) {
    try {
      const jcrPath = urlToJcrPath(page.url, opts);
      const props: Record<string, string> = {};

      if (want.includes("title") && page.suggestedTitle) {
        props[propertyMap.title] = page.suggestedTitle;
      }
      if (want.includes("description") && page.suggestedDescription) {
        props[propertyMap.description] = page.suggestedDescription;
      }
      if (want.includes("keywords") && page.suggestedKeywords) {
        // Sling POST convention: send as tag@TypeHint=String[] and multiple tag fields
        const tags = page.suggestedKeywords
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        props[`${propertyMap.keywords}@TypeHint`] = "String[]";
        if (propertyMap.keywords === "cq:tags" && opts.tagNamespace) {
          const tagNamespaceId = opts.tagNamespace?.split("/").pop();
          const tagNodeNames: string[] = [];
          for (const tag of tags) {
            const tagNodeName = tag
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            tagNodeNames.push(tagNodeName);
            const exists = await tagExists(opts, tagNodeName);
            if (!exists) {
              console.log(colors.yellow(`Creating tag: ${opts.tagNamespace}/${tagNodeName}`));
              await createTag(opts, tagNodeName);
            } else {
              console.log(colors.gray(`Tag exists: ${opts.tagNamespace}/${tagNodeName}`));
            }
          }
          // Assign as <namespace>:<tag-node-name>
          (props as Record<string, unknown>)["cq:tags"] = tagNodeNames.map(n => `${tagNamespaceId}:${n}`);
        } else {
          props[propertyMap.keywords] = tags.join(", ");
        }
      }

      if (Object.keys(props).length === 0) continue;
      await patchNode(opts, jcrPath, props);
      await replicate(opts, jcrPath);
      console.log(colors.green(`Updated ${page.url}`));
    } catch (err) {
      console.error(
        colors.red(
          `Error updating ${page.url}: ${
            err instanceof Error ? err.message : err
          }`
        )
      );
    }
    console.log("--------------------------------");
  }
  console.log(colors.green("AEM push complete"));
}
