import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const NAVER_REDIRECT_URI = process.env.NAVER_REDIRECT_URI || "";
const GIFT_CODE_PEPPER = process.env.GIFT_CODE_PEPPER || "";
const GIFT_SESSION_COOKIE = "gift_session";
const GIFT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GIFT_SESSION_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GIFT_LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const GIFT_LOGIN_RATE_LIMIT = 10;
const giftLoginAttempts = new Map();
const giftCreationLocks = new Set();
const HOME_BANNER_BUCKET = "home-banners";
const COVER_IMAGE_BUCKET = "cover-images";
const DEFAULT_RECIPIENT_MESSAGE = "내 곁에 있어 주셔서 감사합니다.\n꼭 하고 싶었던 말을 이제서야 드립니다.\n당신을 사랑합니다.";
// 원격 DB는 스키마 적용 뒤 명시적으로 활성화한다. 키만 있는 경우에는
// 기존 data/ 샘플을 계속 보여 주어 빈 원격 DB로 데이터가 사라진 듯 보이지 않게 한다.
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY && process.env.USE_SUPABASE === "true");
const NAVER_STATE_COOKIE = "naver_oauth_state";
const NAVER_STATE_TTL_SECONDS = 10 * 60;
const supabaseAdmin = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }) : null;
const DATA_DIR = path.join(__dirname, "data");
const MOMENTS_PDF_TITLE_FONT = path.join(__dirname, "node_modules/@fontsource/tiny5/files/tiny5-latin-400-normal.woff");
const MOMENTS_PDF_AUTHOR_FONT = path.join(__dirname, "node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff");
const MOMENTS_PDF_BODY_FONT = path.join(__dirname, "node_modules/@noonnu/ko-pub-batang/fonts/kopub-batang-400.ttf");

const tables = {
  groups: { file: "question-groups.json", table: "question_groups", map: groupMap },
  questions: { file: "questions.json", table: "questions", map: questionMap },
  questionBookTypes: { file: "question-book-types.json", table: "question_book_types", map: questionBookTypeMap },
  bookTypes: { file: "book-types.json", table: "book_types", map: bookTypeMap },
  bookTypeGroups: { file: "book-type-question-groups.json", table: "book_type_question_groups", map: linkMap },
  books: { file: "my-books.json", table: "my_books", map: bookMap },
  answers: { file: "my-book-answers.json", table: "my_book_answers", map: answerMap },
  publications: { file: "publications.json", table: "publications", map: publicationMap },
  gifts: { file: "gifts.json", table: "gifts", map: giftMap },
  giftSessions: { file: "gift-sessions.json", table: "gift_sessions", map: giftSessionMap },
  coverColors: { file: "cover-colors.json", table: "cover_colors", map: coverColorMap },
  coverImages: { file: "cover-images.json", table: "cover_images", map: coverImageMap },
  homeReviews: { file: "home-reviews.json", table: "home_reviews", map: homeReviewMap },
  homeBanners: { file: "home-banners.json", table: "home_banners", map: homeBannerMap },
  momentAuthors: { file: "moment-authors.json", table: "moment_authors", map: momentAuthorMap },
  momentSlots: { file: "moment-time-slots.json", table: "moment_time_slots", map: momentSlotMap },
  momentEntries: { file: "moment-entries.json", table: "moment_entries", map: momentEntryMap },
};

const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/auth/naver") return void await naverStartRoute(req, res);
    if (req.method === "GET" && url.pathname === "/auth/naver/callback") return void await naverCallbackRoute(req, res, url);
    if (url.pathname.startsWith("/api/")) return void await handleApi(req, res, url);
    if (url.pathname.startsWith("/print/")) return void await renderBookOutput(req, res, Number(url.pathname.split("/").pop()), true);
    if (url.pathname.startsWith("/preview/")) return void await renderBookOutput(req, res, Number(url.pathname.split("/").pop()), false);
    await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "서버 오류가 발생했습니다." });
  }
});

server.listen(PORT, HOST, () => console.log(`My Story running at http://${HOST}:${PORT} (${USE_SUPABASE ? "Supabase" : "local JSON"})`));

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const pathName = url.pathname;
  const body = ["POST", "PUT", "PATCH"].includes(method) ? await readJsonBody(req) : {};

  if (method === "GET" && pathName === "/api/bootstrap") return sendJson(res, 200, await dashboard());
  if (method === "GET" && pathName === "/api/auth/config") return authConfigRoute(res);
  if (method === "GET" && pathName === "/api/auth/me") return void await authMeRoute(req, res);
  if ((method === "GET" || method === "PUT") && pathName === "/api/auth/profile") return void await authProfileRoute(req, res, method, body);
  if (method === "GET" && pathName === "/api/account/gifts") return void await accountGiftsRoute(req, res);
  if (method === "POST" && pathName === "/api/gifts") return void await createGiftRoute(req, res, body);
  if (method === "POST" && pathName === "/api/gifts/login") return void await giftLoginRoute(req, res, body);
  if (method === "POST" && pathName === "/api/gifts/logout") return void await giftLogoutRoute(req, res);
  if (method === "GET" && pathName === "/api/gifts/session") return void await giftSessionRoute(req, res);
  if (method === "GET" && pathName === "/api/home") return sendJson(res, 200, { banners: await presentHomeBanners(false), moments: await presentCurrentMoment(), reviews: await presentHomeReviews(false) });
  if (method === "GET" && pathName === "/api/cover-options") return sendJson(res, 200, await presentCoverOptions());
  if (method === "GET" && /^\/api\/home\/moments\/[^/]+$/.test(pathName)) return sendJson(res, 200, await presentPublicMoments(decodeURIComponent(pathName.split("/").pop())));

  if (pathName === "/api/admin/cover-colors" || /^\/api\/admin\/cover-colors\/\d+$/.test(pathName)) {
    if (!(await requireAdmin(req, res))) return;
    const match = pathName.match(/^\/api\/admin\/cover-colors\/(\d+)$/);
    return void await coverColorRoute(res, method, match ? Number(match[1]) : null, body);
  }
  if (pathName === "/api/admin/cover-images" || /^\/api\/admin\/cover-images\/\d+$/.test(pathName)) {
    if (!(await requireAdmin(req, res))) return;
    const match = pathName.match(/^\/api\/admin\/cover-images\/(\d+)$/);
    return void await coverImageRoute(res, method, match ? Number(match[1]) : null, body);
  }
  if (pathName === "/api/admin/cover-images/upload") {
    if (!(await requireAdmin(req, res))) return;
    return void await coverImageUploadRoute(res, method, body);
  }

  if (pathName === "/api/admin/home/banners" || /^\/api\/admin\/home\/banners\/[^/]+$/.test(pathName)) {
    if (!(await requireAdmin(req, res))) return;
    const bannerMatch = pathName.match(/^\/api\/admin\/home\/banners\/([^/]+)$/);
    return void await homeBannerRoute(res, method, bannerMatch ? decodeURIComponent(bannerMatch[1]) : null, body);
  }
  if (pathName === "/api/admin/home/banner-upload") {
    if (!(await requireAdmin(req, res))) return;
    return void await homeBannerUploadRoute(res, method, body);
  }
  if (pathName === "/api/admin/question-groups/image-upload") {
    if (!(await requireAdmin(req, res))) return;
    return void await questionGroupImageUploadRoute(res, method, body);
  }

  if (pathName === "/api/admin/moment-authors" || /^\/api\/admin\/moment-authors\/[^/]+$/.test(pathName)) {
    if (!(await requireAdmin(req, res))) return;
    const authorMatch = pathName.match(/^\/api\/admin\/moment-authors\/([^/]+)$/);
    return void await momentAuthorRoute(res, method, authorMatch ? decodeURIComponent(authorMatch[1]) : null, body);
  }

  if (pathName === "/api/admin/home/reviews" || /^\/api\/admin\/home\/reviews\/\d+$/.test(pathName)) {
    if (!(await requireAdmin(req, res))) return;
    const reviewMatch = pathName.match(/^\/api\/admin\/home\/reviews\/(\d+)$/);
    return void await homeReviewRoute(res, method, reviewMatch ? Number(reviewMatch[1]) : null, body);
  }

  if (pathName === "/api/author/moments" || /^\/api\/author\/moments\/\d+$/.test(pathName)) {
    const user = await authenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "작가 인증이 필요합니다." });
    const author = await getActiveMomentAuthor(user);
    if (!author) return sendJson(res, 403, { error: "Moments 작성 권한이 없습니다." });
    const entryMatch = pathName.match(/^\/api\/author\/moments\/(\d+)$/);
    return void await authorMomentRoute(res, method, entryMatch ? Number(entryMatch[1]) : null, body, user);
  }

  if (method === "GET" && pathName === "/api/author/moments/pdf") {
    const user = await authenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "작가 인증이 필요합니다." });
    const author = await getActiveMomentAuthor(user);
    if (!author) return sendJson(res, 403, { error: "Moments 작성 권한이 없습니다." });
    return void await authorMomentsPdfRoute(res, author);
  }

  if (method === "GET" && pathName === "/api/author/moment-slots") {
    const user = await authenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "작가 인증이 필요합니다." });
    const author = await getActiveMomentAuthor(user);
    if (!author) return sendJson(res, 403, { error: "Moments 작성 권한이 없습니다." });
    const slots = await list("momentSlots");
    return sendJson(res, 200, { takenTimes: slots.filter((slot) => slot.isActive !== false).map((slot) => slot.slotTime), myTimes: slots.filter((slot) => slot.authorId === author.id && slot.isActive !== false).map((slot) => slot.slotTime) });
  }

  if (pathName === "/api/admin/home/moments" || /^\/api\/admin\/home\/moments\/\d+$/.test(pathName)) {
    if (!(await requireAdmin(req, res))) return;
    const entryMatch = pathName.match(/^\/api\/admin\/home\/moments\/(\d+)$/);
    return void await adminMomentRoute(res, method, entryMatch ? Number(entryMatch[1]) : null, body);
  }

  if (pathName === "/api/question-groups") {
    if (method === "GET") return sendJson(res, 200, await presentGroups(url.searchParams.get("search") || ""));
    if (method === "POST") return void await createGroupRoute(res, body);
  }
  const groupMatch = pathName.match(/^\/api\/question-groups\/(\d+)$/);
  if (groupMatch) return void await groupRoute(res, method, Number(groupMatch[1]), body);

  if (pathName === "/api/questions") {
    if (method === "GET") return sendJson(res, 200, await presentQuestions(url.searchParams));
    if (method === "POST") return void await createQuestionRoute(res, body);
  }
  const questionMatch = pathName.match(/^\/api\/questions\/(\d+)(\/toggle-active)?$/);
  if (questionMatch) return void await questionRoute(res, method, Number(questionMatch[1]), Boolean(questionMatch[2]), body);

  if (pathName === "/api/book-types") {
    if (method === "GET") return sendJson(res, 200, await presentBookTypes());
    if (method === "POST") return void await createBookTypeRoute(res, body);
  }
  const typeMatch = pathName.match(/^\/api\/book-types\/(\d+)$/);
  if (typeMatch) return void await bookTypeRoute(res, method, Number(typeMatch[1]), body);

  if (pathName === "/api/books") {
    const access = await authenticateRequest(req, res);
    if (!access) return sendJson(res, 401, { error: "로그인이 필요합니다." });
    if (method === "GET") return sendJson(res, 200, access.kind === "account" ? await presentBooks(access.user.id) : await presentBooksForGift(access.gift.id));
    if (access.kind !== "account") return sendJson(res, 403, { error: "계정 로그인이 필요합니다." });
    if (method === "POST") return void await createBookRoute(res, body, access.user);
  }
  const bookMatch = pathName.match(/^\/api\/books\/(\d+)(?:\/(outline|answers|publish|cover))?$/);
  if (bookMatch) {
    const access = await authenticateRequest(req, res);
    if (!access) return sendJson(res, 401, { error: "로그인이 필요합니다." });
    return void await bookRoute(res, method, Number(bookMatch[1]), bookMatch[2], body, access);
  }
  if (method === "GET" && pathName === "/api/admin/books") {
    if (!(await requireAdmin(req, res))) return;
    return sendJson(res, 200, await presentBooks());
  }
  if (method === "GET" && pathName === "/api/admin/gifts") {
    if (!(await requireAdmin(req, res))) return;
    return sendJson(res, 200, await presentAdminGifts());
  }

  sendJson(res, 404, { error: "API 경로를 찾을 수 없습니다." });
}

async function createGroupRoute(res, body) {
  const groups = await list("groups");
  const error = validateGroup(body, groups);
  if (error) return sendJson(res, 400, { error });
  const group = await create("groups", { name: body.name.trim(), description: String(body.description || "").trim(), imagePath: String(body.imagePath || "").trim(), sortOrder: groups.length + 1 });
  await reorderQuestionGroups(group.id, groups.length + 1, [...groups, group]);
  sendJson(res, 201, await presentGroup(await get("groups", group.id)));
}

async function groupRoute(res, method, id, body) {
  const group = await get("groups", id);
  if (!group) return sendJson(res, 404, { error: "질문그룹을 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentGroup(group, true));
  if (method === "PUT") {
    const error = validateGroup(body, await list("groups"), id);
    if (error) return sendJson(res, 400, { error });
    const imagePath = body.imagePath === undefined ? group.imagePath || "" : String(body.imagePath || "").trim();
    const updated = await update("groups", id, { name: body.name.trim(), description: String(body.description || "").trim(), imagePath, sortOrder: Number(body.sortOrder) });
    if (updated.imagePath !== group.imagePath) await removeHomeBannerImage(group.imagePath);
    await reorderQuestionGroups(id, Number(body.sortOrder));
    return sendJson(res, 200, await presentGroup(await get("groups", id)));
  }
  if (method === "DELETE") {
    const inUse = (await list("questions")).some((item) => item.questionGroupId === id) || (await list("bookTypeGroups")).some((item) => item.questionGroupId === id);
    if (inUse) return sendJson(res, 409, { error: "연결된 질문 또는 북타입이 있는 질문그룹은 삭제할 수 없습니다." });
    await removeHomeBannerImage(group.imagePath);
    await remove("groups", id);
    await reorderQuestionGroups(null, null);
    return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function createQuestionRoute(res, body) {
  const error = await validateQuestion(body);
  if (error) return sendJson(res, 400, { error });
  const questions = await list("questions");
  const groupQuestions = questions.filter((question) => question.questionGroupId === Number(body.questionGroupId));
  const desiredOrder = Math.min(Math.max(Number(body.sortOrder), 1), groupQuestions.length + 1);
  const question = await create("questions", normalQuestion({ ...body, sortOrder: desiredOrder }));
  await reorderQuestions(question.id, desiredOrder, question.questionGroupId, [...questions, question]);
  await setQuestionBookTypes(question.id, body.bookTypeIds);
  sendJson(res, 201, await presentQuestion(question));
}

async function questionRoute(res, method, id, toggle, body) {
  const question = await get("questions", id);
  if (!question) return sendJson(res, 404, { error: "질문을 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentQuestion(question));
  if (method === "PATCH" && toggle) return sendJson(res, 200, await presentQuestion(await update("questions", id, { isActive: !question.isActive })));
  if (method === "PUT") {
    const error = await validateQuestion(body); if (error) return sendJson(res, 400, { error });
    const desiredOrder = Number(body.sortOrder);
    const previousQuestionGroupId = question.questionGroupId;
    const updated = await update("questions", id, normalQuestion(body));
    if (previousQuestionGroupId !== updated.questionGroupId) await reorderQuestions(null, null, previousQuestionGroupId);
    await reorderQuestions(id, desiredOrder, updated.questionGroupId);
    await setQuestionBookTypes(id, body.bookTypeIds);
    return sendJson(res, 200, await presentQuestion(updated));
  }
  if (method === "DELETE") {
    const used = (await list("answers")).some((answer) => answer.questionId === id);
    if (used) return sendJson(res, 409, { error: "사용 중인 질문은 삭제할 수 없습니다. 미사용으로 전환하세요." });
    await remove("questions", id); await reorderQuestions(null, null, question.questionGroupId); return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}


async function createBookTypeRoute(res, body) {
  const error = await validateBookType(body); if (error) return sendJson(res, 400, { error });
  const type = await create("bookTypes", { name: body.name.trim(), description: String(body.description || "").trim(), coverImage: body.coverImage || "classic", coverColor: body.coverColor || "#00BC3C", textColor: body.textColor || "#FFFFFF", sortOrder: Number(body.sortOrder), isActive: body.isActive !== false });
  await reorderBookTypes(type.id, Number(body.sortOrder));
  await setTypeGroups(type.id, body.questionGroupIds); sendJson(res, 201, await presentBookType(await get("bookTypes", type.id)));
}

async function bookTypeRoute(res, method, id, body) {
  const type = await get("bookTypes", id);
  if (!type) return sendJson(res, 404, { error: "북타입을 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentBookType(type, true));
  if (method === "PATCH" && body.action === "toggle-active") return sendJson(res, 200, await presentBookType(await update("bookTypes", id, { isActive: !type.isActive }), true));
  if (method === "PUT") {
    const error = await validateBookType(body, id); if (error) return sendJson(res, 400, { error });
    const currentTypes = await list("bookTypes");
    await update("bookTypes", id, { name: body.name.trim(), description: String(body.description || "").trim(), coverImage: body.coverImage || "classic", coverColor: body.coverColor || type.coverColor || "#00BC3C", textColor: body.textColor || type.textColor || "#FFFFFF", sortOrder: Number(body.sortOrder), isActive: body.isActive !== false });
    await reorderBookTypes(id, Number(body.sortOrder), currentTypes);
    await setTypeGroups(id, body.questionGroupIds); return sendJson(res, 200, await presentBookType(await get("bookTypes", id), true));
  }
  if (method === "DELETE") {
    if ((await list("books")).some((book) => book.bookTypeId === id)) return sendJson(res, 409, { error: "생성된 마이북이 있는 북타입은 삭제할 수 없습니다." });
    await deleteWhere("bookTypeGroups", (row) => row.bookTypeId === id); await deleteWhere("questionBookTypes", (row) => row.bookTypeId === id); await remove("bookTypes", id); return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function createBookRoute(res, body, user) {
  const result = await createBookRecord(body, user);
  if (result.error) return sendJson(res, 400, { error: result.error });
  const { book } = result;
  sendJson(res, 201, await presentBook(book));
}

async function createBookRecord(body, user) {
  const type = await get("bookTypes", Number(body.bookTypeId));
  if (!type || !type.isActive) return { error: "사용 가능한 북타입을 선택하세요." };
  const title = String(body.title || "").trim();
  if (!title) return { error: "책 제목을 입력하세요." };
  const book = await create("books", { ownerId: user.id, bookTypeId: type.id, title, sender: String(body.sender || "").trim(), receiver: String(body.receiver || "").trim(), introduction: String(body.introduction || "").trim(), status: "writing" });
  const answerIds = [];
  try {
    const questionIds = await questionIdsForType(type.id);
    for (const questionId of questionIds) answerIds.push((await create("answers", { myBookId: book.id, questionId, answer: "", isFinal: false })).id);
    return { book, answerIds };
  } catch (error) {
    await safeGiftCleanup({ bookId: book.id, answerIds });
    throw error;
  }
}

async function createGiftRoute(req, res, body) {
  const user = await authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: "계정 로그인이 필요합니다." });
  try { requireGiftCodePepper(); } catch (error) { return sendJson(res, 503, { error: error.message }); }
  const lockKey = String(user.id);
  if (giftCreationLocks.has(lockKey)) return sendJson(res, 409, { error: "선물 생성을 이미 처리 중입니다." });
  giftCreationLocks.add(lockKey);
  let book;
  let gift;
  let publication;
  try {
    const cover = await giftCoverSelection(body);
    if (cover.error) return sendJson(res, 400, { error: cover.error });
    const created = await createBookRecord(body, user);
    if (created.error) return sendJson(res, 400, { error: created.error });
    book = created.book;
    const code = createGiftCode();
    gift = await create("gifts", { bookId: book.id, senderUserId: user.id, senderEmail: user.email || null, status: "active", giftCodeHash: hashGiftCode(code), codeVersion: 1, codeIssuedAt: new Date().toISOString() });
    if (cover.selected) publication = await create("publications", { myBookId: book.id, coverStyle: cover.image, coverColor: cover.color, coverImage: cover.image });
    return sendJson(res, 201, { gift: { id: gift.id, bookId: gift.bookId, status: gift.status }, code });
  } catch (error) {
    await safeGiftCleanup({ giftId: gift?.id, publicationId: publication?.id, bookId: book?.id });
    console.error("선물용 책 생성 실패", error);
    const duplicate = /23505|duplicate key|unique constraint/i.test(String(error?.message || ""));
    return sendJson(res, duplicate ? 409 : 500, { error: duplicate ? "이미 연결된 선물 정보가 있습니다." : "선물용 책을 생성하지 못했습니다." });
  } finally {
    giftCreationLocks.delete(lockKey);
  }
}

async function giftCoverSelection(body) {
  const hasColor = body.coverColorId !== undefined || body.coverColor !== undefined;
  const hasImage = body.coverImageId !== undefined || body.coverImage !== undefined;
  if (!hasColor && !hasImage) return { selected: false };
  if (!hasColor || !hasImage) return { error: "표지 컬러와 표지 이미지를 함께 선택하세요." };
  let color;
  let image;
  if (body.coverColorId !== undefined) {
    const item = await get("coverColors", Number(body.coverColorId));
    if (!item || item.isActive === false) return { error: "유효한 표지 컬러를 선택하세요." };
    color = item.colorValue;
  } else color = String(body.coverColor || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "유효한 표지 컬러를 선택하세요." };
  if (body.coverImageId !== undefined) {
    const item = await get("coverImages", Number(body.coverImageId));
    if (!item || item.isActive === false) return { error: "유효한 표지 이미지를 선택하세요." };
    image = item.imagePath;
  } else image = String(body.coverImage || "").trim();
  if (!image) return { error: "유효한 표지 이미지를 선택하세요." };
  return { selected: true, color, image };
}

async function safeGiftCleanup({ giftId, publicationId, bookId, answerIds = [] }) {
  try { if (giftId) await remove("gifts", giftId); } catch (error) { console.error("gift cleanup failed", error); }
  try { if (publicationId) await remove("publications", publicationId); } catch (error) { console.error("publication cleanup failed", error); }
  try {
    if (bookId) {
      if (USE_SUPABASE) await remove("books", bookId);
      else {
        if (answerIds.length) for (const answerId of answerIds) await remove("answers", answerId);
        else await deleteWhere("answers", (answer) => answer.myBookId === bookId);
        await remove("books", bookId);
      }
    }
  } catch (error) { console.error("book cleanup failed", error); }
}

async function bookRoute(res, method, id, action, body, access) {
  const book = await get("books", id);
  if (!book) return sendJson(res, 404, { error: "마이북을 찾을 수 없습니다." });
  if (!authorizeBookAccess(book, access)) return sendJson(res, 404, { error: "마이북을 찾을 수 없습니다." });
  if (!action && method === "GET") return sendJson(res, 200, await presentBook(book, true));
  if (!action && method === "PUT") {
    if (!String(body.title || "").trim()) return sendJson(res, 400, { error: "책 제목을 입력하세요." });
    return sendJson(res, 200, await presentBook(await update("books", id, { title: body.title.trim(), sender: String(body.sender || "").trim(), receiver: String(body.receiver || "").trim(), introduction: String(body.introduction || "").trim() }), true));
  }
  if (!action && method === "DELETE") {
    if (access.kind !== "account") return sendJson(res, 403, { error: "선물 세션에서는 책을 삭제할 수 없습니다." });
    // 로컬 JSON 저장소에는 외래 키 cascade가 없으므로 연결 데이터도 함께 삭제한다.
    // Supabase에서는 스키마의 on delete cascade가 답변과 출판물을 삭제한다.
    if (!USE_SUPABASE) {
      await deleteWhere("answers", (answer) => answer.myBookId === id);
      await deleteWhere("publications", (publication) => publication.myBookId === id);
    }
    await remove("books", id);
    return sendJson(res, 200, { ok: true });
  }
  if (action === "outline" && method === "GET") return sendJson(res, 200, await bookOutline(book));
  if (action === "answers" && method === "PUT") {
    const questionId = Number(body.questionId); const answer = await findAnswer(id, questionId);
    if (!answer) return sendJson(res, 404, { error: "책에 포함되지 않은 질문입니다." });
    const updated = await update("answers", answer.id, { answer: String(body.answer || ""), isFinal: Boolean(body.isFinal) });
    return sendJson(res, 200, updated);
  }
  if (action === "cover" && (method === "PUT" || method === "PATCH")) {
    const coverColor = String(body.coverColor || "").trim();
    const coverImage = String(body.coverImage || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(coverColor)) return sendJson(res, 400, { error: "유효한 표지 컬러를 선택하세요." });
    if (!coverImage) return sendJson(res, 400, { error: "표지 이미지를 선택하세요." });
    const publication = (await list("publications"))
      .filter((item) => item.myBookId === id)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .at(-1);
    const saved = publication
      ? await update("publications", publication.id, { coverStyle: coverImage, coverColor, coverImage })
      : await create("publications", { myBookId: id, coverStyle: coverImage, coverColor, coverImage });
    return sendJson(res, 200, saved);
  }
  if (action === "publish" && method === "POST") {
    const coverColor = /^#[0-9a-fA-F]{6}$/.test(String(body.coverColor || "")) ? body.coverColor : null;
    const coverImage = String(body.coverImage || body.coverStyle || "cover_boy_01.png").trim();
    const publication = await create("publications", { myBookId: id, coverStyle: body.coverStyle || coverImage, coverColor, coverImage });
    await update("books", id, { status: "published", publishedAt: new Date().toISOString() });
    return sendJson(res, 201, { ...publication, printUrl: `/print/${id}` });
  }
  if (action === "publish" && method === "DELETE") {
    await deleteWhere("publications", (publication) => publication.myBookId === id);
    await update("books", id, { status: "writing", publishedAt: null });
    return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function dashboard() {
  const [groups, questions, bookTypes, books] = await Promise.all([list("groups"), list("questions"), list("bookTypes"), list("books")]);
  return { stats: { groups: groups.length, questions: questions.length, activeQuestions: questions.filter((q) => q.isActive).length, bookTypes: bookTypes.length, books: books.length, publishedBooks: books.filter((b) => b.status === "published").length }, bookTypes: await presentBookTypes(), books: await presentBooks(), groups: await presentGroups() };
}

function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
function isAdminUser(user) { return Boolean(ADMIN_EMAIL) && normalizeEmail(user?.email) === normalizeEmail(ADMIN_EMAIL); }

function requireGiftCodePepper() {
  if (!GIFT_CODE_PEPPER) throw new Error("GIFT_CODE_PEPPER 환경변수가 설정되지 않았습니다.");
  return GIFT_CODE_PEPPER;
}
function normalizeGiftCode(code) { return String(code || "").replace(/[\s-]/g, "").toUpperCase(); }
function hashGiftCode(code) { return createHmac("sha256", requireGiftCodePepper()).update(normalizeGiftCode(code), "utf8").digest("hex"); }
function hashGiftSessionToken(token) { return createHmac("sha256", requireGiftCodePepper()).update(String(token), "utf8").digest("hex"); }
function equalSecret(left, right) { const a = Buffer.from(String(left || ""), "utf8"); const b = Buffer.from(String(right || ""), "utf8"); return a.length === b.length && timingSafeEqual(a, b); }
function createGiftCode() { requireGiftCodePepper(); return randomBytes(24).toString("base64url").toUpperCase(); }
async function replaceGiftCode(giftId) {
  const gift = await get("gifts", Number(giftId));
  if (!gift) throw new Error("선물을 찾을 수 없습니다.");
  const code = createGiftCode();
  const updated = await update("gifts", gift.id, { giftCodeHash: hashGiftCode(code), codeVersion: Number(gift.codeVersion || 1) + 1, codeIssuedAt: new Date().toISOString(), revokedAt: null });
  for (const session of await list("giftSessions")) if (session.giftId === gift.id && !session.revokedAt) await update("giftSessions", session.id, { revokedAt: new Date().toISOString() });
  return { gift: updated, code };
}
function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (!key || !value.length) continue;
    try { cookies[key] = decodeURIComponent(value.join("=")); } catch { /* malformed cookie */ }
  }
  return cookies;
}
function giftCookieHeader(token, req, clear = false) { const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""; return `${GIFT_SESSION_COOKIE}=${clear ? "" : encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}${clear ? "; Max-Age=0" : `; Max-Age=${Math.floor(GIFT_SESSION_TTL_MS / 1000)}`}`; }
function sendJsonWithCookie(res, status, data, cookie) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": cookie }); res.end(JSON.stringify(data)); }

async function authenticateRequest(req, res = null) {
  const user = await authenticatedUser(req);
  if (user) return { kind: "account", user };
  return await authenticateGiftSession(req, res);
}
async function authenticateGiftSession(req, res = null) {
  const token = parseCookies(req)[GIFT_SESSION_COOKIE];
  if (!token) return null;
  let tokenHash;
  try { tokenHash = hashGiftSessionToken(token); } catch { return null; }
  const session = (await list("giftSessions")).find((item) => equalSecret(item.sessionTokenHash, tokenHash) && !item.revokedAt);
  if (!session) return null;
  const now = Date.now();
  if (new Date(session.expiresAt).getTime() <= now) {
    await update("giftSessions", session.id, { revokedAt: new Date(now).toISOString() });
    return null;
  }
  const gift = await get("gifts", session.giftId);
  if (!gift || gift.status !== "active" || gift.revokedAt) return null;
  const book = await get("books", gift.bookId);
  if (!book) return null;
  if (now - new Date(session.lastAccessedAt).getTime() >= GIFT_SESSION_TOUCH_INTERVAL_MS) {
    const accessedAt = new Date(now).toISOString();
    await update("giftSessions", session.id, { lastAccessedAt: accessedAt, expiresAt: new Date(now + GIFT_SESSION_TTL_MS).toISOString() });
    await update("gifts", gift.id, { lastAccessedAt: accessedAt });
    session.lastAccessedAt = accessedAt;
  }
  if (res) res.setHeader("Set-Cookie", giftCookieHeader(token, req));
  return { kind: "gift", session, gift, book };
}
function authorizeBookAccess(book, access) {
  if (!access) return false;
  if (access.kind === "account") return isAdminUser(access.user) || book.ownerId === access.user.id;
  return access.kind === "gift" && access.gift.bookId === book.id && access.book.id === book.id;
}
function giftLoginRateKey(req) { return req.socket?.remoteAddress || "unknown"; }
function isGiftLoginRateLimited(req) {
  const key = giftLoginRateKey(req);
  const current = giftLoginAttempts.get(key);
  if (!current || current.resetAt <= Date.now()) { giftLoginAttempts.delete(key); return false; }
  return current.count >= GIFT_LOGIN_RATE_LIMIT;
}
function recordGiftLoginFailure(req) {
  const key = giftLoginRateKey(req);
  const now = Date.now();
  const current = giftLoginAttempts.get(key);
  if (!current || current.resetAt <= now) return giftLoginAttempts.set(key, { count: 1, resetAt: now + GIFT_LOGIN_RATE_WINDOW_MS });
  current.count += 1;
}
async function giftLoginRoute(req, res, body) {
  if (isGiftLoginRateLimited(req)) return sendJson(res, 429, { error: "선물코드 로그인 시도가 잠시 제한되었습니다." });
  let codeHash;
  try { codeHash = hashGiftCode(body.code); } catch (error) { return sendJson(res, 503, { error: error.message }); }
  const gift = (await list("gifts")).find((item) => equalSecret(item.giftCodeHash, codeHash) && item.status === "active" && !item.revokedAt);
  if (!gift) { recordGiftLoginFailure(req); return sendJson(res, 401, { error: "유효하지 않은 선물코드입니다." }); }
  giftLoginAttempts.delete(giftLoginRateKey(req));
  const now = Date.now(); const token = randomBytes(32).toString("base64url");
  const session = await create("giftSessions", { giftId: gift.id, sessionTokenHash: hashGiftSessionToken(token), lastAccessedAt: new Date(now).toISOString(), expiresAt: new Date(now + GIFT_SESSION_TTL_MS).toISOString(), userAgent: String(req.headers["user-agent"] || "").slice(0, 512) });
  await update("gifts", gift.id, { lastAccessedAt: new Date(now).toISOString() });
  return sendJsonWithCookie(res, 200, { giftId: gift.id, bookId: gift.bookId, sessionExpiresAt: session.expiresAt }, giftCookieHeader(token, req));
}
async function giftLogoutRoute(req, res) {
  const access = await authenticateGiftSession(req, res);
  if (access?.session) await update("giftSessions", access.session.id, { revokedAt: new Date().toISOString() });
  return sendJsonWithCookie(res, 200, { ok: true }, giftCookieHeader("", req, true));
}
async function giftSessionRoute(req, res) {
  const access = await authenticateGiftSession(req);
  if (!access) return sendJson(res, 401, { error: "선물 세션이 없거나 만료되었습니다." });
  return sendJson(res, 200, { giftId: access.gift.id, bookId: access.book.id, sessionExpiresAt: access.session.expiresAt });
}

async function requireAdmin(req, res) {
  if (!ADMIN_EMAIL) {
    sendJson(res, 503, { error: "관리자 이메일이 서버에 설정되지 않았습니다." });
    return false;
  }
  const user = await authenticatedUser(req);
  if (!user) {
    sendJson(res, 401, { error: "관리자 로그인이 필요합니다." });
    return false;
  }
  if (!isAdminUser(user)) {
    sendJson(res, 403, { error: "관리자 권한이 없습니다." });
    return false;
  }
  return true;
}

async function homeReviewRoute(res, method, id, body) {
  if (method === "GET" && id === null) return sendJson(res, 200, await presentHomeReviews(true));
  if (method === "POST" && id === null) {
    const error = validateHomeReview(body);
    if (error) return sendJson(res, 400, { error });
    return sendJson(res, 201, await presentHomeReview(await create("homeReviews", normalHomeReview(body))));
  }
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const review = await get("homeReviews", id);
  if (!review) return sendJson(res, 404, { error: "Review를 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentHomeReview(review));
  if (method === "PATCH" && body.action === "toggle-visible") return sendJson(res, 200, await presentHomeReview(await update("homeReviews", id, { isVisible: !review.isVisible })));
  if (method === "PUT") {
    const error = validateHomeReview(body);
    if (error) return sendJson(res, 400, { error });
    const payload = normalHomeReview(body);
    if (payload.sortOrder !== review.sortOrder) await reorderHomeReviews(id, payload.sortOrder);
    return sendJson(res, 200, await presentHomeReview(await update("homeReviews", id, payload)));
  }
  if (method === "DELETE") { await remove("homeReviews", id); return sendJson(res, 200, { ok: true }); }
  return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function reorderHomeReviews(id, desiredOrder, sourceReviews = null) {
  const reviews = sourceReviews || await list("homeReviews");
  const target = reviews.find((item) => item.id === id);
  if (!target) return;
  const ordered = reviews.filter((item) => item.id !== id).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id));
  const position = Math.min(Math.max(Number(desiredOrder) || 1, 1), reviews.length) - 1;
  ordered.splice(position, 0, target);
  for (const [index, item] of ordered.entries()) {
    if (Number(item.sortOrder) !== index + 1 || item.id === id) await update("homeReviews", item.id, { sortOrder: index + 1 });
  }
}

async function homeBannerRoute(res, method, id, body) {
  if (method === "GET" && id === null) return sendJson(res, 200, await presentHomeBanners(true));
  if (method === "POST" && id === null) {
    const error = validateHomeBanner(body, false);
    if (error) return sendJson(res, 400, { error });
    const banner = await create("homeBanners", normalHomeBanner(body));
    if (banner.isVisible) await deactivateOtherVisibleBanners(banner.position, banner.id);
    return sendJson(res, 201, presentHomeBanner(banner));
  }
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const banner = (await list("homeBanners")).find((item) => String(item.id) === String(id));
  if (!banner) return sendJson(res, 404, { error: "메인 배너를 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, presentHomeBanner(banner));
  if (method === "PATCH" && body.action === "toggle-visible") {
    const updated = await update("homeBanners", banner.id, { isVisible: !banner.isVisible });
    if (updated.isVisible) await deactivateOtherVisibleBanners(updated.position, updated.id);
    return sendJson(res, 200, presentHomeBanner(updated));
  }
  if (method === "PUT") {
    const error = validateHomeBanner(body, true);
    if (error) return sendJson(res, 400, { error });
    const updated = await update("homeBanners", banner.id, normalHomeBanner(body, banner));
    if (updated.imagePath !== banner.imagePath) await removeHomeBannerImage(banner.imagePath);
    if (updated.isVisible) await deactivateOtherVisibleBanners(updated.position, updated.id);
    return sendJson(res, 200, presentHomeBanner(updated));
  }
  if (method === "DELETE") {
    await removeHomeBannerImage(banner.imagePath);
    await remove("homeBanners", banner.id);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function homeBannerUploadRoute(res, method, body) {
  if (method !== "POST") return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const contentType = String(body.contentType || "").toLowerCase();
  const data = String(body.data || "");
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(contentType)) return sendJson(res, 400, { error: "PNG, JPG, WEBP, GIF, SVG 이미지만 업로드할 수 있습니다." });
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return sendJson(res, 400, { error: "이미지 파일을 확인할 수 없습니다." });
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) return sendJson(res, 400, { error: "이미지는 10MB 이하만 업로드할 수 있습니다." });
  if (!USE_SUPABASE) return sendJson(res, 201, { imagePath: `data:${contentType};base64,${base64}` });
  const extension = contentType === "image/svg+xml" ? "svg" : contentType.split("/")[1].replace("jpeg", "jpg");
  const imagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  await uploadHomeBannerImage(imagePath, buffer, contentType);
  return sendJson(res, 201, { imagePath, imageUrl: publicHomeBannerUrl(imagePath) });
}

async function coverColorRoute(res, method, id, body) {
  if (method === "GET" && id === null) return sendJson(res, 200, await presentCoverColors(true));
  if (method === "POST" && id === null) {
    const error = validateCoverColor(body);
    if (error) return sendJson(res, 400, { error });
    try {
      return sendJson(res, 201, await presentCoverColor(await create("coverColors", normalCoverColor(body))));
    } catch (error) {
      if (isMissingCoverTableError(error, "coverColors")) {
        console.error("표지 컬러 저장 실패: Supabase public.cover_colors 테이블이 없습니다.", error);
        return sendJson(res, 503, { error: "표지 컬러 관리 테이블이 없습니다. Supabase migration 20260823_add_cover_management.sql을 먼저 적용하세요.", code: "COVER_MANAGEMENT_MIGRATION_REQUIRED" });
      }
      throw error;
    }
  }
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const color = await get("coverColors", id);
  if (!color) return sendJson(res, 404, { error: "표지 컬러를 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentCoverColor(color));
  if (method === "PATCH" && body.action === "toggle-active") return sendJson(res, 200, await presentCoverColor(await update("coverColors", id, { isActive: !color.isActive })));
  if (method === "PUT") {
    const error = validateCoverColor(body);
    if (error) return sendJson(res, 400, { error });
    return sendJson(res, 200, await presentCoverColor(await update("coverColors", id, normalCoverColor(body))));
  }
  if (method === "DELETE") { await remove("coverColors", id); return sendJson(res, 200, { ok: true }); }
  return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function coverImageRoute(res, method, id, body) {
  if (method === "GET" && id === null) return sendJson(res, 200, await presentCoverImages(true));
  if (method === "POST" && id === null) {
    const error = validateCoverImage(body);
    if (error) return sendJson(res, 400, { error });
    return sendJson(res, 201, await presentCoverImage(await create("coverImages", normalCoverImage(body))));
  }
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const image = await get("coverImages", id);
  if (!image) return sendJson(res, 404, { error: "표지 이미지를 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentCoverImage(image));
  if (method === "PATCH" && body.action === "toggle-active") return sendJson(res, 200, await presentCoverImage(await update("coverImages", id, { isActive: !image.isActive })));
  if (method === "PUT") {
    const error = validateCoverImage(body);
    if (error) return sendJson(res, 400, { error });
    const updated = await update("coverImages", id, normalCoverImage(body, image));
    if (updated.imagePath !== image.imagePath) await removeCoverImage(image.imagePath);
    return sendJson(res, 200, await presentCoverImage(updated));
  }
  if (method === "DELETE") {
    await removeCoverImage(image.imagePath);
    await remove("coverImages", id);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function coverImageUploadRoute(res, method, body) {
  if (method !== "POST") return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const contentType = String(body.contentType || "").toLowerCase();
  const data = String(body.data || "");
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(contentType)) return sendJson(res, 400, { error: "PNG, JPG, WEBP, GIF, SVG 이미지만 업로드할 수 있습니다." });
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return sendJson(res, 400, { error: "이미지 파일을 확인할 수 없습니다." });
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) return sendJson(res, 400, { error: "이미지는 10MB 이하만 업로드할 수 있습니다." });
  if (!USE_SUPABASE) return sendJson(res, 201, { imagePath: `data:${contentType};base64,${base64}` });
  const extension = contentType === "image/svg+xml" ? "svg" : contentType.split("/")[1].replace("jpeg", "jpg");
  const imagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  await uploadCoverImage(imagePath, buffer, contentType);
  return sendJson(res, 201, { imagePath, imageUrl: publicCoverImageUrl(imagePath) });
}

async function questionGroupImageUploadRoute(res, method, body) {
  if (method !== "POST") return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const contentType = String(body.contentType || "").toLowerCase();
  const data = String(body.data || "");
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(contentType)) return sendJson(res, 400, { error: "PNG, JPG, WEBP, GIF, SVG 이미지만 업로드할 수 있습니다." });
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return sendJson(res, 400, { error: "이미지 파일을 확인할 수 없습니다." });
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) return sendJson(res, 400, { error: "이미지는 10MB 이하만 업로드할 수 있습니다." });
  const extension = contentType === "image/svg+xml" ? "svg" : contentType.split("/")[1].replace("jpeg", "jpg");
  if (!USE_SUPABASE) return sendJson(res, 201, { imagePath: `data:${contentType};base64,${base64}` });
  const imagePath = `question-groups/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  await uploadHomeBannerImage(imagePath, buffer, contentType);
  return sendJson(res, 201, { imagePath, imageUrl: publicHomeBannerUrl(imagePath) });
}

function validateHomeBanner(body, updating) {
  if (!updating && !String(body.imagePath || "").trim()) return "배너 이미지를 업로드하세요.";
  if (updating && body.imagePath !== undefined && !String(body.imagePath || "").trim()) return "배너 이미지를 업로드하세요.";
  if (!String(body.position || "").trim() || !["left", "right"].includes(String(body.position).trim())) return "배너 위치는 left 또는 right여야 합니다.";
  if (body.linkUrl && !isSafeBannerUrl(body.linkUrl)) return "링크는 http(s) 또는 내부 경로만 사용할 수 있습니다.";
  return null;
}

function normalHomeBanner(body, existing = null) {
  return {
    imagePath: String(body.imagePath || existing?.imagePath || "").trim(),
    caption: String(body.caption || "").trim(),
    linkUrl: String(body.linkUrl || "").trim(),
    position: String(body.position || existing?.position || "left").trim(),
    isVisible: body.isVisible !== false && body.isVisible !== "false",
  };
}

function isSafeBannerUrl(value) { return /^(https?:\/\/|\/|#)/i.test(String(value || "").trim()); }
async function deactivateOtherVisibleBanners(position, id) { for (const banner of await list("homeBanners")) if (banner.id !== id && banner.position === position && banner.isVisible) await update("homeBanners", banner.id, { isVisible: false }); }
function presentHomeBanners(admin = false) { return list("homeBanners").then((banners) => banners.filter((banner) => admin || banner.isVisible).sort((a, b) => a.position.localeCompare(b.position) || String(a.createdAt).localeCompare(String(b.createdAt))).map(presentHomeBanner)); }
function presentHomeBanner(banner) { return { ...banner, imageUrl: banner.imagePath?.startsWith("data:") ? banner.imagePath : publicHomeBannerUrl(banner.imagePath) }; }
function publicHomeBannerUrl(imagePath) { return USE_SUPABASE && imagePath ? `${SUPABASE_URL}/storage/v1/object/public/${HOME_BANNER_BUCKET}/${imagePath}` : imagePath || ""; }
async function uploadHomeBannerImage(imagePath, buffer, contentType) { const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${HOME_BANNER_BUCKET}/${imagePath}`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": contentType, "x-upsert": "true" }, body: buffer }); if (!response.ok) throw new Error(`배너 이미지 업로드 실패: ${await response.text()}`); }
async function removeHomeBannerImage(imagePath) { if (!USE_SUPABASE || !imagePath || imagePath.startsWith("data:")) return; const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${HOME_BANNER_BUCKET}/${imagePath}`, { method: "DELETE", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }); if (!response.ok && response.status !== 404) throw new Error(`배너 이미지 삭제 실패: ${await response.text()}`); }
function publicCoverImageUrl(imagePath) { if (!imagePath) return ""; if (imagePath.startsWith("/assets/") || imagePath.startsWith("data:") || imagePath.startsWith("http")) return imagePath; if (/^cover_(girl|boy)_\d+\.png$/.test(imagePath)) return `/assets/${imagePath}`; return USE_SUPABASE ? `${SUPABASE_URL}/storage/v1/object/public/${COVER_IMAGE_BUCKET}/${imagePath}` : imagePath; }
async function uploadCoverImage(imagePath, buffer, contentType) { const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${COVER_IMAGE_BUCKET}/${imagePath}`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": contentType, "x-upsert": "true" }, body: buffer }); if (!response.ok) throw new Error(`표지 이미지 업로드 실패: ${await response.text()}`); }
async function removeCoverImage(imagePath) { if (!USE_SUPABASE || !imagePath || imagePath.startsWith("data:") || imagePath.startsWith("/assets/")) return; const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${COVER_IMAGE_BUCKET}/${imagePath}`, { method: "DELETE", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }); if (!response.ok && response.status !== 404) throw new Error(`표지 이미지 삭제 실패: ${await response.text()}`); }

function authConfigRoute(res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return sendJson(res, 503, { error: "Supabase Auth client 설정이 없습니다." });
  return sendJson(res, 200, { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
}

function requestOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${protocol}://${req.headers.host}`;
}
function naverRedirectUri(req) { return NAVER_REDIRECT_URI || `${requestOrigin(req)}/auth/naver/callback`; }
function naverAppRedirectUri(req) { return `${requestOrigin(req)}/`; }
function naverStateCookie(value, clear = false) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NAVER_STATE_COOKIE}=${clear ? "" : encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}${clear ? "; Max-Age=0" : `; Max-Age=${NAVER_STATE_TTL_SECONDS}`}`;
}
function redirect(res, location, headers = {}) { res.writeHead(302, { Location: location, ...headers }); res.end(); }
function naverFailure(res, status, message, clearState = false) {
  const headers = clearState ? { "Set-Cookie": naverStateCookie("", true) } : {};
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers }); res.end(message);
}
function requireNaverConfig() {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_KEY || !supabaseAdmin) throw new Error("네이버 로그인 서버 설정이 없습니다.");
}
async function naverStartRoute(req, res) {
  try {
    requireNaverConfig();
    const state = randomBytes(32).toString("base64url");
    const authorizeUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
    authorizeUrl.search = new URLSearchParams({ response_type: "code", client_id: NAVER_CLIENT_ID, redirect_uri: naverRedirectUri(req), state }).toString();
    redirect(res, authorizeUrl.toString(), { "Set-Cookie": naverStateCookie(state) });
  } catch (error) { naverFailure(res, 503, error.message); }
}
async function naverCallbackRoute(req, res, url) {
  const cookies = parseCookies(req);
  const savedState = cookies[NAVER_STATE_COOKIE] || "";
  const callbackState = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  if (!savedState || !callbackState || !equalSecret(savedState, callbackState)) return naverFailure(res, 400, "네이버 로그인 요청이 만료되었거나 유효하지 않습니다.", true);
  if (url.searchParams.get("error") || !code) return naverFailure(res, 400, "네이버 로그인을 완료하지 못했습니다.", true);
  try {
    requireNaverConfig();
    const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: NAVER_CLIENT_ID, client_secret: NAVER_CLIENT_SECRET, code, state: callbackState }) });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error("네이버 access token을 받을 수 없습니다.");
    const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profileData = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || profileData.resultcode !== "00" || !profileData.response) throw new Error("네이버 사용자 정보를 확인할 수 없습니다.");
    const profile = profileData.response;
    const email = normalizeEmail(profile.email);
    if (!email) throw new Error("네이버 계정 이메일 제공에 동의해야 로그인할 수 있습니다.");
    const existingUser = await findSupabaseUserByEmail(email);
    if (!existingUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: String(profile.name || profile.nickname || email).trim() } });
      if (error && !String(error.message || "").toLowerCase().includes("already")) throw new Error("Supabase 사용자를 생성할 수 없습니다.");
      if (!data?.user && error) {
        const racedUser = await findSupabaseUserByEmail(email);
        if (!racedUser) throw new Error("Supabase 사용자를 확인할 수 없습니다.");
      }
    }
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: naverAppRedirectUri(req) } });
    if (linkError) throw new Error("Supabase 인증 링크를 생성할 수 없습니다.");
    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) throw new Error("Supabase 인증 링크를 받지 못했습니다.");
    redirect(res, actionLink, { "Set-Cookie": naverStateCookie("", true) });
  } catch (error) { naverFailure(res, 502, error.message, true); }
}
async function findSupabaseUserByEmail(email) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Supabase 사용자를 조회할 수 없습니다.");
  return data.users.find((user) => normalizeEmail(user.email) === email) || null;
}

async function authMeRoute(req, res) {
  const user = await authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  const isAdmin = isAdminUser(user);
  const author = await getActiveMomentAuthor(user);
  return sendJson(res, 200, {
    user: { id: user.id, email: user.email || "", displayName: user.user_metadata?.name || user.email || "사용자" },
    isAdmin,
    moments: { canWrite: isAdmin || Boolean(author?.isActive), author: author ? { id: author.id, displayName: author.displayName, isActive: author.isActive } : null },
  });
}

async function authProfileRoute(req, res, method, body) {
  const user = await authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  if (method === "GET") return sendJson(res, 200, { displayName: user.user_metadata?.name || user.email || "사용자" });
  const displayName = String(body.displayName || "").trim();
  if (!displayName) return sendJson(res, 400, { error: "닉네임을 입력하세요." });
  if (displayName.length > 40) return sendJson(res, 400, { error: "닉네임은 40자 이하로 입력하세요." });
  if (!USE_SUPABASE) return sendJson(res, 200, { displayName });
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "PUT",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_metadata: { ...(user.user_metadata || {}), name: displayName } }),
  });
  if (!response.ok) return sendJson(res, 502, { error: `닉네임을 저장할 수 없습니다: ${await response.text()}` });
  return sendJson(res, 200, { displayName });
}

async function accountGiftsRoute(req, res) {
  const user = await authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  return sendJson(res, 200, await presentUserGifts(user.id));
}

async function momentAuthorRoute(res, method, id, body) {
  if (method === "GET" && id === null) return sendJson(res, 200, await listMomentAuthorUsers());
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  if (method !== "PUT" && method !== "PATCH") return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const user = await findAuthUser(id);
  if (USE_SUPABASE && !user) return sendJson(res, 404, { error: "Supabase Auth 사용자를 찾을 수 없습니다." });
  const existing = await findMomentAuthor(id);
  const isActive = method === "PATCH" && body.action === "toggle-active" ? !Boolean(existing?.isActive) : body.isActive !== false && body.isActive !== "false";
  const displayName = String(user?.user_metadata?.name || user?.email || "사용자").trim();
  const author = existing
    ? await update("momentAuthors", id, { ...(Object.hasOwn(body, "displayName") ? { displayName: String(body.displayName).trim() } : {}), isActive })
    : await create("momentAuthors", { id, displayName, role: "author", isActive });
  return sendJson(res, 200, { id: author.id, displayName: author.displayName, role: author.role, isActive: author.isActive, email: user?.email || "" });
}

async function findMomentAuthor(id) { return (await list("momentAuthors")).find((author) => author.id === id) || null; }
async function ensureAdminMomentAuthor(user) {
  const existing = await findMomentAuthor(user.id);
  if (existing) {
    if (existing.role !== "author" || !existing.isActive) return await update("momentAuthors", user.id, { role: "author", isActive: true });
    return existing;
  }
  const displayName = String(user.user_metadata?.name || user.email || "관리자").trim();
  return await create("momentAuthors", { id: user.id, displayName, role: "author", isActive: true });
}
async function getActiveMomentAuthor(user) {
  const author = isAdminUser(user) ? await ensureAdminMomentAuthor(user) : await findMomentAuthor(user.id);
  return author?.isActive ? author : null;
}

async function listMomentAuthorUsers() {
  const authors = await list("momentAuthors");
  const users = await listAuthUsers();
  const byId = new Map(authors.map((author) => [author.id, author]));
  return users.map((user) => {
    const author = byId.get(user.id);
    return { id: user.id, email: user.email || "", displayName: author?.displayName || user.user_metadata?.name || user.email || "사용자", isAuthor: Boolean(author), isActive: Boolean(author?.isActive), createdAt: author?.createdAt || user.created_at || null };
  });
}

async function listAuthUsers() {
  if (!USE_SUPABASE) return (await list("momentAuthors")).map((author) => ({ id: author.id, email: author.id === "local-author" ? "local@example.com" : "", user_metadata: { name: author.displayName }, created_at: author.createdAt }));
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!response.ok) throw new Error(`Supabase Auth 사용자 목록을 불러올 수 없습니다: ${await response.text()}`);
  const data = await response.json();
  return Array.isArray(data) ? data : (data.users || []);
}

async function findAuthUser(id) { return (await listAuthUsers()).find((user) => user.id === id) || null; }

async function authorMomentRoute(res, method, id, body, user) {
  const author = await getActiveMomentAuthor(user);
  if (!author) return sendJson(res, 403, { error: "Moments 작성 권한이 없습니다." });
  if (method === "GET" && id === null) return sendJson(res, 200, await presentAuthorMoments(author.id));
  if (method === "POST" && id === null) {
    try { return sendJson(res, 201, await saveMoment(author.id, body)); } catch (error) { return sendMomentError(res, error); }
  }
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const entry = await get("momentEntries", id);
  if (!entry) return sendJson(res, 404, { error: "Moments를 찾을 수 없습니다." });
  const slot = await get("momentSlots", entry.slotId);
  if (!slot || slot.authorId !== author.id) return sendJson(res, 403, { error: "자신의 Moments만 관리할 수 있습니다." });
  if (method === "GET") return sendJson(res, 200, await presentMomentEntry(entry));
  if (method === "PUT") {
    try { return sendJson(res, 200, await updateOwnMoment(entry, body)); } catch (error) { return sendMomentError(res, error); }
  }
  if (method === "PATCH" && body.action === "toggle-visible") return sendJson(res, 200, await presentMomentEntry(await update("momentEntries", id, { isVisible: !entry.isVisible })));
  if (method === "DELETE") { await remove("momentEntries", id); return sendJson(res, 200, { ok: true }); }
  return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function adminMomentRoute(res, method, id, body) {
  if (method === "GET" && id === null) return sendJson(res, 200, await presentAllMoments());
  if (method === "POST" && id === null) {
    try { return sendJson(res, 201, await saveMoment(String(body.authorId || "").trim(), body)); } catch (error) { return sendMomentError(res, error); }
  }
  if (id === null) return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
  const entry = await get("momentEntries", id);
  if (!entry) return sendJson(res, 404, { error: "Moments를 찾을 수 없습니다." });
  if (method === "GET") return sendJson(res, 200, await presentMomentEntry(entry));
  if (method === "PUT") {
    try { return sendJson(res, 200, await updateOwnMoment(entry, body)); } catch (error) { return sendMomentError(res, error); }
  }
  if (method === "PATCH" && body.action === "toggle-visible") return sendJson(res, 200, await presentMomentEntry(await update("momentEntries", id, { isVisible: !entry.isVisible })));
  if (method === "DELETE") { await remove("momentEntries", id); return sendJson(res, 200, { ok: true }); }
  return sendJson(res, 405, { error: "지원하지 않는 요청입니다." });
}

async function saveMoment(authorId, body) {
  if (!authorId) throw new Error("작가를 확인할 수 없습니다.");
  if (!/^\d{2}:\d{2}$/.test(String(body.slotTime || "")) || Number(body.slotTime.slice(0, 2)) > 23 || Number(body.slotTime.slice(3)) > 59) throw new Error("시간은 HH:MM 형식이어야 합니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.momentDate || ""))) throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  if (!String(body.body || "").trim()) throw new Error("메모를 입력하세요.");
  const authors = await list("momentAuthors");
  if (!authors.some((author) => author.id === authorId && author.isActive)) throw new Error("등록된 작가가 아닙니다.");
  const slots = await list("momentSlots");
  let slot = slots.find((item) => item.slotTime === body.slotTime);
  let createdSlot = false;
  if (slot && slot.authorId !== authorId) throw Object.assign(new Error("선택한 시간은 이미 다른 작가가 사용 중입니다."), { code: "DUPLICATE_SLOT" });
  if (!slot) {
    try { slot = await create("momentSlots", { authorId, slotTime: body.slotTime, isActive: true }); createdSlot = true; } catch (error) { if (String(error.message).includes("duplicate") || String(error.message).includes("unique")) throw Object.assign(new Error("선택한 시간은 이미 다른 작가가 사용 중입니다."), { code: "DUPLICATE_SLOT" }); throw error; }
  }
  const entries = await list("momentEntries");
  const existing = entries.find((item) => item.slotId === slot.id && item.momentDate === body.momentDate);
  try {
    return presentMomentEntry(existing ? await update("momentEntries", existing.id, { body: String(body.body).trim(), isVisible: body.isVisible !== false && body.isVisible !== "false", publishedAt: body.publishedAt || null }) : await create("momentEntries", { slotId: slot.id, momentDate: body.momentDate, body: String(body.body).trim(), isVisible: body.isVisible !== false && body.isVisible !== "false", publishedAt: body.publishedAt || null }));
  } catch (error) { if (createdSlot) await remove("momentSlots", slot.id); throw error; }
}

async function updateOwnMoment(entry, body) {
  if (!String(body.body || "").trim()) throw new Error("메모를 입력하세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.momentDate || entry.momentDate))) throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  return presentMomentEntry(await update("momentEntries", entry.id, { body: String(body.body).trim(), momentDate: body.momentDate || entry.momentDate, isVisible: body.isVisible !== false && body.isVisible !== "false", publishedAt: body.publishedAt || null }));
}

async function presentAuthorMoments(authorId) { const slots = await list("momentSlots"); const slotIds = new Set(slots.filter((slot) => slot.authorId === authorId).map((slot) => slot.id)); return Promise.all((await list("momentEntries")).filter((entry) => slotIds.has(entry.slotId)).map(presentMomentEntry)); }
async function authorMomentsPdfRoute(res, author) {
  const entries = (await presentAuthorMoments(author.id)).sort(sortMomentsByCreatedAt);
  if (!entries.length) return sendJson(res, 404, { error: "저장된 Moments가 없습니다." });
  const pdf = await createMomentsPdf(author.displayName || "작가", entries);
  res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"moments.pdf\"", "Content-Length": pdf.length });
  res.end(pdf);
}
function createMomentsPdf(displayName, entries) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margins: { top: 56, right: 56, bottom: 56, left: 56 }, bufferPages: true });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.font(MOMENTS_PDF_TITLE_FONT).fillColor("#363636");
    document.fontSize(28).text("Moments", { align: "center" });
    document.moveDown(0.35).font(MOMENTS_PDF_AUTHOR_FONT).fontSize(12).fillColor("#756d63").text(displayName, { align: "center" });
    document.moveDown(2.2);
    entries.forEach((entry, index) => {
      if (index > 0) document.moveDown(2.2);
      document.font(MOMENTS_PDF_AUTHOR_FONT).fontSize(10).fillColor("#756d63").text(`${formatMomentPdfDate(entry.momentDate)} · ${formatMomentTime(entry.slotTime)}`);
      document.moveDown(0.45).font(MOMENTS_PDF_BODY_FONT).fontSize(15).fillColor("#363636").text(entry.body, { width: document.page.width - document.page.margins.left - document.page.margins.right, lineGap: 5 });
    });
    document.end();
  });
}
function formatMomentPdfDate(date) { const [year, month, day] = String(date).split("-").map(Number); return `${year}년 ${month}월 ${day}일`; }
async function presentAllMoments() { try { return Promise.all((await list("momentEntries")).sort((a, b) => String(b.momentDate).localeCompare(String(a.momentDate)) || Number(a.slotId) - Number(b.slotId)).map(presentMomentEntry)); } catch (error) { if (isMissingMomentTable(error)) return []; throw error; } }
async function presentPublicMoments(authorId) { const now = new Date(); const slots = await list("momentSlots"); const slotIds = new Set(slots.filter((slot) => slot.authorId === authorId && slot.isActive !== false).map((slot) => slot.id)); const entries = await Promise.all((await list("momentEntries")).filter((entry) => slotIds.has(entry.slotId) && entry.isVisible && (!entry.publishedAt || new Date(entry.publishedAt) <= now)).map(presentMomentEntry)); return entries.sort(sortMomentsByCreatedAt); }
function sortMomentsByCreatedAt(a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); }
async function presentMomentEntry(entry) { const slot = await get("momentSlots", entry.slotId); const author = slot ? await get("momentAuthors", slot.authorId) : null; return { ...entry, slotTime: slot?.slotTime || "", authorId: slot?.authorId || "", author: author?.displayName || "", isSlotActive: slot?.isActive !== false }; }
async function presentCurrentMoment() {
  try {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const today = `${value.year}-${value.month}-${value.day}`;
  const currentTime = `${value.hour}:${value.minute}`;
  const entries = await list("momentEntries"); const slots = await list("momentSlots");
  const eligible = entries.filter((entry) => entry.isVisible && (!entry.publishedAt || new Date(entry.publishedAt) <= now)).map((entry) => ({ entry, slot: slots.find((item) => item.id === entry.slotId) })).filter((item) => item.slot?.isActive !== false && (item.entry.momentDate < today || (item.entry.momentDate === today && item.slot.slotTime <= currentTime))).sort((a, b) => String(b.entry.momentDate).localeCompare(String(a.entry.momentDate)) || b.slot.slotTime.localeCompare(a.slot.slotTime) || String(b.entry.createdAt || "").localeCompare(String(a.entry.createdAt || "")));
  if (!eligible.length) return null;
  const item = await presentMomentEntry(eligible[0].entry); return { time: formatMomentTime(item.slotTime), date: formatMomentDate(item.momentDate), body: item.body, author: item.author, authorId: item.authorId, more: "more", moreUrl: `#moments-detail/${encodeURIComponent(item.authorId)}` };
  } catch (error) { if (isMissingMomentTable(error)) return null; throw error; }
}
function formatMomentTime(time) { const [hour] = time.split(":").map(Number); const suffix = hour < 12 ? "a. m." : "p. m."; const displayHour = hour % 12 || 12; return `${displayHour} ${suffix}`; }
function formatMomentDate(date) { const [year, month, day] = date.split("-").map(Number); const weekday = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()]; return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${weekday}`; }
function sendMomentError(res, error) { if (error.code === "DUPLICATE_SLOT") return sendJson(res, 409, { error: error.message }); return sendJson(res, 400, { error: error.message || "Moments를 저장할 수 없습니다." }); }
function isMissingMomentTable(error) { return String(error?.message || "").includes("moment_entries") || String(error?.message || "").includes("moment_time_slots") || String(error?.message || "").includes("moment_authors"); }

async function authenticatedUser(req) {
  const authorization = req.headers.authorization || ""; if (!authorization.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice(7);
  if (!USE_SUPABASE) return { id: req.headers["x-author-id"] || "local-author", email: "local@example.com" };
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  return response.json();
}
async function presentHomeReviews(admin = false) {
  const reviews = (await list("homeReviews")).filter((review) => admin || (review.isVisible && (!review.publishedAt || new Date(review.publishedAt) <= new Date())));
  const latestFirst = (a, b) => Number(b.sortOrder || 0) - Number(a.sortOrder || 0) || Number(b.id) - Number(a.id);
  if (admin) return reviews.sort(latestFirst).map(presentHomeReview);
  const featured = reviews.find((review) => Number(review.id) === 1);
  return (featured ? [featured, ...reviews.filter((review) => review !== featured).sort(latestFirst)] : reviews.sort(latestFirst)).map(presentHomeReview);
}
function presentHomeReview(review) { return { ...review }; }
function normalHomeReview(body) { return { relationship: String(body.relationship || "").trim(), author: String(body.author || "").trim(), body: String(body.body || "").trim(), variant: String(body.variant || "").trim() || null, isVisible: body.isVisible !== false && body.isVisible !== "false", sortOrder: Number(body.sortOrder), publishedAt: body.publishedAt || null }; }
function validateHomeReview(body) { if (!String(body.relationship || "").trim()) return "관계를 입력하세요."; if (!String(body.author || "").trim()) return "작성자를 입력하세요."; if (!String(body.body || "").trim()) return "Review 본문을 입력하세요."; if (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1) return "정렬순서는 1 이상의 숫자여야 합니다."; if (body.variant && !["intro"].includes(String(body.variant))) return "지원하지 않는 Review 유형입니다."; return null; }
function validateCoverColor(body) { if (!String(body.name || "").trim()) return "컬러 이름을 입력하세요."; if (!/^#[0-9a-fA-F]{6}$/.test(String(body.colorValue || "").trim())) return "컬러 값은 #FFFFFF 형식으로 입력하세요."; if (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1) return "노출 순서는 1 이상의 숫자여야 합니다."; return null; }
function validateCoverImage(body) { if (!String(body.name || "").trim()) return "이미지 이름을 입력하세요."; if (!String(body.imagePath || "").trim()) return "표지 이미지를 업로드하세요."; if (![1, 2].includes(Number(body.column))) return "표지 이미지 열은 1 또는 2여야 합니다."; if (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1) return "노출 순서는 1 이상의 숫자여야 합니다."; return null; }
function normalCoverColor(body) { return { name: String(body.name || "").trim(), colorValue: String(body.colorValue || "").trim().toUpperCase(), sortOrder: Number(body.sortOrder), isActive: body.isActive !== false && body.isActive !== "false" }; }
function normalCoverImage(body, existing = null) { return { name: String(body.name || existing?.name || "").trim(), imagePath: String(body.imagePath || existing?.imagePath || "").trim(), column: Number(body.column || existing?.column || 1), sortOrder: Number(body.sortOrder), isActive: body.isActive !== false && body.isActive !== "false" }; }

async function presentGroups(search = "") { const questions = await list("questions"); return (await list("groups")).filter((g) => `${g.name}${g.description}`.includes(search)).sort(sorter).map((g) => ({ ...g, imageUrl: g.imagePath?.startsWith("data:") ? g.imagePath : publicHomeBannerUrl(g.imagePath), questionCount: questions.filter((q) => q.questionGroupId === g.id).length })); }
async function presentGroup(group, detail = false) { const result = (await presentGroups()).find((item) => item.id === group.id); if (!detail) return result; return { ...result, questions: (await list("questions")).filter((q) => q.questionGroupId === group.id).sort(sorter) }; }
async function presentQuestions(params = new URLSearchParams()) { const [groups, all, answers, links, bookTypes] = await Promise.all([list("groups"), list("questions"), list("answers"), list("questionBookTypes"), list("bookTypes")]); const groupSortOrders = new Map(groups.map((group) => [group.id, Number(group.sortOrder || 0)])); const search = params.get("search") || ""; const groupId = params.get("groupId"); const items = all.filter((q) => q.content.includes(search) && (!groupId || groupId === "all" || q.questionGroupId === Number(groupId))).sort((a, b) => groupSortOrders.get(a.questionGroupId) - groupSortOrders.get(b.questionGroupId) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((q) => ({ ...q, questionGroupName: groups.find((g) => g.id === q.questionGroupId)?.name || "미지정", inUse: answers.some((a) => a.questionId === q.id), bookTypeIds: links.filter((link) => link.questionId === q.id).map((link) => link.bookTypeId), bookTypes: links.filter((link) => link.questionId === q.id).map((link) => bookTypes.find((type) => type.id === link.bookTypeId)).filter(Boolean).sort(sorter).map((type) => ({ id: type.id, name: type.name })) })); return { items, stats: { total: all.length, active: all.filter((q) => q.isActive).length, inactive: all.filter((q) => !q.isActive).length, inUse: answers.length } }; }
async function presentQuestion(question) { return (await presentQuestions()).items.find((item) => item.id === question.id); }
async function presentBookTypes() { const all = await list("bookTypes"); return Promise.all(all.sort((a, b) => Number(a.sortOrder || 1) - Number(b.sortOrder || 1) || a.name.localeCompare(b.name, "ko") || Number(a.id) - Number(b.id)).map((type) => presentBookType(type))); }
async function presentBookType(type, detail = false) { const groups = await list("groups"); const links = await list("bookTypeGroups"); const questionLinks = await list("questionBookTypes"); const questions = await list("questions"); const selected = links.filter((l) => l.bookTypeId === type.id).map((l) => groups.find((g) => g.id === l.questionGroupId)).filter(Boolean).sort(sorter); const result = { ...type, questionGroupIds: selected.map((g) => g.id), questionGroups: selected, questionCount: questions.filter((q) => q.isActive && questionLinks.some((link) => link.questionId === q.id && link.bookTypeId === type.id)).length }; return detail ? { ...result, questions: questions.filter((q) => q.isActive && questionLinks.some((link) => link.questionId === q.id && link.bookTypeId === type.id)).sort(sorter) } : result; }
function isMissingCoverTableError(error, key) {
  return USE_SUPABASE && String(error?.message || "").includes("PGRST205") && String(error?.message || "").includes(`public.${tables[key].table}`);
}
async function listCoverData(key) {
  try {
    return await list(key);
  } catch (error) {
    if (isMissingCoverTableError(error, key)) {
      console.warn(`표지 관리 테이블이 없어 ${key}를 빈 목록으로 처리합니다. Supabase 마이그레이션을 적용하세요.`);
      return [];
    }
    throw error;
  }
}
async function presentCoverColors(admin = false) { return (await listCoverData("coverColors")).filter((item) => admin || item.isActive !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id)).map(presentCoverColor); }
async function presentCoverImages(admin = false) { return (await listCoverData("coverImages")).filter((item) => admin || item.isActive !== false).sort((a, b) => Number(a.column) - Number(b.column) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id)).map(presentCoverImage); }
async function presentCoverOptions() { return { colors: await presentCoverColors(false), images: await presentCoverImages(false) }; }
function presentCoverColor(color) { return { ...color }; }
function presentCoverImage(image) { return { ...image, imageUrl: image.imagePath?.startsWith("data:") || image.imagePath?.startsWith("/") ? image.imagePath : publicCoverImageUrl(image.imagePath) }; }
async function presentBooks(ownerId = null) {
  const giftedBookIds = ownerId ? new Set((await list("gifts")).map((gift) => Number(gift.bookId))) : new Set();
  return Promise.all((await list("books")).filter((book) => (!ownerId || book.ownerId === ownerId) && !giftedBookIds.has(Number(book.id))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map((book) => presentBook(book)));
}
async function presentBooksForGift(giftId) { const gift = await get("gifts", giftId); if (!gift || gift.status !== "active" || gift.revokedAt) return []; const book = await get("books", gift.bookId); return book ? [await presentBook(book)] : []; }
async function presentAdminGifts() {
  const gifts = (await list("gifts")).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const rows = await Promise.all(gifts.map(async (gift) => {
    const book = await get("books", gift.bookId);
    if (!book) return null;
    const presentedBook = await presentBook(book);
    return { id: gift.id, sender: presentedBook.sender, receiver: presentedBook.receiver, title: presentedBook.title, bookTypeName: presentedBook.bookTypeName, progress: presentedBook.progress, createdAt: gift.createdAt, lastAccessedAt: gift.lastAccessedAt, status: gift.status };
  }));
  return rows.filter(Boolean);
}
async function presentUserGifts(userId) {
  const gifts = (await list("gifts")).filter((gift) => gift.senderUserId === userId).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const rows = await Promise.all(gifts.map(async (gift) => {
    const book = await get("books", gift.bookId);
    if (!book) return null;
    const presentedBook = await presentBook(book);
    return { id: gift.id, receiver: presentedBook.receiver, title: presentedBook.title, bookTypeName: presentedBook.bookTypeName, progress: presentedBook.progress, createdAt: gift.createdAt, lastAccessedAt: gift.lastAccessedAt, status: gift.status };
  }));
  return rows.filter(Boolean);
}
async function presentBook(book, detail = false) { const type = await get("bookTypes", book.bookTypeId); const answers = (await list("answers")).filter((a) => a.myBookId === book.id); const publication = (await list("publications")).filter((item) => item.myBookId === book.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).at(-1); const done = answers.filter((a) => a.isFinal || a.answer.trim()).length; const result = { ...book, bookTypeName: type?.name || "알 수 없는 북타입", coverImage: publication?.coverImage || type?.coverImage || "classic", coverImageSelected: Boolean(publication?.coverImage), coverColor: publication?.coverColor || type?.coverColor, coverColorSelected: Boolean(publication?.coverColor), textColor: type?.textColor, coverStyle: publication?.coverStyle || "classic", totalQuestions: answers.length, completedQuestions: done, progress: answers.length ? Math.round(done / answers.length * 100) : 0 }; result.coverImageUrl = publicCoverImageUrl(result.coverImage); return detail ? { ...result, outline: await bookOutline(book) } : result; }
async function bookOutline(book) { const [groups, questions, answers] = await Promise.all([list("groups"), list("questions"), list("answers")]); const ownAnswers = answers.filter((a) => a.myBookId === book.id); const items = ownAnswers.map((a) => ({ ...a, question: questions.find((q) => q.id === a.questionId) })).filter((a) => a.question); const outline = groups.sort(sorter).map((group) => ({ ...group, imageUrl: group.imagePath?.startsWith("data:") ? group.imagePath : publicHomeBannerUrl(group.imagePath), questions: items.filter((item) => item.question.questionGroupId === group.id).sort((a, b) => sorter(a.question, b.question)).map((item) => ({ ...item.question, answerId: item.id, answer: item.answer, isFinal: item.isFinal, updatedAt: item.updatedAt })) })).filter((group) => group.questions.length); const total = items.length; const completed = items.filter((a) => a.isFinal || a.answer.trim()).length; return { groups: outline, total, completed, progress: total ? Math.round(completed / total * 100) : 0 }; }

async function validateQuestion(body) { if (!String(body.content || "").trim()) return "질문 내용을 입력하세요."; if (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1) return "질문 순서는 1 이상의 숫자여야 합니다."; if (!(await get("groups", Number(body.questionGroupId)))) return "질문그룹을 선택하세요."; if (!Array.isArray(body.bookTypeIds) || !body.bookTypeIds.length) return "하나 이상의 북타입을 선택하세요."; const types = await list("bookTypes"); if (body.bookTypeIds.some((id) => !types.some((type) => type.id === Number(id)))) return "유효하지 않은 북타입입니다."; return null; }
function validateGroup(body, groups, id) { if (!String(body.name || "").trim()) return "그룹명을 입력하세요."; if (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1) return "정렬순서는 1 이상의 숫자여야 합니다."; if (groups.some((g) => g.id !== id && g.name === body.name.trim())) return "이미 등록된 그룹명입니다."; return null; }
async function validateBookType(body, id) { if (!String(body.name || "").trim()) return "책 제목을 입력하세요."; if (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1) return "노출 순서는 1 이상의 숫자여야 합니다."; if (!/^#[0-9a-fA-F]{6}$/.test(String(body.coverColor || "#00BC3C"))) return "표지 색상을 지정하세요."; if (!/^#[0-9a-fA-F]{6}$/.test(String(body.textColor || "#FFFFFF"))) return "텍스트 색상을 지정하세요."; if (!Array.isArray(body.questionGroupIds) || !body.questionGroupIds.length) return "하나 이상의 질문그룹을 선택하세요."; if ((await list("bookTypes")).some((t) => t.id !== id && t.name === body.name.trim())) return "이미 등록된 책 제목입니다."; const groups = await list("groups"); if (body.questionGroupIds.some((groupId) => !groups.some((g) => g.id === Number(groupId)))) return "유효하지 않은 질문그룹입니다."; return null; }
function normalQuestion(body) { return { content: body.content.trim(), description: String(body.description || "").trim(), questionGroupId: Number(body.questionGroupId), sortOrder: Number(body.sortOrder) || 1, isActive: body.isActive !== false && body.isActive !== "false" }; }
async function setQuestionBookTypes(questionId, typeIds = []) { await deleteWhere("questionBookTypes", (row) => row.questionId === Number(questionId)); for (const bookTypeId of [...new Set(typeIds.map(Number))]) await create("questionBookTypes", { questionId: Number(questionId), bookTypeId }); }
async function questionIdsForType(typeId) { const links = await list("questionBookTypes"); return (await list("questions")).filter((q) => q.isActive && links.some((link) => link.questionId === q.id && link.bookTypeId === typeId)).sort(sorter).map((q) => q.id); }
async function reorderQuestions(id, desiredOrder, questionGroupId, sourceQuestions = null) {
  const questions = (sourceQuestions || await list("questions")).filter((question) => question.questionGroupId === Number(questionGroupId));
  const target = id === null ? null : questions.find((question) => question.id === id);
  const ordered = questions.filter((question) => question.id !== id).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id));
  if (target) ordered.splice(Math.min(Math.max(Number(desiredOrder) || 1, 1), questions.length) - 1, 0, target);
  for (const [index, question] of ordered.entries()) if (Number(question.sortOrder) !== index + 1 || question.id === id) await update("questions", question.id, { sortOrder: index + 1 });
}
async function setTypeGroups(typeId, groupIds) { await deleteWhere("bookTypeGroups", (row) => row.bookTypeId === typeId); for (const questionGroupId of [...new Set(groupIds.map(Number))]) await create("bookTypeGroups", { bookTypeId: typeId, questionGroupId }); }
async function findAnswer(bookId, questionId) { return (await list("answers")).find((answer) => answer.myBookId === bookId && answer.questionId === questionId); }

async function list(key) { const config = tables[key]; if (!USE_SUPABASE) return localRead(config.file); const rows = await supabase(`/${config.table}?select=*`); return rows.map(config.map.from); }
async function get(key, id) { return (await list(key)).find((item) => item.id === id) || null; }
async function create(key, item) { const now = new Date().toISOString(); const value = { ...item, createdAt: item.createdAt || now, updatedAt: item.updatedAt || now }; if (!USE_SUPABASE) { const values = await localRead(tables[key].file); value.id = value.id || nextId(values); values.push(value); await localWrite(tables[key].file, values); return value; } const rows = await supabase(`/${tables[key].table}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(tables[key].map.to(value)) }); return tables[key].map.from(rows[0]); }
async function update(key, id, change) { const value = { ...change, updatedAt: new Date().toISOString() }; if (!USE_SUPABASE) { const values = await localRead(tables[key].file); const index = values.findIndex((item) => item.id === id); values[index] = { ...values[index], ...value }; await localWrite(tables[key].file, values); return values[index]; } const rows = await supabase(`/${tables[key].table}?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(tables[key].map.to(value)) }); return tables[key].map.from(rows[0]); }
async function remove(key, id) { if (!USE_SUPABASE) return localWrite(tables[key].file, (await localRead(tables[key].file)).filter((item) => item.id !== id)); await supabase(`/${tables[key].table}?id=eq.${id}`, { method: "DELETE" }); }
async function deleteWhere(key, test) { for (const item of await list(key)) if (test(item)) { if (!USE_SUPABASE) await remove(key, item.id); else { const query = key === "bookTypeGroups" ? `book_type_id=eq.${item.bookTypeId}&question_group_id=eq.${item.questionGroupId}` : key === "questionBookTypes" ? `question_id=eq.${item.questionId}&book_type_id=eq.${item.bookTypeId}` : `id=eq.${item.id}`; await supabase(`/${tables[key].table}?${query}`, { method: "DELETE" }); } } }
async function reorderBookTypes(id, desiredOrder, sourceTypes = null) {
  const types = sourceTypes || await list("bookTypes");
  const target = types.find((type) => type.id === id);
  if (!target) return;
  const ordered = types.filter((type) => type.id !== id).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id));
  const position = Math.min(Math.max(Number(desiredOrder) || 1, 1), types.length) - 1;
  ordered.splice(position, 0, target);
  for (const [index, type] of ordered.entries()) {
    if (Number(type.sortOrder) !== index + 1 || type.id === id) await update("bookTypes", type.id, { sortOrder: index + 1 });
  }
}
async function reorderQuestionGroups(id, desiredOrder, sourceGroups = null) {
  const groups = sourceGroups || await list("groups");
  const target = id === null ? null : groups.find((group) => group.id === id);
  const ordered = groups.filter((group) => group.id !== id).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id));
  if (target) {
    const position = Math.min(Math.max(Number(desiredOrder) || 1, 1), groups.length) - 1;
    ordered.splice(position, 0, target);
  }
  for (const [index, group] of ordered.entries()) {
    if (Number(group.sortOrder) !== index + 1 || group.id === id) await update("groups", group.id, { sortOrder: index + 1 });
  }
}
async function localRead(file) { try { return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
async function localWrite(file, value) { await writeFile(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function nextId(items) { return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1; }
function buildBookOutputPages(details) {
  const pages = [{ type: "title", title: details.title, coverColor: details.coverColorSelected ? details.coverColor : "#FEAAE8", coverImage: details.coverImageSelected ? (details.coverImageUrl || publicCoverImageUrl(details.coverImage)) : "/assets/cover_girl_02.png" }];
  if (details.sender || details.receiver) pages.push({ type: "recipient", sender: details.sender, receiver: details.receiver, introduction: details.introduction });
  details.outline.groups.forEach((group) => {
    pages.push({ type: "group", imageUrl: group.imageUrl || "" });
    group.questions.forEach((question) => {
      pages.push({ type: "question", question, answer: question.answer || "미작성", continuation: false });
    });
  });
  pages.push({ type: "final", coverColor: details.coverColorSelected ? details.coverColor : "#FEAAE8" });
  let questionPageNumber = 0;
  return pages.map((page) => page.type === "question"
    ? { ...page, showPageNumber: true, pageNumber: ++questionPageNumber }
    : { ...page, showPageNumber: false });
}

function renderBookOutputPage(page, number) {
  const size = ` style="width:148mm;height:210mm;min-height:0;aspect-ratio:148 / 210"`;
  const pageNumber = page.showPageNumber ? `<span class="book-output-number">${page.pageNumber}</span>` : "";
  if (page.type === "title") return `<div class="book-output-page book-output-title" style="width:148mm;height:210mm;min-height:0;aspect-ratio:148 / 210"><div class="publish-book-cover" style="--cover-color:${/^#[0-9a-f]{6}$/i.test(page.coverColor || "") ? page.coverColor : "#FEAAE8"};--cover-scale:1.332"><div class="publish-cover-content"><p class="publish-cover-script">My Story</p><h2>${escapeHtml(page.title)}</h2><div class="publish-cover-bottom"><p class="publish-cover-fixed-copy">자세히 보고 오래보면 모두 어여쁜 인생입니다</p><p class="publish-cover-publisher">북촌꾸러미연구소</p></div></div><img data-cover-image src="${escapeHtml(page.coverImage)}" alt="선택한 표지 이미지"><small class="publish-cover-copyright">© 북촌꾸러미연구소, All rights reserved since 2025.</small></div>${pageNumber}</div>`;
  if (page.type === "recipient") { const message = String(page.introduction || "").trim() ? String(page.introduction) : DEFAULT_RECIPIENT_MESSAGE; return `<div class="book-output-page book-output-recipient"${size}><p class="book-output-recipient-script">My Story</p><div class="book-output-recipient-rule" aria-hidden="true"></div><div class="book-output-recipient-content"><div class="book-output-person"><span>보내는 이</span><div class="book-output-person-name"><p>${escapeHtml(page.sender || "")}</p><i aria-hidden="true"></i></div></div><p class="book-output-recipient-message">${escapeHtml(message)}</p><div class="book-output-person"><span>받는 이</span><div class="book-output-person-name"><p>${escapeHtml(page.receiver || "")}</p><i aria-hidden="true"></i></div></div></div>${pageNumber}</div>`; }
  if (page.type === "greeting") return `<div class="book-output-page book-output-greeting"${size}><div><h2>인사말</h2><p>${escapeHtml(page.introduction)}</p></div>${pageNumber}</div>`;
  if (page.type === "final") return `<div class="book-output-page book-output-final" style="--final-cover-color:${/^#[0-9a-f]{6}$/i.test(page.coverColor || "") ? page.coverColor : "#FEAAE8"}"${size}><p>남은 날들 동안 더없이 사랑하고 사랑받기를<br>북촌꾸러미연구소가 응원합니다.</p>${pageNumber}</div>`;
  if (page.type === "group") return `<div class="book-output-page book-output-group"${size}><div class="book-output-group-content">${page.imageUrl ? `<img src="${escapeHtml(page.imageUrl)}" alt="질문그룹 대표 이미지">` : ""}</div>${pageNumber}</div>`;
  return `<div class="book-output-page book-output-question" data-output-question="true"${size}><div>${page.continuation ? "" : `<h2>${escapeHtml(page.question.content)}</h2>`}<p class="book-output-answer">${escapeHtml(page.answer)}</p></div>${pageNumber}</div>`;
}

async function renderBookOutput(req, res, id, print) {
  const book = await get("books", id);
  if (!book) return sendText(res, 404, "Not Found");
  const access = await authenticateRequest(req, res);
  if (!access) return sendText(res, 401, "로그인이 필요합니다.");
  if (!authorizeBookAccess(book, access)) return sendText(res, 404, "Not Found");
  const details = await presentBook(book, true);
  const pages = buildBookOutputPages(details);
  const body = `<style>@page{size:A5 portrait;margin:0}.book-output-answer{width:100%;height:calc(13 * 41.6px);margin:0;color:#b26d3b;font:700 16px/2.6 "Apple SD Gothic Neo",sans-serif;letter-spacing:-.64px;white-space:pre-wrap;word-break:keep-all;overflow-wrap:normal;overflow:hidden;background:repeating-linear-gradient(to bottom,transparent 0,transparent 40.6px,#eadfd8 40.6px,#eadfd8 41.6px);background-size:100% 41.6px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.book-output-script{font-family:"Reenie Beanie",cursive;color:#FFFFFF}.book-output-fixed-copy{max-width:205px;margin:48px auto 0;color:#FFFFFF;font:400 12px/1.8 "Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;word-break:keep-all}.book-output-cover-image{display:block;width:100px;height:150px;margin:24px auto 0;object-fit:contain}.book-output-title h1{color:#363636}.book-output-publisher{margin:20px 0 0;color:#363636;font:700 13px/1.8 "Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif}.book-output-copyright{position:absolute;right:20px;bottom:74px;color:#FFFFFF;font:400 8px/1.4 "Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;text-align:right;writing-mode:vertical-rl;white-space:nowrap}</style>${pages.map((page, index) => renderBookOutputPage(page, index + 1)).join("")}`;
  const title = `${escapeHtml(book.title)}${print ? "" : " 미리보기"}`;
  const paginateScript = `<script>
    const OUTPUT_LINES_PER_PAGE = 13;
    function outputLineCount(text, source) {
      const measure = document.createElement("p");
      const style = getComputedStyle(source);
      measure.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;left:-99999px;top:0;box-sizing:border-box;";
      measure.style.width = source.getBoundingClientRect().width + "px";
      measure.style.font = style.font;
      measure.style.letterSpacing = style.letterSpacing;
      measure.style.whiteSpace = "pre-wrap";
      measure.style.wordBreak = style.wordBreak;
      measure.style.overflowWrap = style.overflowWrap;
      measure.textContent = text || " ";
      document.body.append(measure);
      const range = document.createRange();
      range.selectNodeContents(measure);
      const tops = [...range.getClientRects()].map((rect) => Math.round(rect.top * 10) / 10);
      measure.remove();
      return Math.max(1, new Set(tops).size, String(text || "").split("\\n").length);
    }
    function splitOutputAnswer(text, source) {
      let remaining = String(text || "미작성");
      const chunks = [];
      while (remaining.length) {
        let low = 1;
        let high = remaining.length;
        let best = 0;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          if (outputLineCount(remaining.slice(0, middle), source) <= OUTPUT_LINES_PER_PAGE) { best = middle; low = middle + 1; }
          else high = middle - 1;
        }
        if (!best) best = 1;
        chunks.push(remaining.slice(0, best));
        remaining = remaining.slice(best);
      }
      return chunks.length ? chunks : ["미작성"];
    }
    function paginateOutput() {
      document.querySelectorAll(".book-output-page[data-output-question]").forEach((page) => {
        const answer = page.querySelector(".book-output-answer");
        if (!answer || page.dataset.paginated) return;
        page.dataset.paginated = "true";
        const chunks = splitOutputAnswer(answer.textContent, answer);
        const fragment = document.createDocumentFragment();
        chunks.forEach((chunk, index) => {
          const next = page.cloneNode(true);
          next.dataset.paginated = "true";
          const heading = next.querySelector("h2");
          if (index > 0) heading?.remove();
          next.querySelector(".book-output-answer").textContent = chunk;
          fragment.append(next);
        });
        page.replaceWith(fragment);
      });
      document.querySelectorAll(".book-output-page[data-output-question]").forEach((page, index) => {
        const number = page.querySelector(".book-output-number");
        if (number) number.textContent = String(index + 1);
      });
    }
    const outputReady = document.fonts?.ready || Promise.resolve();
    const imagesReady = Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); })));
    Promise.all([outputReady, imagesReady]).then(() => { paginateOutput(); ${print ? "window.print();" : ""} });
  </script>`;
  sendHtml(res, `<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Reenie+Beanie&display=swap" rel="stylesheet"><title>${title}</title><style>
    @font-face{font-family:"KoPub Batang";src:url("/node_modules/@noonnu/ko-pub-batang/fonts/kopub-batang-400.woff2") format("woff2");font-weight:400}
    *{box-sizing:border-box}body{margin:0;background:#eee8e2;color:#363636;font-family:"Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif}.book-output{display:flex;flex-direction:column;align-items:center;gap:32px;padding:48px 20px}.book-output-page{position:relative;width:148mm;height:210mm;min-height:0;padding:22mm 16mm 18mm;background:#fff;box-shadow:0 8px 24px #4c33201f;overflow:hidden;break-after:page}.book-output-page>div{position:relative;z-index:1}.book-output-number{position:absolute;right:16mm;bottom:8mm;color:#756d63;font:400 14px Rubik,sans-serif}.book-output-title,.book-output-recipient,.book-output-greeting{display:flex;align-items:center;justify-content:center;text-align:center}.book-output-recipient{background:#fffdf9}.book-output-recipient-script{position:absolute;top:50px;left:65px;margin:0;color:#fff;font:400 40px/1 "Reenie Beanie",cursive;white-space:nowrap}.book-output-recipient-rule{position:absolute;top:0;left:20px;width:1px;height:595px;background:rgba(255,255,255,.2)}.book-output-title h1{margin:0;color:#3a3333;font:400 34px/1.8 "KoPub Batang",serif;letter-spacing:-1.7px;word-break:keep-all}.book-output-script{margin:0 0 18px;color:#c5a58e;font:40px/1 Reenie Beanie,cursive}.book-output-recipient-content{display:flex;flex-direction:column;align-items:center;gap:60px;width:196px}.book-output-person{display:flex;flex-direction:column;align-items:center;gap:20px;width:max-content;min-width:138px;max-width:100%}.book-output-person>span{color:#008b21;font:400 11px/1.8 "Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;letter-spacing:-.44px;white-space:nowrap}.book-output-person-name{display:flex;flex-direction:column;align-items:center;width:max-content;max-width:100%}.book-output-recipient-message{width:196px;color:#b26d3b;font:400 12px/1.8 "KoPub Batang",serif;letter-spacing:-.48px;text-align:center;white-space:pre-wrap;word-break:keep-all}.book-output-recipient-message p{margin:0}.book-output-person-name p{margin:0;color:#363636;font:400 20px/1.9 "KoPub Batang",serif;letter-spacing:-.8px;white-space:nowrap}.book-output-person-name i{display:block;width:100%;height:1px;margin-top:0;background:#b9a89c;opacity:.7}.book-output-greeting>div{width:100%;max-width:560px}.book-output-greeting h2{margin:0 0 28px;color:#3fc85f;font:400 17px/1.8 Rubik,sans-serif}.book-output-greeting p{margin:0;color:#b26d3b;font:700 16px/2.6 "Apple SD Gothic Neo",sans-serif;letter-spacing:-.64px;white-space:pre-wrap;text-align:left}.book-output-final{display:flex;align-items:center;justify-content:center;text-align:center;background:var(--final-cover-color,#FEAAE8);-webkit-print-color-adjust:exact;print-color-adjust:exact}.book-output-final p{margin:0;color:#363636;font:400 14px/1.8 "KoPub Batang",serif;white-space:pre-wrap}.book-output-group{display:block;width:100%;height:100%;padding:0;background:#FFFDF9}.book-output-page>.book-output-group-content{position:absolute;inset:16mm;display:flex;align-items:center;justify-content:flex-end;width:auto;height:auto;min-width:0;box-sizing:border-box;overflow:visible}.book-output-group img{display:block;flex:0 1 240px;width:240px;height:180px;max-width:100%;max-height:100%;min-width:0;object-fit:contain;object-position:center}.book-output-question{display:flex;align-items:flex-start}.book-output-question>div{width:100%;min-width:0}.book-output-question h2{margin:0 0 36px;color:#3fc85f;font:400 25px/1.8 "KoPub Batang",serif;letter-spacing:-1.25px;word-break:keep-all}.book-output-question p{margin:0;color:#b26d3b;font:700 16px/2.6 "Apple SD Gothic Neo",sans-serif;letter-spacing:-.64px;white-space:normal;word-break:keep-all;overflow-wrap:normal}@media print{body{background:#fff}.book-output{display:block;padding:0}.book-output-page{width:148mm;height:210mm;min-height:0;margin:0;padding:22mm 16mm 18mm;box-shadow:none;page-break-after:always;break-after:page}.book-output-page:last-child{page-break-after:auto;break-after:auto}.book-output-group{width:100%;height:100%;padding:0}.book-output-page>.book-output-group-content{inset:0;width:100%;height:100%;max-width:none;padding:16mm;box-sizing:border-box;overflow:hidden}.book-output-group img{width:240px;height:180px;max-width:100%;max-height:100%;object-fit:contain}}
  </style><style>.book-output-title{display:block;padding:0;background:transparent;text-align:left}.book-output-title .publish-book-cover{width:100%;height:100%;--cover-scale:1.332;background-color:var(--cover-color,#feaae8);-webkit-print-color-adjust:exact;print-color-adjust:exact}.book-output-title .publish-cover-content{height:100%}@media print{.book-output-title .publish-book-cover{background-color:var(--cover-color,#feaae8)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style><body><main class="book-output">${body}</main>${paginateScript}</body></html>`);
}

async function supabase(pathname, options = {}) { const response = await fetch(`${SUPABASE_URL}/rest/v1${pathname}`, { ...options, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Supabase 오류: ${await response.text()}`); const text = await response.text(); return text ? JSON.parse(text) : []; }

function groupMap(row) { return { id: row.id, name: row.name, description: row.description || "", imagePath: row.image_path || "", sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }; } groupMap.from = groupMap; groupMap.to = (v) => fields(v, { name: "name", description: "description", imagePath: "image_path", sortOrder: "sort_order", updatedAt: "updated_at" });
function questionMap(row) { return { id: row.id, content: row.content, description: row.description || "", questionGroupId: row.question_group_id, sortOrder: row.sort_order, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at }; } questionMap.from = questionMap; questionMap.to = (v) => fields(v, { content: "content", description: "description", questionGroupId: "question_group_id", sortOrder: "sort_order", isActive: "is_active", updatedAt: "updated_at" });
function questionBookTypeMap(row) { return { id: row.id || `${row.question_id}-${row.book_type_id}`, questionId: row.question_id, bookTypeId: row.book_type_id }; } questionBookTypeMap.from = questionBookTypeMap; questionBookTypeMap.to = (v) => ({ question_id: v.questionId, book_type_id: v.bookTypeId });
function bookTypeMap(row) { return { id: row.id, name: row.name, description: row.description || "", coverImage: row.cover_image || "classic", coverColor: row.cover_color || "#00BC3C", textColor: row.text_color || "#FFFFFF", sortOrder: row.sort_order || 1, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at }; } bookTypeMap.from = bookTypeMap; bookTypeMap.to = (v) => fields(v, { name: "name", description: "description", coverImage: "cover_image", coverColor: "cover_color", textColor: "text_color", sortOrder: "sort_order", isActive: "is_active", updatedAt: "updated_at" });
function linkMap(row) { return { id: row.id || `${row.book_type_id}-${row.question_group_id}`, bookTypeId: row.book_type_id, questionGroupId: row.question_group_id }; } linkMap.from = linkMap; linkMap.to = (v) => ({ book_type_id: v.bookTypeId, question_group_id: v.questionGroupId });
function bookMap(row) { return { id: row.id, ownerId: row.owner_id || null, bookTypeId: row.book_type_id, title: row.title, sender: row.sender || "", receiver: row.receiver || "", introduction: row.introduction || "", status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at }; } bookMap.from = bookMap; bookMap.to = (v) => fields(v, { ownerId: "owner_id", bookTypeId: "book_type_id", title: "title", sender: "sender", receiver: "receiver", introduction: "introduction", status: "status", updatedAt: "updated_at", publishedAt: "published_at" });
function answerMap(row) { return { id: row.id, myBookId: row.my_book_id, questionId: row.question_id, answer: row.answer || "", isFinal: row.is_final, createdAt: row.created_at, updatedAt: row.updated_at }; } answerMap.from = answerMap; answerMap.to = (v) => fields(v, { myBookId: "my_book_id", questionId: "question_id", answer: "answer", isFinal: "is_final", updatedAt: "updated_at" });
function publicationMap(row) { return { id: row.id, myBookId: row.my_book_id, coverStyle: row.cover_style, coverColor: row.cover_color || null, coverImage: row.cover_image || null, createdAt: row.created_at }; } publicationMap.from = publicationMap; publicationMap.to = (v) => fields(v, { myBookId: "my_book_id", coverStyle: "cover_style", coverColor: "cover_color", coverImage: "cover_image" });
function giftMap(row) { return { id: row.id, bookId: row.book_id, senderUserId: row.sender_user_id || null, senderEmail: row.sender_email || null, status: row.status, giftCodeHash: row.gift_code_hash, codeVersion: row.code_version, createdAt: row.created_at, updatedAt: row.updated_at, lastAccessedAt: row.last_accessed_at, codeIssuedAt: row.code_issued_at, revokedAt: row.revoked_at }; } giftMap.from = giftMap; giftMap.to = (v) => fields(v, { bookId: "book_id", senderUserId: "sender_user_id", senderEmail: "sender_email", status: "status", giftCodeHash: "gift_code_hash", codeVersion: "code_version", updatedAt: "updated_at", lastAccessedAt: "last_accessed_at", codeIssuedAt: "code_issued_at", revokedAt: "revoked_at" });
function giftSessionMap(row) { return { id: row.id, giftId: row.gift_id, sessionTokenHash: row.session_token_hash, createdAt: row.created_at, lastAccessedAt: row.last_accessed_at, expiresAt: row.expires_at, revokedAt: row.revoked_at, userAgent: row.user_agent || null }; } giftSessionMap.from = giftSessionMap; giftSessionMap.to = (v) => fields(v, { id: "id", giftId: "gift_id", sessionTokenHash: "session_token_hash", lastAccessedAt: "last_accessed_at", expiresAt: "expires_at", revokedAt: "revoked_at", userAgent: "user_agent" });
function coverColorMap(row) { return { id: row.id, name: row.name, colorValue: row.color_value, sortOrder: row.sort_order, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at }; } coverColorMap.from = coverColorMap; coverColorMap.to = (v) => fields(v, { name: "name", colorValue: "color_value", sortOrder: "sort_order", isActive: "is_active", updatedAt: "updated_at" });
function coverImageMap(row) { return { id: row.id, name: row.name, imagePath: row.image_path, column: row.image_column, sortOrder: row.sort_order, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at }; } coverImageMap.from = coverImageMap; coverImageMap.to = (v) => fields(v, { name: "name", imagePath: "image_path", column: "image_column", sortOrder: "sort_order", isActive: "is_active", updatedAt: "updated_at" });
function homeReviewMap(row) { return { id: row.id, relationship: row.relationship, author: row.author, body: row.body, variant: row.variant || "", isVisible: row.is_visible, sortOrder: row.sort_order, publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at }; } homeReviewMap.from = homeReviewMap; homeReviewMap.to = (v) => fields(v, { relationship: "relationship", author: "author", body: "body", variant: "variant", isVisible: "is_visible", sortOrder: "sort_order", publishedAt: "published_at", updatedAt: "updated_at" });
function homeBannerMap(row) { return { id: row.id, imagePath: row.image_path, caption: row.caption || "", linkUrl: row.link_url || "", position: row.position, isVisible: row.is_visible, createdAt: row.created_at, updatedAt: row.updated_at }; } homeBannerMap.from = homeBannerMap; homeBannerMap.to = (v) => fields(v, { id: "id", imagePath: "image_path", caption: "caption", linkUrl: "link_url", position: "position", isVisible: "is_visible", createdAt: "created_at", updatedAt: "updated_at" });
function momentAuthorMap(row) { return { id: row.id, displayName: row.display_name, role: row.role, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at }; } momentAuthorMap.from = momentAuthorMap; momentAuthorMap.to = (v) => fields(v, { id: "id", displayName: "display_name", role: "role", isActive: "is_active", updatedAt: "updated_at" });
function momentSlotMap(row) { return { id: row.id, authorId: row.author_id, slotTime: String(row.slot_time).slice(0, 5), isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at }; } momentSlotMap.from = momentSlotMap; momentSlotMap.to = (v) => fields(v, { id: "id", authorId: "author_id", slotTime: "slot_time", isActive: "is_active", updatedAt: "updated_at" });
function momentEntryMap(row) { return { id: row.id, slotId: row.slot_id, momentDate: row.moment_date, body: row.body, isVisible: row.is_visible, publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at }; } momentEntryMap.from = momentEntryMap; momentEntryMap.to = (v) => fields(v, { id: "id", slotId: "slot_id", momentDate: "moment_date", body: "body", isVisible: "is_visible", publishedAt: "published_at", updatedAt: "updated_at" });
function fields(value, mapping) { return Object.fromEntries(Object.entries(mapping).filter(([key]) => key in value).map(([key, db]) => [db, value[key]])); }
function sorter(a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || a.content || "").localeCompare(String(b.name || b.content || ""), "ko"); }

async function renderPrint(res, id) { const book = await get("books", id); if (!book) return sendText(res, 404, "Not Found"); const details = await presentBook(book, true); const body = details.outline.groups.map((group) => `<section><div class="group-divider"><h2>${escapeHtml(group.name)}</h2>${group.imageUrl ? `<img src="${escapeHtml(group.imageUrl)}" alt="${escapeHtml(group.name)} 대표 이미지">` : ""}</div>${group.questions.map((q) => `<article><h3>${escapeHtml(q.content)}</h3><p>${escapeHtml(q.answer || "미작성")}</p></article>`).join("")}</section>`).join(""); sendHtml(res, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>body{max-width:760px;margin:48px auto;font:16px/1.7 Georgia,'Noto Serif KR',serif;color:#222}h1{text-align:center;font-size:42px;margin-top:160px}.group-divider{display:flex;align-items:center;justify-content:flex-end;gap:24px;min-height:260px;padding-top:40px;padding-bottom:40px;padding-right:40px;background:#FFFDF9}.group-divider h2{margin:0;border-bottom:1px solid #aaa;padding-bottom:8px}.group-divider img{display:block;width:auto;max-width:240px;height:auto;max-height:180px;object-fit:contain}h3{font-size:18px;margin-top:32px}p{white-space:pre-wrap}@media print{body{margin:0}section{break-before:page}}</style><body><h1>${escapeHtml(book.title)}</h1><p style="text-align:center">${escapeHtml(book.sender)} → ${escapeHtml(book.receiver)}</p><p style="text-align:center">${escapeHtml(book.introduction)}</p>${body}<script>window.onload=()=>window.print()</script></body></html>`); }
async function renderPreview(res, id) { const book = await get("books", id); if (!book) return sendText(res, 404, "Not Found"); const details = await presentBook(book, true); const body = details.outline.groups.map((group) => `<section><div class="group-divider"><h2>${escapeHtml(group.name)}</h2>${group.imageUrl ? `<img src="${escapeHtml(group.imageUrl)}" alt="${escapeHtml(group.name)} 대표 이미지">` : ""}</div>${group.questions.map((q) => `<article><h3>${escapeHtml(q.content)}</h3><p>${escapeHtml(q.answer || "미작성")}</p></article>`).join("")}</section>`).join(""); sendHtml(res, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${escapeHtml(book.title)} 미리보기</title><style>body{max-width:760px;margin:48px auto;font:16px/1.7 Georgia,'Noto Serif KR',serif;color:#222;background:#fffdf8}header{margin-bottom:64px;padding-bottom:24px;border-bottom:1px solid #ddd}small{color:#756d63;letter-spacing:1px}h1{text-align:center;font-size:42px;margin:44px 0 12px}.group-divider{display:flex;align-items:center;justify-content:flex-end;gap:24px;min-height:260px;padding-top:40px;padding-bottom:40px;padding-right:40px;background:#FFFDF9}.group-divider h2{margin:0;border-bottom:1px solid #aaa;padding-bottom:8px}.group-divider img{display:block;width:auto;max-width:240px;height:auto;max-height:180px;object-fit:contain}h3{font-size:18px;margin-top:32px}p{white-space:pre-wrap}</style><body><header><small>MY STORY · 미리보기</small><h1>${escapeHtml(book.title)}</h1><p style="text-align:center">${escapeHtml(book.sender)} → ${escapeHtml(book.receiver)}</p><p style="text-align:center">${escapeHtml(book.introduction)}</p></header>${body}</body></html>`); }
async function serveStatic(res, pathname) {
  // 기존 단일 질문 관리 화면은 새 통합 관리자 화면으로 통합했다.
  if (pathname === "/question-management.html") {
    res.writeHead(302, { Location: "/#admin/questions" });
    res.end();
    return;
  }
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(__dirname, requested));
  if (!filePath.startsWith(__dirname)) return sendText(res, 403, "Forbidden");
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    sendText(res, 404, "Not Found");
  }
}
async function readJsonBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; } catch { return {}; } }
async function loadEnvFile() { try { const text = await readFile(path.join(__dirname, ".env"), "utf8"); text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#")).forEach((line) => { const i = line.indexOf("="); if (i > 0 && !(line.slice(0, i).trim() in process.env)) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); }); } catch (error) { if (error.code !== "ENOENT") throw error; } }
function sendJson(res, status, data) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); }
function sendText(res, status, value) { res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }); res.end(value); }
function sendHtml(res, value) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(value); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
