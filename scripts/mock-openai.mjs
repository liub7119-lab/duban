// 本地 mock OpenAI 服务器,验证流式 SSE 端到端
import http from "http";

const server = http.createServer((req, res) => {
  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    const reply = "好的,这是一段流式回复,用以验证「读伴」的边读边聊管线是否正常。";
    // 分块发送
    let i = 0;
    const timer = setInterval(() => {
      if (i < reply.length) {
        const piece = reply.slice(i, i + 3);
        i += 3;
        const chunk = {
          choices: [{ delta: { content: piece }, index: 0 }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      } else {
        // 结束 chunk(带 usage)
        const end = {
          choices: [],
          usage: { prompt_tokens: 120, completion_tokens: 30 },
        };
        res.write(`data: ${JSON.stringify(end)}\n\n`);
        res.write("data: [DONE]\n\n");
        clearInterval(timer);
        res.end();
      }
    }, 40);
  } else {
    res.writeHead(404).end();
  }
});

server.listen(4321, () => console.log("mock openai on :4321"));
