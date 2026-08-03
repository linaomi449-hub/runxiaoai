// 润小爱代理后端 · 零依赖 Node 服务
// 作用：前端 → 本服务 → 腾讯元器对话 API，避免在前端暴露 appkey
// 运行：YUANQI_APPKEY=xxxx node server.js   （appid 可用环境变量 YUANQI_APPID 覆盖，默认已填本项目）

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 从 .env 读取环境变量（若存在）；便于本地运行，生产请用真实环境变量
try {
  const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envText.split('\n').forEach(function (line) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  });
} catch (e) { /* 无 .env 则使用系统环境变量 */ }

const APPKEY = process.env.YUANQI_APPKEY;
const DEFAULT_APPID = process.env.YUANQI_APPID || '2083169587444756736';
const PORT = process.env.PORT || 3000;
const YUANQI_ENDPOINT = 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions';

if (!APPKEY) {
  console.error('[错误] 缺少环境变量 YUANQI_APPKEY。请先设置后再启动：');
  console.error('  Windows :  set YUANQI_APPKEY=你的appkey');
  console.error('  macOS/Linux:  export YUANQI_APPKEY=你的appkey');
  process.exit(1);
}

// 统一响应头（含 CORS，便于本地 file:// 直接打开也能调用；生产可收紧为具体域名）
const JSONHEAD = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// 兼容元器返回 content 为字符串或 [{type:"text",text:"..."}] 数组
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(function (c) {
      if (!c) return '';
      return (typeof c.text === 'string') ? c.text : '';
    }).join('');
  }
  return '';
}

// 调用元器对话 API
function callYuanqi(appid, messages, res) {
  const payload = JSON.stringify({
    assistant_id: appid,
    user_id: 'runxiaobao_web',
    stream: false,
    messages: messages.map(function (m) {
      return { role: m.role, content: [{ type: 'text', text: m.text }] };
    })
  });

  const url = new URL(YUANQI_ENDPOINT);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + APPKEY,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, function (r) {
    let data = '';
    r.on('data', function (chunk) { data += chunk; });
    r.on('end', function () {
      let body;
      try { body = JSON.parse(data); }
      catch (e) {
        res.writeHead(502, JSONHEAD);
        return res.end(JSON.stringify({ error: '元器响应解析失败', detail: String(e.message) }));
      }
      const choice = body && body.choices && body.choices[0];
      const reply = choice ? extractText(choice.message && choice.message.content) : '';
      if (!reply) {
        res.writeHead(502, JSONHEAD);
        return res.end(JSON.stringify({ error: '元器返回为空或无回答', raw: data.slice(0, 300) }));
      }
      res.writeHead(200, JSONHEAD);
      res.end(JSON.stringify({ reply: reply }));
    });
  });

  req.on('error', function (e) {
    res.writeHead(502, JSONHEAD);
    res.end(JSON.stringify({ error: '调用元器失败', detail: e.message }));
  });
  req.on('timeout', function () { req.destroy(); });

  req.write(payload);
  req.end();
}

const server = http.createServer(function (req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, JSONHEAD);
    return res.end();
  }

  // 对话接口
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch (e) {
        res.writeHead(400, JSONHEAD);
        return res.end(JSON.stringify({ error: '请求体 JSON 解析失败' }));
      }
      const messages = parsed && parsed.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, JSONHEAD);
        return res.end(JSON.stringify({ error: 'messages 不能为空' }));
      }
      callYuanqi(parsed.appid || DEFAULT_APPID, messages, res);
    });
    return;
  }

  // 转人工接口：接收客户微信号，发给元器（作为独立新对话，客服在元器后台对话记录可见）
  if (req.method === 'POST' && req.url === '/api/transfer') {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch (e) {
        res.writeHead(400, JSONHEAD);
        return res.end(JSON.stringify({ error: '请求体 JSON 解析失败' }));
      }
      const wechat = parsed && parsed.wechat;
      if (!wechat || typeof wechat !== 'string') {
        res.writeHead(400, JSONHEAD);
        return res.end(JSON.stringify({ error: 'wechat 字段不能为空' }));
      }
      // 构造一条独立的消息发给元器（不依赖历史交替规则）
      const transferMessages = [
        { role: 'user', text: '[转人工请求] 客户微信号：' + wechat + '。请客服在后台记录该微信号并尽快添加客户微信。' }
      ];
      callYuanqi(parsed.appid || DEFAULT_APPID, transferMessages, res);
    });
    return;
  }

  // 静态托管前端（同源，避免 file:// 的 CORS 问题）
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'runxiaobao-assistant.html');
    fs.readFile(htmlPath, 'utf8', function (err, html) {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('未找到前端文件 runxiaobao-assistant.html');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    return;
  }

  // 静态资源托管（头像、图片等）
  if (req.method === 'GET' && req.url.startsWith('/images/')) {
    const filePath = path.join(__dirname, req.url);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    };
    fs.readFile(filePath, function (err, data) {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('未找到资源');
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, function () {
  console.log('润小爱代理后端已启动: http://localhost:' + PORT);
  console.log('默认助手 appid: ' + DEFAULT_APPID);
  console.log('知识库请在元器后台维护，前端只负责展示与交互。');
});
