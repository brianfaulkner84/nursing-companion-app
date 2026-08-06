import Link from "next/link";

export default function SubjectComplete({ searchParams }: { searchParams: { subject?: string } }) {
  const subject = searchParams.subject ?? "this subject";

  return (
    <div>
      <h1>{subject}: complete</h1>
      <div style={{ border: "1px dashed #ccc", borderRadius: 6, padding: "1rem", margin: "1rem 0" }}>
        You&apos;ve completed all the questions we have for this subject right now. Check back in 3 to 7 business days for more.
      </div>
      <Link href="/dashboard">
        <button style={{ width: "100%", padding: "0.75rem" }}>Back to dashboard</button>
      </Link>
    </div>
  );
}
