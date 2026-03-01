import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import WelcomeModal from '@/components/layout/WelcomeModal'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      <WelcomeModal />
    </div>
  )
}
