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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// コード保存（カスタムID + 重複チェック！）
// ============================================
app.post('/save', async (req, res) => {
    const { code, title, customId } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'コードが空です' });
    }

    let id;

    // ============================================
    // 🔥 カスタムIDがある場合
    // ============================================
    if (customId && customId.trim()) {
        // 整形（スペース→ハイフン、危険な文字を除去）
        id = customId.trim()
            .replace(/[\s\/\\]/g, '-')      // スペース・スラッシュをハイフンに
            .replace(/[^a-zA-Z0-9\-_]/g, ''); // 英数字・ハイフン・アンダースコア以外を削除

        // 空になったらエラー
        if (!id) {
            return res.status(400).json({ 
                error: 'IDに使える文字がありません。英数字を使ってください。' 
            });
        }

        // ============================================
        // 🔥 重複チェック（確実に！）
        // ============================================
        const { data: existing, error: checkError } = await supabase
            .from('codes')
            .select('id')
            .eq('id', id);

        // エラーが出た場合
        if (checkError) {
            console.error('重複チェックエラー:', checkError);
            return res.status(500).json({ error: 'データベースエラー' });
        }

        // 既に存在する場合
        if (existing && existing.length > 0) {
            return res.status(400).json({ 
                error: `「${id}」は既に使われています。別の名前を試してください。` 
            });
        }

    } else {
        // ============================================
        // カスタムIDなし → 自動生成
        // ============================================
        id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    }

    // ============================================
    // Base64エンコードして保存
    // ============================================
    const encodedCode = Buffer.from(code, 'utf8').toString('base64');
    const encodedTitle = Buffer.from(title || 'Untitled', 'utf8').toString('base64');

    const { error } = await supabase
        .from('codes')
        .insert([{ 
            id: id, 
            title: encodedTitle, 
            code: encodedCode
        }]);

    if (error) {
        console.error('保存エラー:', error);
        
        // 万が一、重複エラーが出た場合
        if (error.message.includes('duplicate') || error.code === '23505') {
            return res.status(400).json({ 
                error: `「${id}」は既に使われています。別の名前を試してください。` 
            });
        }
        
        return res.status(500).json({ error: error.message });
    }

    const rawUrl = `https://${req.get('host')}/raw/${id}`;
    res.json({ success: true, raw: rawUrl, id: id });
});

// ============================================
// Raw取得
// ============================================
app.get('/raw/:id', async (req, res) => {
    const id = req.params.id;

    const { data, error } = await supabase
        .from('codes')
        .select('code')
        .eq('id', id)
        .single();

    if (error || !data) {
        return res.status(404).send('-- コードが見つかりません --');
    }

    const decodedCode = Buffer.from(data.code, 'base64').toString('utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(decodedCode);
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

    const decodedList = (data || []).map(item => ({
        id: item.id,
        title: Buffer.from(item.title, 'base64').toString('utf8')
    }));

    res.json(decodedList);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Kento Raw 起動: http://localhost:${PORT}`);
});
