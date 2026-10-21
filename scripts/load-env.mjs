// Side-effect import: loads .env files the way Next.js does (see
// project-env.mjs). Import it FIRST in scripts that use @prisma/client:
// importing @prisma/client loads .env by itself, and anything it sets would
// then look like a real environment variable and override .env.local and friends.
//
//   import "../scripts/load-env.mjs";
//   import { PrismaClient } from "@prisma/client";

import { envMode, loadProjectEnv } from "./project-env.mjs";

loadProjectEnv(envMode(process.argv));
