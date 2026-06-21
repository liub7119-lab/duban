// mock OpenAI 兼容服务 —— 根据 stream 字段返回流式或非流式
import http from "http";

let callCount = 0;
const server = http.createServer((req, res) => {
  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const req2 = JSON.parse(body || "{}");
      callCount++;
      const reply =
        callCount % 2 === 1
          ? "此章节讲述了主人公的初登场,描绘了世道背景与人物志向。"
          : "全书以主人公的成长为主线,贯穿世事变迁与人情冷暖。";

      if (req2.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
        let i = 0;
        const timer = setInterval(() => {
          if (i < reply.length) {
            const piece = reply.slice(i, i + 4);
            i += 4;
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: piece }, index: 0 }] })}\n\n`
            );
          } else {
            res.write(
              `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 200, completion_tokens: 50 } })}\n\n`
            );
            res.write("data: [DONE]\n\n");
            clearInterval(timer);
            res.end();
          }
        }, 25);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: reply }, index: 0, finish_reason: "stop" }],
            usage: { prompt_tokens: 200, completion_tokens: 50 },
          })
        );
      }
    });
  } else {
    res.writeHead(404).end();
  }
});
server.listen(4321, () => console.log("mock on :4321"));
