const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ============================================
// 🔑 Supabase設定（さっきメモしたやつを貼る！）
// ============================================
const supabaseUrl = 'https://xcpxosnszghaklpqkvbe.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHhvc25zemdoYWtscHFrdmJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTExMTQ4MCwiZXhwIjoyMTA2Njg3NDgwfQ.GHvpIZjuRYL9uw4cuPwbqUz5HgnW9A4IwCZCB45jhiY';
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
            code: code,
            created: new Date().toISOString()
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
        .select('id, title, created')
        .order('created', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Kento Raw 起動: http://localhost:${PORT}`);
    console.log(`📊 データベース: Supabase`);
});
