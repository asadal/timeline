require('dotenv').config();
const express = require('express');
const session = require('express-session');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const app = express();

// PostgreSQL 연결 풀 설정
const pool = new Pool({
    user: process.env.PGUSER || 'timeline_user',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'timeline_db',
    password: process.env.PGPASSWORD || 'your_secure_password',
    port: process.env.PGPORT || 5432,
});

// 세션 설정
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// 미들웨어
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// 로그인 페이지
app.get('/login', (req, res) => res.render('login'));

// 로그인 처리
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'gksrufp') {
        req.session.loggedIn = true;
        return res.redirect('/admin');
    }
    res.send('Invalid username or password');
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// 웹사이트 설정 업데이트 라우트
// 웹사이트 설정 업데이트 라우트
app.post('/admin/update-settings', async (req, res) => {
    const { site_title, site_description } = req.body; // 폼에서 넘어온 데이터

    // 오류가 발생하지 않도록 유효성 검사
    if (!site_title || !site_description) {
        return res.status(400).send('웹사이트 제목과 설명을 입력해주세요.');
    }

    // 줄바꿈을 <br> 태그로 변환
    const formattedDescription = site_description.replace(/\n/g, '<br>');

    try {
        const updateQuery = `
            UPDATE settings 
            SET site_title = $1, site_description = $2 
            WHERE id = 1
        `;
        const values = [site_title, formattedDescription];

        // PostgreSQL에 쿼리 실행
        await pool.query(updateQuery, values);

        // 업데이트 후 어드민 페이지로 리다이렉트
        res.redirect('/admin');
    } catch (err) {
        console.error('Error updating settings:', err.message);
        res.status(500).send('Database error');
    }
});

// 어드민 페이지
app.get('/admin', async (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login');
    try {
        const timelineResult = await pool.query('SELECT * FROM timeline ORDER BY date ASC');
        const settingsResult = await pool.query('SELECT site_title, site_description FROM settings WHERE id = 1');
        const formattedTimeline = timelineResult.rows.map(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const formattedTime = `${date.getHours() >= 12 ? '오후' : '오전'} ${date.getHours() % 12 || 12}시 ${date.getMinutes().toString().padStart(2, '0')}분`;
            return { ...item, formattedDate, formattedTime };
        });
        res.render('admin', { timeline: formattedTimeline, settings: settingsResult.rows[0] });
    } catch (err) {
        console.error('Error fetching data:', err.message);
        res.status(500).send('Database error');
    }
});

// 타임라인 항목 추가
app.post('/admin/add', upload.single('image'), async (req, res) => {
    const { datetime, title, body, link, external_image, show_time } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : external_image || '';
    try {
        await pool.query(
            `INSERT INTO timeline (date, title, body, image, link, show_time) VALUES ($1, $2, $3, $4, $5, $6)`,
            [datetime.replace('T', ' '), title, body, image, link || '', show_time ? 1 : 0]
        );
        res.redirect('/admin');
    } catch (err) {
        console.error('Error inserting timeline data:', err.message);
        res.status(500).send('Database error');
    }
});

// 타임라인 항목 수정
app.post('/admin/edit/:id', upload.single('image'), async (req, res) => {
    const { datetime, title, body, link, external_image, show_time } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : external_image || '';
    try {
        await pool.query(
            `UPDATE timeline SET date = $1, title = $2, body = $3, link = $4, image = $5, show_time = $6 WHERE id = $7`,
            [datetime.replace('T', ' '), title, body, link || '', image, show_time ? 1 : 0, req.params.id]
        );
        res.redirect('/admin');
    } catch (err) {
        console.error('Error updating timeline data:', err.message);
        res.status(500).send('Database error');
    }
});

// 타임라인 삭제
app.post('/admin/delete/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM timeline WHERE id = $1`, [req.params.id]);
        res.redirect('/admin');
    } catch (err) {
        console.error('Error deleting timeline item:', err.message);
        res.status(500).send('Database error');
    }
});

// 메인 페이지
app.get('/', async (req, res) => {
    try {
        const timelineResult = await pool.query('SELECT * FROM timeline ORDER BY date ASC');
        const settingsResult = await pool.query('SELECT site_title, site_description FROM settings WHERE id = 1');
        const formattedTimeline = timelineResult.rows.map(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const formattedTime = `${date.getHours() >= 12 ? '오후' : '오전'} ${date.getHours() % 12 || 12}시 ${date.getMinutes().toString().padStart(2, '0')}분`;
            return { ...item, formattedDate, formattedTime };
        });
        res.render('index', { timeline: formattedTimeline, settings: settingsResult.rows[0] });
    } catch (err) {
        console.error('Error fetching data:', err.message);
        res.status(500).send('Database error');
    }
});

// 서버리스 환경에서 실행되도록 serverless-http 사용
module.exports.handler = serverless(app);

// 타임라인 수정 페이지 (GET)
app.get('/admin/edit/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await pool.query('SELECT * FROM timeline WHERE id = $1', [id]);
        if (!result.rows.length) {
            return res.status(404).send('타임라인 항목을 찾을 수 없습니다.');
        }
        res.render('edit', { timeline: result.rows[0] });
    } catch (err) {
        console.error('Error fetching timeline entry:', err.message);
        res.status(500).send('Database error');
    }
});

const fs = require('fs');
const csv = require('csv-parser');

// CSV 파일 업로드 라우트
app.post('/admin/upload-csv', upload.single('csvfile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('CSV 파일이 업로드되지 않았습니다.');
    }

    const filePath = req.file.path; // 업로드된 CSV 파일 경로
    const timelineData = [];

    // CSV 파일 읽기 및 파싱
    fs.createReadStream(filePath)
        .pipe(csv({ separator: ',' })) // 기본 구분자: 쉼표
        .on('data', (row) => {
            // 날짜가 제대로 들어오지 않으면 건너뛰기
            if (!row.date || !row.title || !row.body) {
                console.error('Missing required fields in CSV row:', row);
                return;
            }

            timelineData.push({
                date: row.date.trim(), // 날짜 값 처리 (앞뒤 공백 제거)
                title: row.title.trim(),
                body: row.body.trim(),
                image: row.image || '', // 이미지 경로 또는 외부 URL
                link: row.link || '',   // 링크 (없으면 빈 값)
                show_time: row.show_time === '1' ? 1 : 0 // 시간 표시 여부
            });
        })
        .on('end', async () => {
            try {
                // 데이터베이스에 데이터 삽입
                const insertQuery = `
                    INSERT INTO timeline (date, title, body, image, link, show_time)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `;
                for (const item of timelineData) {
                    if (item.date && item.title && item.body) {  // 날짜가 제대로 있으면 삽입
                        await pool.query(insertQuery, [
                            item.date,
                            item.title,
                            item.body,
                            item.image,
                            item.link,
                            item.show_time
                        ]);
                    }
                }

                // 업로드된 파일 삭제 (선택 사항)
                fs.unlinkSync(filePath);
                res.redirect('/admin');
            } catch (err) {
                console.error('Error inserting timeline data:', err.message);
                fs.unlinkSync(filePath); // 오류 발생 시 파일 삭제
                res.status(500).send('Database error during CSV upload');
            }
        })
        .on('error', (err) => {
            console.error('CSV 파싱 오류:', err.message);
            fs.unlinkSync(filePath); // 오류 발생 시 파일 삭제
            res.status(500).send('CSV 파싱 오류가 발생했습니다.');
        });
});

app.listen(3000, () => console.log(`Server is running on http://localhost:3000`));

