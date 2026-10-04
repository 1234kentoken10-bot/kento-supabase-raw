const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ============================================
// 🔑 Supabase設定（あなたの情報に書き換え！）
// ============================================
const supabaseUrl = 'https://xcpxosnszghaklpqkvbe.supabase.co';
const supabaseKey = 'あなたのservice_roleキー';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// トップページ
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// コード保存
// ============================================
app.post('/save', async (req, res) => {
    const { code, title } = req.body;
    if (!code) return res.status(400).json({ error: 'コードが空です' });

    const id = 'kento_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const { error } = await supabase
        .from('codes')
        .insert([{ 
            id: id, 
            title: title || 'Untitled', 
            code: code
        }]);

    if (error) {
        console.error('保存エラー:', error);
        return res.status(500).json({ error: error.message });
    }

    const rawUrl = `https://${req.get('host')}/raw/${id}`;
    res.json({ success: true, raw: rawUrl, id: id });
});

// ============================================
// Raw取得
// ============================================
app.get('/raw/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('codes')
        .select('code')
        .eq('id', req.params.id)
        .single();

    if (error || !data) {
        return res.status(404).send('-- コードが見つかりません --');
    }

    res.setHeader('Content-Type', 'text/plain');
    res.send(data.code);
});

// ============================================
// 一覧
// ============================================
app.get('/list', async (req, res) => {
    const { data, error } = await supabase
        .from('codes')
        .select('id, title')
        .order('id', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ============================================
// サーバー起動
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Kento Raw 起動: http://localhost:${PORT}`);
    console.log(`📊 データベース: Supabase`);
});
