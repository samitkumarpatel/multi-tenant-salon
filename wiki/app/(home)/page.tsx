import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 gap-4 px-6">
      <h1 className="text-3xl font-bold">Salon SaaS Help Center</h1>
      <p className="text-fd-muted-foreground max-w-xl mx-auto">
        Step-by-step guides for running your salon on the platform — setting up your
        salon, services and staff, taking bookings, selling online, memberships,
        payments, and the front desk.
      </p>
      <p>
        <Link href="/docs" className="font-medium underline">
          Browse the guides
        </Link>
      </p>
    </div>
  );
}
