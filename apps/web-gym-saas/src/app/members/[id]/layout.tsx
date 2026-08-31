import { supabase } from "@/lib/supabase";

export async function generateStaticParams() {
  return [{ id: "mock-id" }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
