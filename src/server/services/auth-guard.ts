import { redirect } from "next/navigation";

import { auth } from "@/server/auth";

/** Usar em Server Components/Actions de `(app)/*` — nunca confiar só no middleware. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/** Usar em Server Components/Actions de `admin/*`. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/home");
  }
  return user;
}
