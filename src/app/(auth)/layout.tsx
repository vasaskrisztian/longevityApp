export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Longevity App</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your sleep, recovery and activity, in one calm dashboard.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
