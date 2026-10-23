import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { path: "/", changeFrequency: "hourly" as const, priority: 1 },
    { path: "/history", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/hall-of-fame", changeFrequency: "weekly" as const, priority: 0.6 },
    { path: "/crew", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/rules", changeFrequency: "monthly" as const, priority: 0.5 },
  ].map(({ path, ...rest }) => ({ url: new URL(path, site.url).toString(), ...rest }));
}
