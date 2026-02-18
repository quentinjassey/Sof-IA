export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Subtle geometric background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/[0.03]" />
        <div className="absolute -bottom-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/[0.02]" />
        <div className="absolute top-1/3 left-1/4 h-1 w-24 bg-border/60" />
        <div className="absolute bottom-1/4 right-1/3 h-20 w-px bg-border/40" />
      </div>

      <div className="relative z-10 w-full max-w-[26rem]">
        {/* SOF'IA Branding */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/sofia-logo.webp"
              alt="Sof'IA"
              className="h-auto w-56 object-contain"
            />
          </div>
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Pré-analyse documentaire pour le commissaire aux comptes
          </p>
        </div>

        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-16 text-center text-xs tracking-wide text-muted-foreground/60">
        Sof&apos;IA v0.1.0 &mdash; POC HackAudit 2026
      </p>
    </div>
  )
}
