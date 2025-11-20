import markdownIt from "markdown-it";

const md = markdownIt({
  html: false,        // 防止 XSS
  linkify: true,
  breaks: true,
});

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const filename = url.searchParams.get("file");

  if (!filename) {
    return Response.json({ ok: false, msg: "Missing markdown file" });
  }

  // 读取 markdown 文件
  try {
    const file = await context.env.ASSETS.fetch(`https://example.com/markdown/${filename}`);
    const text = await file.text();

    const html = md.render(text);

    return Response.json({
      ok: true,
      html,
    });
  } catch (e) {
    return Response.json({ ok: false, msg: "File not found" });
  }
}
