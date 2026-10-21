import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { isAuthConfigured } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-12">
      <div className="panel space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl">
            Admin <span className="text-gold-gradient">Login</span>
          </h1>
          <p className="mt-1 text-sm text-muted">ZeeDude leaderboard control panel</p>
        </div>
        <Suspense>
          <LoginBody />
        </Suspense>
      </div>
    </div>
  );
}

// Checked per request so env vars set after the build are picked up.
async function LoginBody() {
  await connection();
  if (isAuthConfigured()) return <LoginForm />;
  return (
    <p className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
      Admin login isn&apos;t set up yet. Run <code className="text-text">npm run admin:password -- &quot;your password&quot;</code>{" "}
      and restart the server. See the README for production setup.
    </p>
  );
}
