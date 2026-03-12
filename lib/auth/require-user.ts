import type { User } from "@supabase/supabase-js";
import { getUser } from "./get-user";

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

