export async function onRequest(context) {
  const db = context.env.blog_comments;
  const request = context.request;
  const url = new URL(request.url);

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

  // ===========================
  // GET：读取评论
  // ===========================
  if (request.method === "GET") {
    const postId = url.searchParams.get("post");
    if (!postId) {
      return Response.json({ ok: false, msg: "Missing post ID" }, { status: 400 });
    }

    const { results } = await db
      .prepare(
        `SELECT id, post_id, nickname, content, created_at
         FROM comments
         WHERE post_id = ?
         ORDER BY id DESC`
      )
      .bind(postId)
      .all();

    return Response.json(results);
  }

  // ===========================
  // POST：写入评论
  // ===========================
  if (request.method === "POST") {
    let data;
    try {
      data = await request.json();
    } catch {
      return Response.json({ ok: false, msg: "Bad JSON" }, { status: 400 });
    }

    const postId = (data.post_id || "").trim();
    const nickname = (data.nickname || "").trim();
    const content = (data.content || "").trim();

    // ---- 基础验证 ----
    if (!postId || !nickname || !content) {
      return Response.json({ ok: false, msg: "缺少必要字段" }, { status: 400 });
    }
    if (nickname.length > 20) {
      return Response.json({ ok: false, msg: "昵称不能超过 20 字" });
    }
    if (content.length > 500) {
      return Response.json({ ok: false, msg: "评论字数不能超过 500 字" });
    }

    // ===========================
    // 防刷机制：每 IP 每文章 10 秒一次
    // ===========================
    const key = `${ip}:${postId}`;
    const timeCheck = await context.env.blog_comments
      .prepare("SELECT created_at FROM comments WHERE post_id = ? ORDER BY id DESC LIMIT 1")
      .bind(postId)
      .all();

    const lastTime = timeCheck.results?.[0]?.created_at;

    if (lastTime) {
      const delta = (Date.now() - new Date(lastTime).getTime()) / 1000;
      if (delta < 10) {
        return Response.json(
          { ok: false, msg: `提交太快啦，请 ${Math.ceil(10 - delta)} 秒后再试！` },
          { status: 429 }
        );
      }
    }

    // ---- 插入数据库 ----
    await db
      .prepare(
        `INSERT INTO comments (post_id, nickname, content, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(postId, nickname, content)
      .run();

    return Response.json({ ok: true, msg: "评论成功" });
  }

  return new Response("Method not allowed", { status: 405 });
}
