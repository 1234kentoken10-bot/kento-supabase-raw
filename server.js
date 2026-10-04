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
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHhvc25zemdoYWtscHFrdmJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTExMTQ4MCwiZXhwIjoyMTA2Njg3NDgwfQ.GHvpIZjuRYL9uw4cuPwbqUz5HgnW9A4IwCZCB45jhiY';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// トップページ
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// コード保存（Base64エンコードで安全に保存）
// ============================================
app.post('/save', async (req, res) => {
    const { code, title } = req.body;
    if (!code) return res.status(400).json({ error: 'コードが空です' });

    const id = 'kento_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    // 🔥 Base64エンコード（日本語対応！）
    const encodedCode = Buffer.from(code, 'utf8').toString('base64');
    const encodedTitle = Buffer.from(title || 'Untitled', 'utf8').toString('base64');

    const { error } = await supabase
        .from('codes')
        .insert([{ 
            id: id, 
            title: encodedTitle,   // ← Base64で保存
            code: encodedCode      // ← Base64で保存
        }]);

    if (error) {
        console.error('保存エラー:', error);
        return res.status(500).json({ error: error.message });
    }

    const rawUrl = `https://${req.get('host')}/raw/${id}`;
    res.json({ success: true, raw: rawUrl, id: id });
});

// ============================================
// Raw取得（Base64デコードして返す）
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

    // 🔥 Base64デコード（元の日本語に戻す！）
    const decodedCode = Buffer.from(data.code, 'base64').toString('utf8');

    res.setHeader('Content-Type', 'text/plain');
    res.send(decodedCode);
});

// ============================================
// 一覧（Base64デコードして返す）
// ============================================
app.get('/list', async (req, res) => {
    const { data, error } = await supabase
        .from('codes')
        .select('id, title')
        .order('id', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // 🔥 タイトルをデコード
    const decodedList = (data || []).map(item => ({
        id: item.id,
        title: Buffer.from(item.title, 'base64').toString('utf8')
    }));

    res.json(decodedList);
});

// ============================================
// サーバー起動
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Kento Raw 起動: http://localhost:${PORT}`);
    console.log(`📊 データベース: Supabase（Base64エンコード対応）`);
});
