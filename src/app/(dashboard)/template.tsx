/** Se remonta en cada navegación: da una entrada sutil a cada pantalla. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
