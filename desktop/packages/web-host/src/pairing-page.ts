import type { IncomingMessage } from 'node:http';

type PairingStrings = {
  lang: string;
  title: string;
  lead: string;
  code: string;
  name: string;
  namePlaceholder: string;
  submit: string;
  pending: string;
  approved: string;
  rejected: string;
  expired: string;
  invalid: string;
  attempts: string;
  inactive: string;
  network: string;
  already: string;
};

const STRINGS: Record<string, PairingStrings> = {
  en: {
    lang: 'en',
    title: 'Pair this device',
    lead: 'Open Settings → System → Remote access on the desktop, then enter the six-digit code shown there.',
    code: 'Pairing code',
    name: 'Device name',
    namePlaceholder: 'My phone',
    submit: 'Pair',
    pending: 'Waiting for approval on the desktop…',
    approved: 'Approved. Opening spec.jev…',
    rejected: 'The desktop rejected this request.',
    expired: 'The code expired. Ask the desktop for a new code.',
    invalid: 'That code is not valid. Check the desktop and try again.',
    attempts: 'Wrong code. {{n}} attempts left.',
    inactive: 'Remote access is not running on the desktop.',
    network: 'Could not reach the desktop. Check the address and try again.',
    already: 'This device is already paired. Opening spec.jev…',
  },
  'zh-CN': {
    lang: 'zh-CN',
    title: '配对这台设备',
    lead: '在桌面打开 设置 → 系统 → 远程访问，输入显示的六位配对码。',
    code: '配对码',
    name: '设备名称',
    namePlaceholder: '我的手机',
    submit: '配对',
    pending: '等待桌面确认…',
    approved: '已批准，正在打开 spec.jev…',
    rejected: '桌面拒绝了这次请求。',
    expired: '配对码已过期，请在桌面重新生成。',
    invalid: '配对码不正确，请核对后重试。',
    attempts: '配对码错误，还可以尝试 {{n}} 次。',
    inactive: '桌面的远程访问没有运行。',
    network: '无法连接桌面，请检查地址后重试。',
    already: '这台设备已配对，正在打开 spec.jev…',
  },
  'zh-TW': {
    lang: 'zh-TW',
    title: '配對這台裝置',
    lead: '在桌面開啟 設定 → 系統 → 遠端存取，輸入顯示的六位配對碼。',
    code: '配對碼',
    name: '裝置名稱',
    namePlaceholder: '我的手機',
    submit: '配對',
    pending: '等待桌面確認…',
    approved: '已批准，正在開啟 spec.jev…',
    rejected: '桌面拒絕了這次請求。',
    expired: '配對碼已過期，請在桌面重新產生。',
    invalid: '配對碼不正確，請核對後重試。',
    attempts: '配對碼錯誤，還可以嘗試 {{n}} 次。',
    inactive: '桌面的遠端存取沒有執行。',
    network: '無法連線桌面，請檢查位址後重試。',
    already: '這台裝置已配對，正在開啟 spec.jev…',
  },
  ja: {
    lang: 'ja',
    title: 'このデバイスをペアリング',
    lead: 'デスクトップの 設定 → システム → リモートアクセス を開き、表示された 6 桁のコードを入力してください。',
    code: 'ペアリングコード',
    name: 'デバイス名',
    namePlaceholder: '自分のスマートフォン',
    submit: 'ペアリング',
    pending: 'デスクトップでの承認を待っています…',
    approved: '承認されました。spec.jev を開きます…',
    rejected: 'デスクトップがこのリクエストを拒否しました。',
    expired: 'コードの有効期限が切れました。デスクトップで新しいコードを発行してください。',
    invalid: 'コードが正しくありません。デスクトップを確認して再試行してください。',
    attempts: 'コードが違います。残り {{n}} 回です。',
    inactive: 'デスクトップのリモートアクセスが実行されていません。',
    network: 'デスクトップに接続できません。アドレスを確認して再試行してください。',
    already: 'このデバイスはペアリング済みです。spec.jev を開きます…',
  },
  ko: {
    lang: 'ko',
    title: '이 기기 페어링',
    lead: '데스크톱에서 설정 → 시스템 → 원격 접속을 열고 표시된 6자리 코드를 입력하세요.',
    code: '페어링 코드',
    name: '기기 이름',
    namePlaceholder: '내 휴대폰',
    submit: '페어링',
    pending: '데스크톱의 승인을 기다리는 중…',
    approved: '승인되었습니다. spec.jev를 엽니다…',
    rejected: '데스크톱이 이 요청을 거부했습니다.',
    expired: '코드가 만료되었습니다. 데스크톱에서 새 코드를 발급하세요.',
    invalid: '코드가 올바르지 않습니다. 데스크톱을 확인하고 다시 시도하세요.',
    attempts: '코드가 틀렸습니다. {{n}}회 남았습니다.',
    inactive: '데스크톱에서 원격 접속이 실행 중이 아닙니다.',
    network: '데스크톱에 연결할 수 없습니다. 주소를 확인하고 다시 시도하세요.',
    already: '이 기기는 이미 페어링되었습니다. spec.jev를 엽니다…',
  },
};

function pickLocale(acceptLanguage: string | undefined): PairingStrings {
  const header = (acceptLanguage ?? '').toLowerCase();
  if (header.includes('zh-tw') || header.includes('zh-hant')) return STRINGS['zh-TW'];
  if (header.includes('zh')) return STRINGS['zh-CN'];
  if (header.includes('ja')) return STRINGS.ja;
  if (header.includes('ko')) return STRINGS.ko;
  return STRINGS.en;
}

const STYLE = `
:root { color-scheme: light dark; --bg:#f0f2ef; --surface:#f7f8f5; --line:#d8ded8; --text:#232b26; --muted:#5d6962; --brand:#b5cea5; --on-brand:#232b26; --danger:#a12a2a; --focus:#4e653f; }
@media (prefers-color-scheme: dark) { :root { --bg:#1c1d1c; --surface:#222423; --line:#2f322f; --text:#dedfdd; --muted:#a0a39f; --brand:#b5cea5; --on-brand:#1c211b; --danger:#e7a3a3; --focus:#b5cea5; } }
* { box-sizing: border-box; }
html, body { min-height: 100%; margin: 0; }
body { display:grid; place-items:center; padding:24px; background:var(--bg); color:var(--text); font:14px/1.55 "Segoe UI Variable","Segoe UI",-apple-system,BlinkMacSystemFont,"Noto Sans SC","Noto Sans",sans-serif; }
main { width:min(100%,420px); padding:28px; border:1px solid var(--line); border-radius:12px; background:var(--surface); }
.brand { color:var(--muted); font-size:12px; letter-spacing:.04em; }
h1 { margin:10px 0 8px; font-size:22px; line-height:1.25; font-weight:600; }
p { margin:0 0 20px; color:var(--muted); }
label { display:block; margin:14px 0 6px; font-size:12px; color:var(--muted); }
input { width:100%; height:44px; padding:0 12px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--text); font:inherit; outline:none; }
input:focus-visible { border-color:var(--focus); box-shadow:0 0 0 2px color-mix(in srgb, var(--focus) 22%, transparent); }
#code { font:600 22px/1 "Cascadia Code","SFMono-Regular",Consolas,monospace; letter-spacing:.26em; }
button { width:100%; height:42px; margin-top:22px; border:0; border-radius:8px; background:var(--brand); color:var(--on-brand); font:600 14px/1 inherit; cursor:pointer; }
button:disabled { opacity:.55; cursor:default; }
#status { min-height:22px; margin-top:14px; color:var(--muted); font-size:12.5px; }
#status[data-tone="error"] { color:var(--danger); }
.hidden { display:none; }
`;

function pageHtml(strings: PairingStrings): string {
  const data = JSON.stringify(strings).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${strings.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${strings.title} · spec.jev</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <div class="brand">spec.jev</div>
  <h1>${strings.title}</h1>
  <p>${strings.lead}</p>
  <form id="pair-form" novalidate>
    <label for="code">${strings.code}</label>
    <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>
    <label for="name">${strings.name}</label>
    <input id="name" name="name" maxlength="64" placeholder="${strings.namePlaceholder}" autocomplete="nickname">
    <button id="submit" type="submit">${strings.submit}</button>
  </form>
  <div id="status" role="status" aria-live="polite"></div>
</main>
<script>
(() => {
  const L = ${data};
  const form = document.getElementById('pair-form');
  const code = document.getElementById('code');
  const name = document.getElementById('name');
  const submit = document.getElementById('submit');
  const status = document.getElementById('status');
  let pollTimer = 0;
  let requestId = '';

  const say = (text, tone) => {
    status.textContent = text;
    status.dataset.tone = tone || '';
  };
  const stopPolling = () => {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = 0;
  };
  const setBusy = (busy) => {
    submit.disabled = busy;
    code.disabled = busy;
    name.disabled = busy;
  };
  const reset = () => {
    stopPolling();
    requestId = '';
    setBusy(false);
    form.classList.remove('hidden');
  };

  const poll = async () => {
    if (!requestId) return;
    try {
      const response = await fetch('/api/pair/status?id=' + encodeURIComponent(requestId), { cache: 'no-store' });
      const data = await response.json();
      if (data.status === 'approved') {
        stopPolling();
        say(L.approved);
        window.location.replace('/');
        return;
      }
      if (data.status === 'rejected') {
        reset();
        say(L.rejected, 'error');
        return;
      }
      if (data.status === 'expired') {
        reset();
        say(L.expired, 'error');
        return;
      }
      say(L.pending);
      pollTimer = window.setTimeout(poll, 1200);
    } catch {
      reset();
      say(L.network, 'error');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = code.value.replace(/\\D/g, '');
    if (value.length !== 6) {
      say(L.invalid, 'error');
      code.focus();
      return;
    }
    stopPolling();
    setBusy(true);
    say(L.pending);
    try {
      const response = await fetch('/api/pair/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: value, name: name.value.trim() || L.namePlaceholder }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBusy(false);
        if (data.error === 'invalid_code') {
          say(data.attemptsLeft > 0 ? L.attempts.replace('{{n}}', String(data.attemptsLeft)) : L.expired, 'error');
        } else if (data.error === 'inactive') {
          say(L.inactive, 'error');
        } else {
          say(L.invalid, 'error');
        }
        return;
      }
      requestId = data.requestId;
      form.classList.add('hidden');
      say(L.pending);
      poll();
    } catch {
      setBusy(false);
      say(L.network, 'error');
    }
  });

  code.addEventListener('input', () => {
    code.value = code.value.replace(/\\D/g, '').slice(0, 6);
  });

  fetch('/api/pair/status', { cache: 'no-store' })
    .then((response) => response.json())
    .then((data) => {
      if (data.paired) {
        say(L.already);
        window.location.replace('/');
      }
    })
    .catch(() => {});
})();
</script>
</body>
</html>`;
}

export function renderPairingPage(request: IncomingMessage): string {
  return pageHtml(pickLocale(request.headers['accept-language']));
}
