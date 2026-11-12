const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ============================================
// 🔑 Supabase設定
// ============================================
const supabaseUrl = 'https://xcpxosnszghaklpqkvbe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHhvc25zemdoYWtscHFrdmJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTExMTQ4MCwiZXhwIjoyMTA2Njg3NDgwfQ.GHvpIZjuRYL9uw4cuPwbqUz5HgnW9A4IwCZCB45jhiY'; // ←ここを書き換えてね！
const supabase = createClient(supabaseUrl, supabaseKey);

// トップページ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// コード保存
// ============================================
app.post('/save', async (req, res) => {
    const { code, title, customId } = req.body;
    if (!code) return res.status(400).json({ error: 'コードが空です' });

    let id;
    if (customId && customId.trim()) {
        id = customId.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!id) return res.status(400).json({ error: 'IDには半角英数字を使用してください' });
    } else {
        id = (Date.now() * 1000 + Math.floor(Math.random() * 1000)).toString();
    }

    const encodedCode = Buffer.from(code, 'utf8').toString('base64');
    const encodedTitle = Buffer.from(title || 'Untitled', 'utf8').toString('base64');

    const { error } = await supabase
        .from('codes')
        .insert([{ id, title: encodedTitle, code: encodedCode }]);

    if (error) {
        if (error.message.includes('duplicate')) {
            return res.status(400).json({ error: 'このIDは既に使われています' });
        }
        return res.status(500).json({ error: error.message });
    }

    const rawUrl = `https://${req.get('host')}/raw/${id}`;
    res.json({ success: true, raw: rawUrl, id: id });
});

// ============================================
// 🔥 Raw取得（ブラウザブロック + コピー機能付き）
// ============================================
app.get('/raw/:id', async (req, res) => {
    const id = req.params.id;
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    const isStrictBrowser = 
        userAgent.includes('mozilla/5.0') && 
        (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edg')) &&
        !userAgent.includes('roblox') && 
        !userAgent.includes('wininet');

    // ブラウザからのアクセスの場合
    if (isStrictBrowser) {
        const fullLink = `https://${req.get('host')}/raw/${id}`;
        const loadstringCode = `loadstring(game:HttpGet("${fullLink}"))()`;

        return res.status(403).send(`
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Protected Script</title>
                <style>
                    body {
                        background: #0a0a0a;
                        color: #fff;
                        font-family: 'Segoe UI', Tahoma, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    .container {
                        background: #1a1a1a;
                        padding: 40px 30px;
                        border-radius: 15px;
                        border: 2px solid #ff4444;
                        text-align: center;
                        max-width: 600px;
                        width: 100%;
                        box-shadow: 0 0 40px rgba(255, 68, 68, 0.1);
                    }
                    h1 { color: #ff4444; font-size: 1.5rem; margin-bottom: 15px; }
                    p { color: #888; font-size: 0.95rem; margin-bottom: 25px; line-height: 1.6; }
                    .code-box {
                        background: #000;
                        color: #00cc00;
                        padding: 15px;
                        border-radius: 8px;
                        font-family: monospace;
                        font-size: 13px;
                        word-break: break-all;
                        margin-bottom: 20px;
                        text-align: left;
                        border: 1px solid #333;
                    }
                    button {
                        background: #ff8c00;
                        color: #000;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        width: 100%;
                        transition: 0.3s;
                    }
                    button:hover { background: #ffa500; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🛑 Access Denied</h1>
                    <p>Contents can not be displayed on browser.<br>このスクリプトはブラウザでは表示できません。<br>以下のコードをRobloxのエグゼキューターで実行してください。</p>
                    
                    <div class="code-box" id="copyText">${loadstringCode}</div>
                    
                    <button onclick="copyCode()">📋 ロードストリングをコピー</button>
                </div>

                <script>
                    function copyCode() {
                        const text = document.getElementById('copyText').innerText;
                        navigator.clipboard.writeText(text).then(() => {
                            const btn = document.querySelector('button');
                            btn.innerText = '✅ コピーしました！';
                            btn.style.background = '#00cc00';
                            setTimeout(() => {
                                btn.innerText = '📋 ロードストリングをコピー';
                                btn.style.background = '#ff8c00';
                            }, 2000);
                        }).catch(err => {
                            alert('コピーに失敗しました。手動で選択してコピーしてください。');
                        });
                    }
                </script>
            </body>
            </html>
        `);
    }

    // データベースから取得
    const { data, error } = await supabase
        .from('codes')
        .select('code')
        .eq('id', id)
        .single();

    if (error || !data) {
        return res.status(404).send('-- コードが見つかりません --');
    }

    const decodedCode = Buffer.from(data.code, 'base64').toString('utf8');
    
    // Robloxなどにはプレーンテキストでコードを返す
    res.setHeader('Content-Type', 'text/plain');
    res.send(decodedCode);
});

// 保存一覧
app.get('/list', async (req, res) => {
    const { data, error } = await supabase.from('codes').select('id, title').order('id', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const decodedList = (data || []).map(item => ({
        id: item.id,
        title: Buffer.from(item.title, 'base64').toString('utf8')
    }));
    res.json(decodedList);
});

module.exports = app;
