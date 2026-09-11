import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="auth-shell">
      <AuthForm mode="login" nextPath={next || "/lobby"} />
    </main>
  );
}
