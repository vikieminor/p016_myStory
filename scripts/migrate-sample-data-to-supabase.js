import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries((await readFile(path.join(root, ".env"), "utf8"))
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith("#"))
  .map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL과 SUPABASE_SECRET_KEY를 .env에 설정하세요.");

const tables = [
  ["question_groups", "question-groups.json", (row) => ({ id: row.id, name: row.name, description: row.description || "", image_path: row.imagePath || null, sort_order: row.sortOrder, created_at: row.createdAt, updated_at: row.updatedAt })],
  ["questions", "questions.json", (row) => ({ id: row.id, content: row.content, description: row.description || "", question_group_id: row.questionGroupId, sort_order: row.sortOrder, is_active: row.isActive, created_at: row.createdAt, updated_at: row.updatedAt })],
  ["book_types", "book-types.json", (row) => ({ id: row.id, name: row.name, description: row.description || "", cover_image: row.coverImage, cover_color: row.coverColor || "#00BC3C", text_color: row.textColor || "#FFFFFF", sort_order: row.sortOrder, is_active: row.isActive, created_at: row.createdAt, updated_at: row.updatedAt })],
  ["book_type_question_groups", "book-type-question-groups.json", (row) => ({ book_type_id: row.bookTypeId, question_group_id: row.questionGroupId })],
  ["my_books", "my-books.json", (row) => ({ id: row.id, book_type_id: row.bookTypeId, title: row.title, sender: row.sender || "", receiver: row.receiver || "", introduction: row.introduction || "", is_self: row.isSelf === true, status: row.status, created_at: row.createdAt, updated_at: row.updatedAt, published_at: row.publishedAt || null })],
  ["my_book_answers", "my-book-answers.json", (row) => ({ id: row.id, my_book_id: row.myBookId, question_id: row.questionId, answer: row.answer || "", is_final: row.isFinal, created_at: row.createdAt, updated_at: row.updatedAt })],
  ["publications", "publications.json", (row) => ({ id: row.id, my_book_id: row.myBookId, cover_style: row.coverStyle, created_at: row.createdAt })],
];

async function request(table, options = {}) {
  const response = await fetch(`${url}/rest/v1/${table}${options.query || ""}`, {
    method: options.method || "GET",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw new Error(`${table}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

const counts = new Map(await Promise.all(tables.map(async ([table]) => [table, (await request(table, { query: "?select=*&limit=1" })).length])));

for (const [table, file, map] of tables) {
  if (counts.get(table)) {
    console.log(`${table}: 기존 데이터가 있어 건너뜀`);
    continue;
  }

  let rows = JSON.parse(await readFile(path.join(root, "data", file), "utf8")).map(map);
  if (table === "my_book_answers") {
    const [books, questions] = await Promise.all([
      request("my_books", { query: "?select=id" }),
      request("questions", { query: "?select=id" }),
    ]);
    const bookIds = new Set(books.map((row) => row.id));
    const questionIds = new Set(questions.map((row) => row.id));
    rows = rows.filter((row) => bookIds.has(row.my_book_id) && questionIds.has(row.question_id));
  }
  if (!rows.length) {
    console.log(`${table}: 복원할 호환 데이터가 없음`);
    continue;
  }
  await request(table, { method: "POST", headers: { Prefer: "return=minimal" }, body: rows });
  console.log(`${table}: ${rows.length}건 이관 완료`);
}
console.log("누락된 Supabase 샘플 데이터 복원을 완료했습니다.");
