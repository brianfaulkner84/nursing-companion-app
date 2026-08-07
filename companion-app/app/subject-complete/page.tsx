import Link from "next/link";

export default function SubjectComplete({ searchParams }: { searchParams: { subject?: string } }) {
  const subject = searchParams.subject ?? "this subject";

  return (
    <div>
      <h1>{subject}: complete</h1>
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p style={{ margin: 0 }}>
          You&apos;ve completed all the questions we have for this subject right now. Check back in 3 to 7
          business days for more.
        </p>
      </div>
      <Link href="/dashboard">
        <button className="btn btn-primary">Back to dashboard</button>
      </Link>
    </div>
  );
}
