export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-lg">
      <div className="w-full max-w-[380px]">{children}</div>
    </main>
  );
}
