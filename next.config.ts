import type { NextConfig } from "next";
import { rendererCsp } from "./lib/player/csp";
import {withWorkflow} from "workflow/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"no-referrer"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}]},{ source: "/renderer.html", headers: [
      { key: "Content-Security-Policy", value: rendererCsp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ] }];
  },
};
export default withWorkflow(nextConfig);
