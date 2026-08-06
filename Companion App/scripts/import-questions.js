// Imports questions.json into the Supabase questions table.
// Usage: node scripts/import-questions.js path/to/questions.json
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-questions.js path/to/questions.json");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const questions = JSON.parse(fs.readFileSync(file, "utf-8"));
  const { data, error } = await supabase.from("questions").insert(questions).select("id");
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Imported ${data.length} questions.`);
}

main();
