// server.js

const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 설정 데이터 기본 값
const DEFAULT_SETTINGS = {
    site_title: '타임라인 웹사이트',
    site_description: '웹사이트 설명을 입력하세요.'
};

// EJS 템플릿 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 정적 파일 서비스 (CSS, 이미지 등)
app.use(express.static(path.join(__dirname, 'public')));

// Body Parser 미들웨어
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Multer 설정 (이미지 업로드)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public', 'images');
        // 디렉토리가 없으면 생성
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // 파일 이름을 고유하게 생성 (타임스탬프 사용)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// SQLite 데이터베이스 연결
const dbPath = path.join(__dirname, 'db', 'timeline.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// 데이터베이스 테이블 생성 및 마이그레이션
db.serialize(() => {
    // 타임라인 테이블 생성 (link 필드 포함)
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

    // 설정 테이블 생성
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
    db.run(`INSERT OR IGNORE INTO settings (id, site_title, site_description) VALUES (1, ?, ?)`, [DEFAULT_SETTINGS.site_title, DEFAULT_SETTINGS.site_description], (err) => {
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

// 유효한 날짜 및 시간 형식인지 검사하는 함수
function validateDatetime(datetime) {
    // YYYY-MM-DD HH:MM 형식 검사 (간단한 정규식)
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    return regex.test(datetime);
}

// **1. GET /admin**: 어드민 페이지 렌더링
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

// **2. POST /admin/update-settings**: 웹사이트 설정 업데이트
app.post('/admin/update-settings', (req, res) => {
    const { site_title, site_description } = req.body;

    const sql = `UPDATE settings SET site_title = ?, site_description = ? WHERE id = 1`;
    const params = [site_title, site_description];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error updating settings:', err.message);
            res.status(500).send('Database error');
            return;
        }
        res.redirect('/admin');
    });
});

// **3. POST /admin/add**: 새로운 타임라인 항목 추가
app.post('/admin/add', upload.single('image'), async (req, res) => {
    const { datetime, title, body, link, show_time, external_image } = req.body;
    let image = '';

    try {
        if (external_image && external_image.trim() !== '') {
            // 외부 이미지 URL이 제공된 경우
            image = external_image.trim();
        } else if (req.file) {
            // 외부 이미지 URL이 없고 파일이 업로드된 경우
            const optimizedImagePath = path.join(__dirname, 'public', 'images', `optimized_${req.file.filename}`);
            await sharp(req.file.path)
                .resize({ width: 500, withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(optimizedImagePath);
            image = `/images/optimized_${req.file.filename}`;
            // 업로드된 원본 이미지 삭제 (선택 사항)
            fs.unlinkSync(req.file.path);
        } else {
            // 이미지가 제공되지 않은 경우
            image = '';
        }

        const formattedDatetime = datetime.replace('T', ' ');

        // 유효성 검사
        if (!validateDatetime(formattedDatetime)) {
            throw new Error('잘못된 날짜 및 시간 형식입니다.');
        }

        const sql = `INSERT INTO timeline (date, title, body, image, link, show_time) VALUES (?, ?, ?, ?, ?, ?)`;
        const params = [formattedDatetime, title, body, image, link, show_time ? 1 : 0];

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error adding timeline:', err.message);
                res.status(500).send(`Database error: ${err.message}`);
                return;
            }
            res.redirect('/admin');
        });
    } catch (error) {
        console.error('Unexpected error:', error.message);
        res.status(500).send(`Unexpected error: ${error.message}`);
    }
});

// **4. GET /admin/edit/:id**: 특정 타임라인 항목 수정 폼 렌더링
app.get('/admin/edit/:id', (req, res) => {
    const id = req.params.id;
    const sql = `SELECT * FROM timeline WHERE id = ?`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error('Error fetching timeline item:', err.message);
            res.status(500).send('Database error');
            return;
        }

        if (!row) {
            res.status(404).send('Timeline item not found');
            return;
        }

        res.render('edit', { timeline: row });
    });
});

// **5. POST /admin/edit/:id**: 특정 타임라인 항목 업데이트
app.post('/admin/edit/:id', upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { datetime, title, body, link, show_time, external_image } = req.body;
    let image = req.body.currentImage; // 기존 이미지 경로

    try {
        if (external_image && external_image.trim() !== '') {
            // 외부 이미지 URL이 제공된 경우
            image = external_image.trim();
        } else if (req.file) {
            // 외부 이미지 URL이 없고 파일이 업로드된 경우
            const optimizedImagePath = path.join(__dirname, 'public', 'images', `optimized_${req.file.filename}`);
            await sharp(req.file.path)
                .resize({ width: 500, withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(optimizedImagePath);
            image = `/images/optimized_${req.file.filename}`;
            // 업로드된 원본 이미지 삭제 (선택 사항)
            fs.unlinkSync(req.file.path);
        } // else, 이미지 변경 없음 (기존 이미지 유지)

        const formattedDatetime = datetime.replace('T', ' ');

        // 유효성 검사
        if (!validateDatetime(formattedDatetime)) {
            throw new Error('잘못된 날짜 및 시간 형식입니다.');
        }

        const sql = `UPDATE timeline SET date = ?, title = ?, body = ?, image = ?, link = ?, show_time = ? WHERE id = ?`;
        const params = [formattedDatetime, title, body, image, link, show_time ? 1 : 0, id];

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error updating timeline:', err.message);
                res.status(500).send(`Database error: ${err.message}`);
                return;
            }
            res.redirect('/admin');
        });
    } catch (error) {
        console.error('Unexpected error:', error.message);
        res.status(500).send(`Unexpected error: ${error.message}`);
    }
});

// **6. POST /admin/delete/:id**: 특정 타임라인 항목 삭제
app.post('/admin/delete/:id', (req, res) => {
    const id = req.params.id;
    const sql = `DELETE FROM timeline WHERE id = ?`;

    db.run(sql, [id], function(err) {
        if (err) {
            console.error('Error deleting timeline item:', err.message);
            res.status(500).send('Database error');
            return;
        }
        res.redirect('/admin');
    });
});

// **7. GET /**: 메인 타임라인 페이지 렌더링
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

// **8. 서버 시작**
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

