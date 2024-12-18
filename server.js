// server.js

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 데이터베이스 파일 경로
const DB_PATH = path.join(__dirname, 'db', 'timeline.db');

// 데이터베이스 디렉터리 및 파일이 존재하지 않으면 생성
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created directory: ${dbDir}`);
}

if (!fs.existsSync(DB_PATH)) {
    fs.closeSync(fs.openSync(DB_PATH, 'w'));
    console.log(`Created database file: ${DB_PATH}`);
}

// 데이터베이스 연결
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the timeline database.');
    }
});

// 데이터베이스 테이블 생성 및 마이그레이션
db.serialize(() => {
    // 타임라인 테이블 생성 (show_time 필드 포함)
    db.run(`CREATE TABLE IF NOT EXISTS timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        image TEXT,
        link TEXT,
        show_time INTEGER DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error('Error creating timeline table:', err.message);
        } else {
            console.log('Timeline table is ready.');
        }
    });

    // 설정 테이블 생성 (웹사이트 제목과 설명 포함)
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        site_title TEXT DEFAULT '타임라인 웹사이트',
        site_description TEXT DEFAULT '웹사이트 설명을 입력하세요.'
    )`, (err) => {
        if (err) {
            console.error('Error creating settings table:', err.message);
        } else {
            console.log('Settings table is ready.');
        }
    });

    // 설정 테이블에 기본 행 추가 (존재하지 않을 경우)
    db.run(`INSERT OR IGNORE INTO settings (id, site_title, site_description) VALUES (1, '타임라인 웹사이트', '웹사이트 설명을 입력하세요.')`, (err) => {
        if (err) {
            console.error('Error inserting default settings:', err.message);
        } else {
            console.log('Default settings ensured.');
        }
    });

    // 마이그레이션: settings 테이블에 site_title과 site_description 컬럼이 없는 경우 추가
    db.all(`PRAGMA table_info(settings)`, [], (err, columns) => {
        if (err) {
            console.error('Error fetching table info:', err.message);
            return;
        }

        const columnNames = columns.map(col => col.name);
        const migrations = [];

        if (!columnNames.includes('site_title')) {
            migrations.push(`ALTER TABLE settings ADD COLUMN site_title TEXT DEFAULT '타임라인 웹사이트';`);
        }

        if (!columnNames.includes('site_description')) {
            migrations.push(`ALTER TABLE settings ADD COLUMN site_description TEXT DEFAULT '웹사이트 설명을 입력하세요.';`);
        }

        migrations.forEach(migration => {
            db.run(migration, [], (err) => {
                if (err) {
                    console.error('Error running migration:', err.message);
                } else {
                    console.log(`Migration executed: ${migration}`);
                }
            });
        });
    });
});

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// 파일 업로드 설정 (이미지 저장)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const imagesDir = path.join(__dirname, 'public', 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
            console.log(`Created directory for images: ${imagesDir}`);
        }
        cb(null, imagesDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 날짜 및 시간 형식 검증 함수
const validateDatetime = (datetime) => {
    // 'YYYY-MM-DD HH:MM' 또는 'YYYY-MM-DDTHH:MM' 형식을 검증하는 정규식
    const regex = /^\d{4}-\d{2}-\d{2}(?: |\T)\d{2}:\d{2}$/;
    return regex.test(datetime);
};

// 어드민 페이지 렌더링
app.get('/admin', (req, res) => {
    const sqlTimeline = `SELECT * FROM timeline ORDER BY date DESC`;
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

// 설정 업데이트 라우트
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

// 타임라인 데이터 추가 라우트 수정
app.post('/admin/add', upload.single('image'), async (req, res) => {
    const { datetime, title, body, link, show_time, external_image } = req.body;
    let image = '';

    if (external_image && external_image.trim() !== '') {
        // 외부 이미지 URL이 제공된 경우
        image = external_image.trim();
    } else if (req.file) {
        // 외부 이미지 URL이 없고 파일이 업로드된 경우
        const optimizedImagePath = path.join(__dirname, 'public', 'images', `optimized_${req.file.filename}`);
        try {
            await sharp(req.file.path)
                .resize(800) // 최대 너비 800px로 조절
                .jpeg({ quality: 80 })
                .toFile(optimizedImagePath);
            image = `/images/optimized_${req.file.filename}`;
        } catch (err) {
            console.error('Image processing error:', err.message);
            res.status(500).send('Image processing error');
            return;
        }
    } else {
        // 이미지가 제공되지 않은 경우
        image = '';
    }

    const formattedDatetime = datetime.replace('T', ' ');

    // 유효성 검사
    if (!validateDatetime(formattedDatetime)) {
        return res.status(400).send('잘못된 날짜 및 시간 형식입니다.');
    }

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
});

// 수정 폼 렌더링
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

// 타임라인 데이터 수정 라우트 수정
app.post('/admin/edit/:id', upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { datetime, title, body, link, show_time, external_image } = req.body;
    let image = req.body.currentImage; // 기존 이미지 경로

    if (external_image && external_image.trim() !== '') {
        // 외부 이미지 URL이 제공된 경우
        image = external_image.trim();
    } else if (req.file) {
        // 외부 이미지 URL이 없고 파일이 업로드된 경우
        const optimizedImagePath = path.join(__dirname, 'public', 'images', `optimized_${req.file.filename}`);
        try {
            await sharp(req.file.path)
                .resize(800)
                .jpeg({ quality: 80 })
                .toFile(optimizedImagePath);
            image = `/images/optimized_${req.file.filename}`;
        } catch (err) {
            console.error('Image processing error:', err.message);
            res.status(500).send('Image processing error');
            return;
        }
    } // else, 이미지 변경 없음 (기존 이미지 유지)

    const formattedDatetime = datetime.replace('T', ' ');

    // 유효성 검사
    if (!validateDatetime(formattedDatetime)) {
        return res.status(400).send('잘못된 날짜 및 시간 형식입니다.');
    }

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
});

// 타임라인 데이터 삭제
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

// 메인 페이지 렌더링
app.get('/', (req, res) => {
    const sqlTimeline = `SELECT * FROM timeline ORDER BY date DESC`;
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

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

