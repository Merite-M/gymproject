export function generateStaticParams() {
  return [{ id: '1' }]; // Mock ID for static export to pass
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
