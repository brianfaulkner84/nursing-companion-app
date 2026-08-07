import Link from "next/link";

export const metadata = { title: "How LPN Launchpad works" };

export default function Help() {
  return (
    <div>
      <h1>How LPN Launchpad works</h1>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        A quick walkthrough of every screen in the app, in the order you&apos;ll actually use them.
      </p>

      <div className="help-section">
        <h2>1. Sign in and access</h2>
        <p>
          Sign in with your Google account, no separate password to remember. New accounts start
          on a 14-day free trial. After that, access continues either through a paid
          subscription or a beta code, entered on the Subscribe screen.
        </p>
      </div>

      <div className="help-section">
        <h2>2. The dashboard</h2>
        <p>
          Your home base after signing in. The bar at the top tracks your overall progress across
          every published question. Below it, three tabs let you browse the question bank three
          different ways:
        </p>
        <p>
          <strong>By module</strong> groups questions the same way your LPN Launchpad study books
          are organized, so it matches material you&apos;re already studying from.
        </p>
        <p>
          <strong>By NCLEX topic</strong> groups questions by the official NCLEX-PN test plan
          category instead, useful once you&apos;re studying for the exam itself rather than a
          specific class.
        </p>
        <p>
          <strong>By question type</strong> separates multiple choice from select-all-that-apply
          (SATA), so you can drill one format specifically.
        </p>
        <p>Tap any tile to start a practice session on just that subject, module, or category.</p>
      </div>

      <div className="help-section">
        <h2>3. Taking a quiz</h2>
        <p>
          Answer the question, then submit. You&apos;ll immediately see whether you were right,
          the correct answer, and the rationale behind it. Open the strategy walkthrough for a
          step-by-step breakdown of how to work through that type of question, and, where one
          applies, a critical-thinking framework you can reuse on similar questions later.
        </p>
      </div>

      <div className="help-section">
        <h2>4. Raise your hand</h2>
        <p>
          Still confused after reading the rationale and strategy walkthrough? Click{" "}
          <strong>Raise your hand</strong> on the answer screen, add a note about what&apos;s
          tripping you up, and send it. An instructor reviews it and replies with a specific
          explanation, not a form response. Replies show up in your <Link href="/inbox">Inbox</Link>,
          not your email, so check back there in a day or two.
        </p>
        <p>
          It&apos;s a real conversation, not a one-time message. If the reply doesn&apos;t
          fully clear things up, reply again from your Inbox and the instructor sees it the
          same way. Each message you send gets a reply in 1 to 2 days. You can also delete any
          message you sent, if you want to take it back.
        </p>
        <p>
          Raise your hand is for your own confusion. If you think a question itself is wrong,
          for example the marked answer looks incorrect or the rationale doesn&apos;t match, use{" "}
          <strong>Flag this question</strong> on the same answer screen instead. No reply is
          expected, it just goes straight to the instructor for a content fix.
        </p>
      </div>

      <div className="help-section">
        <h2>5. Build a review</h2>
        <p>
          The <strong>Build a review</strong> page lets you combine subjects into a custom
          practice session instead of studying one subject at a time. Quick-start buttons cover
          common combinations; you can also save your own named set (like &quot;Exam 2
          Review&quot;) to reuse later without rebuilding it.
        </p>
      </div>

      <div className="help-section">
        <h2>6. Progress</h2>
        <p>
          Shows your mastery percentage per subject, based on the questions you&apos;ve actually
          answered. If you want a clean slate on a subject, you can reset just that subject&apos;s
          progress without touching the rest.
        </p>
      </div>

      <div className="help-section">
        <h2>7. Inbox</h2>
        <p>
          Every question you&apos;ve raised your hand on lives here, along with the full back
          and forth with the instructor. Open items show &quot;Waiting for a reply&quot;;
          answered ones show &quot;Answered&quot; and the full conversation so far. Keep
          replying from the same thread as long as you need to.
        </p>
      </div>

      <div className="help-section">
        <h2>8. Feedback</h2>
        <p>
          The <strong>Feedback</strong> link in the header is for the app itself, not a specific
          question: bugs, confusing screens, ideas for what would make studying easier. No email
          is collected, it goes straight to the instructor.
        </p>
      </div>

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
