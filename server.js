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
    // カスタムIDがある場合、半角英数字とハイフン・アンダースコア以外を強制排除
    if (customId && customId.trim()) {
        id = customId.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!id) {
            return res.status(400).json({ error: 'IDには半角英数字を使用してください' });
        }
    } else {
        // 自動生成
        id = (Date.now() * 1000 + Math.floor(Math.random() * 1000)).toString();
    }

    // コードをBase64エンコード（日本語対応）
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
// 🔥 Raw取得（ブラウザブロック機能付き）
// ============================================
app.get('/raw/:id', async (req, res) => {
    const id = req.params.id;
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    // 🛡️ ブラウザからのアクセスをブロック
    // RobloxのエグゼキューターはUser-Agentに 'roblox' や 'wininet' などを含むことが多いです。
    // 逆に、Safari/Chromeなどのブラウザ特有の文字列が含まれている場合のみブロックします。
    const isStrictBrowser = 
        userAgent.includes('mozilla/5.0') && 
        (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edg')) &&
        !userAgent.includes('roblox') && 
        !userAgent.includes('wininet');

    if (isStrictBrowser) {
        return res.status(403).send(`
            <body style="background:#111; color:#ff4444; font-family:sans-serif; text-align:center; padding-top:100px;">
                <h1>Contents can not be displayed on browser.</h1>
                <p style="color:#888;">This script can only be loaded via Roblox.</p>
            </body>
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
    
    // ブラウザ以外（Robloxなど）にはプレーンテキストでコードを返す
    res.setHeader('Content-Type', 'text/plain');
    res.send(decodedCode);
});

// ============================================
// 保存一覧
// ============================================
app.get('/list', async (req, res) => {
    const { data, error } = await supabase
        .from('codes')
        .select('id, title')
        .order('id', { ascending: false });
        
    if (error) return res.status(500).json({ error: error.message });

    const decodedList = (data || []).map(item => ({
        id: item.id,
        title: Buffer.from(item.title, 'base64').toString('utf8')
    }));
    res.json(decodedList);
});

// Vercel用エクスポート
module.exports = app;
