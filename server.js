// server.js
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./db/timeline.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the timeline database.');
    }
});

// 미들웨어
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// 타임라인 테이블 생성
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        image TEXT,
        link TEXT,
        show_time INTEGER DEFAULT 0
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        site_title TEXT DEFAULT '타임라인 웹사이트',
        site_description TEXT DEFAULT '웹사이트 설명을 입력하세요.'
    )`);

    // 기본 설정 삽입
    db.run(`INSERT OR IGNORE INTO settings (id, site_title, site_description) VALUES (1, '타임라인 웹사이트', '웹사이트 설명을 입력하세요.')`);
});

// 파일 업로드 설정 (이미지 및 CSV)
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 어드민 페이지 렌더링
app.get('/admin', (req, res) => {
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

// 설정 업데이트 라우트 (필요 시)
app.post('/admin/update-settings', (req, res) => {
     const { site_title, site_description } = req.body;
     const sql = `UPDATE settings SET site_title = ?, site_description = ? WHERE id = 1`;
     db.run(sql, [site_title, site_description], function(err) {
         if (err) {
             console.error('Error updating settings:', err.message);
             res.status(500).send('Database error');
             return;
         }
         res.redirect('/admin');
     });
 });

// 타임라인 추가
app.post('/admin/add', upload.single('image'), async (req, res) => {
    const { datetime, title, body, link, show_time } = req.body;
    let image = '';

    try {
        if (req.file) {
            // 이미지 업로드 처리
            image = `/uploads/${req.file.filename}`;
        }

        const formattedDatetime = datetime.replace('T', ' ');

        const sql = `INSERT INTO timeline (date, title, body, image, link, show_time) VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [formattedDatetime, title, body, image, link, show_time ? 1 : 0];

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error adding timeline:', err.message);
                res.status(500).send('Database error');
                return;
            }
            res.redirect('/admin');
        });
    } catch (error) {
        console.error('Unexpected error:', error.message);
        res.status(500).send(`Unexpected error: ${error.message}`);
    }
});

// 타임라인 수정 폼
app.get('/admin/edit/:id', (req, res) => {
    const id = req.params.id;
    const sql = `SELECT * FROM timeline WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error('Error fetching timeline entry:', err.message);
            res.status(500).send('Database error');
            return;
        }
        if (!row) {
            res.status(404).send('Timeline entry not found');
            return;
        }
        res.render('edit', { timeline: row });
    });
});

// 타임라인 수정
app.post('/admin/edit/:id', upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { datetime, title, body, link, show_time } = req.body;
    let image = req.body.currentImage;

    try {
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        const formattedDatetime = datetime.replace('T', ' ');

        const sql = `UPDATE timeline SET date = ?, title = ?, body = ?, image = ?, link = ?, show_time = ? WHERE id = ?`;
        const params = [formattedDatetime, title, body, image, link, show_time ? 1 : 0, id];

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error updating timeline:', err.message);
                res.status(500).send('Database error');
                return;
            }
            res.redirect('/admin');
        });
    } catch (error) {
        console.error('Unexpected error:', error.message);
        res.status(500).send(`Unexpected error: ${error.message}`);
    }
});

// 타임라인 삭제
app.post('/admin/delete/:id', (req, res) => {
    const id = req.params.id;
    const sql = `DELETE FROM timeline WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            console.error('Error deleting timeline:', err.message);
            res.status(500).send('Database error');
            return;
        }
        res.redirect('/admin');
    });
});

// CSV 업로드 통한 타임라인 일괄 등록
app.post('/admin/upload-csv', upload.single('csvfile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('CSV 파일이 업로드되지 않았습니다.');
    }

    const filePath = req.file.path;
    const timelineData = [];

    fs.createReadStream(filePath)
        .pipe(csv({
            separator: ',' // CSV 구분자가 콤마일 경우
        }))
        .on('data', (row) => {
            // CSV 컬럼 예시: id, date, time, title, body, image, link, show_time
            const datetime = (row.date && row.time) ? `${row.date} ${row.time}` : row.date;

            timelineData.push({
                date: datetime,
                title: row.title,
                body: row.body,
                image: row.image || '',
                link: row.link || '',
                show_time: row.show_time === '1' ? 1 : 0
            });
        })
        .on('end', () => {
            db.serialize(() => {
                const insertStmt = db.prepare(`INSERT INTO timeline (date, title, body, image, link, show_time) VALUES (?, ?, ?, ?, ?, ?)`);
                timelineData.forEach(item => {
                    insertStmt.run([item.date, item.title, item.body, item.image, item.link, item.show_time], (err) => {
                        if (err) {
                            console.error('Error inserting timeline data:', err.message);
                        }
                    });
                });
                insertStmt.finalize(() => {
                    fs.unlinkSync(filePath);
                    res.redirect('/admin');
                });
            });
        })
        .on('error', (err) => {
            console.error('CSV 파싱 오류:', err.message);
            fs.unlinkSync(filePath);
            res.status(500).send('CSV 파싱 오류가 발생했습니다.');
        });
});

// 메인 페이지 렌더링
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

