import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "../actions";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <span className="rounded-md bg-magenta/15 px-2 py-1 text-xs font-bold tracking-widest text-magenta uppercase">Admin</span>
        <AdminNav />
        <form action={logoutAction} className="ml-auto">
          <button type="submit" className="btn">
            Log out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
