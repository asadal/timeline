const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer'); // multer 추가
const fs = require('fs');

const app = express();
const PORT = 3000;

// 데이터베이스 연결
const db = new sqlite3.Database('./db/timeline.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the timeline database.');
    }
});

// 세션 설정
app.use(session({
    secret: 'your-secret-key', // 비밀 키 설정
    resave: false,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Vercel에서는 서버리스 환경으로 실행하므로 `module.exports`로 내보냄
module.exports = app;

// 로그인 페이지
app.get('/login', (req, res) => {
    res.render('login');
});

// 로그인 처리
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // 여기에 데이터베이스나 다른 방식으로 로그인 검증을 추가할 수 있습니다
    if (username === 'admin' && password === 'gksrufp') {
        req.session.loggedIn = true;  // 세션에 로그인 정보 저장
        return res.redirect('/admin');  // 어드민 페이지로 리다이렉트
    } else {
        return res.send('Invalid username or password');
    }
});

// 이미지 업로드 설정 (파일 저장 경로와 파일명 설정)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/'); // 'uploads' 폴더에 저장
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // 파일 이름을 현재 시간과 확장자 기반으로 설정
    }
});
const upload = multer({ storage: storage });

// 어드민 페이지 (로그인된 사용자만 접근 가능)
app.get('/admin', (req, res) => {
    if (!req.session.loggedIn) {
        return res.redirect('/login');  // 로그인하지 않았다면 로그인 페이지로 리다이렉트
    }

    const sqlTimeline = `SELECT * FROM timeline ORDER BY date ASC`;
    const sqlSettings = `SELECT site_title, site_description FROM settings WHERE id = 1`;

    db.serialize(() => {
        db.all(sqlTimeline, [], (err, rows) => {
            if (err) {
                console.error('Error fetching timeline:', err.message);
                res.status(500).send('Database error');
                return;
            }

            db.get(sqlSettings, [], (err, settings) => {
                if (err) {
                    console.error('Error fetching settings:', err.message);
                    res.status(500).send('Database error');
                    return;
                }

                res.render('admin', { timeline: rows, settings: settings });
            });
        });
    });
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');  // 로그아웃 후 로그인 페이지로 리다이렉트
    });
});

// 웹사이트 설정 업데이트 라우트
app.post('/admin/update-settings', (req, res) => {
    const { site_title, site_description } = req.body;

    const sql = `UPDATE settings SET site_title = ?, site_description = ? WHERE id = 1`;
    const params = [site_title, site_description];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('Error updating settings:', err.message);
            res.status(500).send('Database error');
            return;
        }
        res.redirect('/admin');  // 업데이트 후 어드민 페이지로 리다이렉트
    });
});

// 타임라인 항목 추가 처리 (POST)
app.post('/admin/add', upload.single('image'), (req, res) => {
    const { date, time, title, body, link, external_image, show_time } = req.body;

    // `date`와 `time`을 합쳐서 하나의 `datetime` 값으로 생성
    const datetime = `${date} ${time}`; // 2024-12-17 15:00 형식으로 결합

    // 이미지 파일이 업로드된 경우 처리
    const image = req.file ? '/uploads/' + req.file.filename : external_image || '';

    // `datetime` 값이 없으면 오류 처리
    if (!datetime) {
        console.error('Error: datetime is required');
        return res.status(400).send('날짜와 시간을 입력해주세요.');
    }

    // DB에 삽입할 데이터 처리
    const sql = `INSERT INTO timeline (date, time, title, body, link, image, show_time) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [datetime.split(' ')[0], datetime.split(' ')[1], title, body, link || '', image, show_time ? 1 : 0];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('Error inserting timeline data:', err.message);
            return res.status(500).send('Database error');
        }
        res.redirect('/admin');
    });
});

// 타임라인 항목 수정 처리 (POST)
app.post('/admin/edit/:id', upload.single('image'), (req, res) => {
    const id = req.params.id;
    const { datetime, title, body, link, external_image, show_time } = req.body;

    // 파일 업로드가 있으면 업로드된 이미지 경로를 사용
    const image = req.file ? '/uploads/' + req.file.filename : external_image || '';

    // `datetime` 값이 없으면 오류 처리
    if (!datetime) {
        console.error('Error: datetime is required');
        return res.status(400).send('날짜와 시간을 입력해주세요.');
    }

    // `datetime`을 `date`와 `time`으로 분리
    const date = datetime.split(' ')[0]; // '2024-12-17'
    const time = datetime.split(' ')[1]; // '15:00'

    const sql = `UPDATE timeline SET date = ?, time = ?, title = ?, body = ?, link = ?, image = ?, show_time = ? WHERE id = ?`;
    const params = [date, time, title, body, link || '', image, show_time ? 1 : 0, id];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('Error updating timeline data:', err.message);
            return res.status(500).send('Database error');
        }
        res.redirect('/admin'); // 수정 후 어드민 페이지로 리다이렉트
    });
});

// 타임라인 항목 수정 페이지 (GET)
app.get('/admin/edit/:id', (req, res) => {
    const id = req.params.id;

    // 해당 ID에 맞는 타임라인 항목 가져오기
    const sql = `SELECT * FROM timeline WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error('Error fetching timeline item:', err.message);
            return res.status(500).send('Database error');
        }

        if (!row) {
            return res.status(404).send('타임라인 항목을 찾을 수 없습니다.');
        }

        // 수정 페이지로 전달할 데이터를 렌더링
        res.render('edit', { timeline: row });
    });
});

// 타임라인 항목 삭제 처리 (POST)
app.post('/admin/delete/:id', (req, res) => {
    const id = req.params.id;

    const sql = `DELETE FROM timeline WHERE id = ?`;
    db.run(sql, [id], (err) => {
        if (err) {
            console.error('Error deleting timeline item:', err.message);
            return res.status(500).send('Database error');
        }
        res.redirect('/admin'); // 삭제 후 어드민 페이지로 리다이렉트
    });
});

// 메인 페이지
app.get('/', (req, res) => {
    const sqlTimeline = `SELECT * FROM timeline ORDER BY date ASC`;
    const sqlSettings = `SELECT site_title, site_description FROM settings WHERE id = 1`;

    db.serialize(() => {
        db.all(sqlTimeline, [], (err, rows) => {
            if (err) {
                console.error('Error fetching timeline:', err.message);
                res.status(500).send('Database error');
                return;
            }

            db.get(sqlSettings, [], (err, settings) => {
                if (err) {
                    console.error('Error fetching settings:', err.message);
                    res.status(500).send('Database error');
                    return;
                }

                res.render('index', { timeline: rows, settings: settings });
            });
        });
    });
});

// CSV 파일 업로드 통한 타임라인 일괄 등록
const csv = require('csv-parser');

app.post('/admin/upload-csv', upload.single('csvfile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('CSV 파일이 업로드되지 않았습니다.');
    }

    const filePath = req.file.path;
    const timelineData = [];

    fs.createReadStream(filePath)
        .pipe(csv({ separator: ',' }))
        .on('data', (row) => {
            const datetime = `${row.date} ${row.time}`;

            timelineData.push({
                date: datetime,
                title: row.title,
                body: row.body,
                link: row.link || '',
                show_time: row.show_time === '1' ? 1 : 0
            });
        })
        .on('end', () => {
            db.serialize(() => {
                const insertStmt = db.prepare(`INSERT INTO timeline (date, title, body, link, show_time) VALUES (?, ?, ?, ?, ?)`);
                timelineData.forEach(item => {
                    insertStmt.run([item.date, item.title, item.body, item.link, item.show_time], (err) => {
                        if (err) {
                            console.error('Error inserting timeline data:', err.message);
                        }
                    });
                });
                insertStmt.finalize(() => {
                    fs.unlinkSync(filePath);  // 업로드된 파일 삭제
                    res.redirect('/admin');
                });
            });
        })
        .on('error', (err) => {
            console.error('CSV 파싱 오류:', err.message);
            fs.unlinkSync(filePath);  // 오류 발생 시 파일 삭제
            res.status(500).send('CSV 파싱 오류가 발생했습니다.');
        });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

