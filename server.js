const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const upload = multer({ dest: 'uploads/' }); // 업로드 폴더 설정

// 데이터베이스 연결
const db = new sqlite3.Database('./db/timeline.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the timeline database.');
    }
});

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// 타임라인 페이지
app.get('/', (req, res) => {
    const queryTimeline = 'SELECT * FROM timeline ORDER BY date, time';
    const querySettings = 'SELECT * FROM settings WHERE id = 1';

    db.all(queryTimeline, [], (err, timeline) => {
        if (err) {
            console.error('타임라인 데이터 가져오기 중 오류:', err.message);
            return res.status(500).send('타임라인 데이터를 가져오는 중 오류가 발생했습니다.');
        }

        db.get(querySettings, [], (err, settings) => {
            if (err) {
                console.error('설정 데이터 가져오기 중 오류:', err.message);
                return res.status(500).send('설정을 가져오는 중 오류가 발생했습니다.');
            }

            res.render('index', { timeline, settings });
        });
    });
});

// 어드민 페이지
app.get('/admin', (req, res) => {
    const queryTimeline = 'SELECT * FROM timeline ORDER BY date, time';
    const querySettings = 'SELECT * FROM settings WHERE id = 1';

    db.all(queryTimeline, [], (err, timeline) => {
        if (err) {
            console.error('타임라인 데이터 가져오기 중 오류:', err.message);
            return res.status(500).send('타임라인 데이터를 가져오는 중 오류가 발생했습니다.');
        }

        db.get(querySettings, [], (err, settings) => {
            if (err) {
                console.error('설정 데이터 가져오기 중 오류:', err.message);
                return res.status(500).send('설정을 가져오는 중 오류가 발생했습니다.');
            }

            res.render('admin', { timeline, settings });
        });
    });
});

// 웹사이트 제목 및 설명 저장
app.post('/admin/update-settings', (req, res) => {
    const { site_title, site_description } = req.body;

    const query = `
        INSERT INTO settings (id, site_title, site_description)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            site_title = excluded.site_title,
            site_description = excluded.site_description
    `;

    db.run(query, [site_title, site_description], (err) => {
        if (err) {
            console.error('설정 저장 중 오류:', err.message);
            return res.status(500).send('설정을 저장하는 중 오류가 발생했습니다.');
        }
        res.redirect('/admin');
    });
});

// 타임라인 항목 추가
app.post('/admin/add', (req, res) => {
    const { datetime, title, body, link, show_time } = req.body;
    const image = req.body.image || req.body.external_image; // 업로드된 이미지 또는 외부 이미지 URL 사용
    const date = datetime.split('T')[0];
    const time = datetime.split('T')[1];

    const query = `
        INSERT INTO timeline (date, time, title, body, image, link, show_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(query, [date, time, title, body, image, link, show_time ? 1 : 0], (err) => {
        if (err) {
            console.error('데이터 저장 중 오류:', err.message);
            return res.status(500).send('데이터 저장 중 오류가 발생했습니다.');
        }
        res.redirect('/admin');
    });
});

// 타임라인 항목 수정 페이지 렌더링
app.get('/admin/edit/:id', (req, res) => {
    const { id } = req.params;

    const query = 'SELECT * FROM timeline WHERE id = ?';
    db.get(query, [id], (err, timeline) => {
        if (err) {
            console.error('수정할 데이터 가져오기 중 오류:', err.message);
            return res.status(500).send('수정할 데이터를 가져오는 중 오류가 발생했습니다.');
        }
        res.render('edit', { timeline });
    });
});

// 타임라인 항목 수정
app.post('/admin/edit/:id', (req, res) => {
    const { id } = req.params;
    const { datetime, title, body, link, show_time } = req.body;
    const image = req.body.image || req.body.external_image; // 업로드된 이미지 또는 외부 이미지 URL 사용
    const date = datetime.split('T')[0];
    const time = datetime.split('T')[1];

    const query = `
        UPDATE timeline
        SET date = ?, time = ?, title = ?, body = ?, image = ?, link = ?, show_time = ?
        WHERE id = ?
    `;
    db.run(query, [date, time, title, body, image, link, show_time ? 1 : 0, id], (err) => {
        if (err) {
            console.error('데이터 수정 중 오류:', err.message);
            return res.status(500).send('데이터 수정 중 오류가 발생했습니다.');
        }
        res.redirect('/admin');
    });
});

// 타임라인 항목 삭제
app.post('/admin/delete/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM timeline WHERE id = ?';
    db.run(query, [id], (err) => {
        if (err) {
            console.error('삭제 중 오류 발생:', err.message);
            return res.status(500).send('데이터 삭제 중 오류가 발생했습니다.');
        }
        res.redirect('/admin');
    });
});

// CSV 파일 업로드 및 처리
app.post('/admin/upload-csv', upload.single('csvFile'), (req, res) => {
    const filePath = req.file.path; // 업로드된 파일 경로
    const timelineData = [];

    // CSV 파일 파싱
    fs.createReadStream(filePath)
        .pipe(csvParser({ separator: '\t', quote: '"' })) // 따옴표 예외처리
        .on('data', (row) => {
            const { date, time, title, body, image, link, show_time } = row;

            // `date` 필드 검증: 비어 있으면 로그 출력 및 스킵
            if (!date || date.trim() === '') {
                console.error('누락된 날짜:', row);
                return;
            }

            timelineData.push({
                date: date.trim(),
                time: time || null,
                title: title || '제목 없음',
                body: body || '',
                image: image || null,
                link: link || null,
                show_time: show_time ? parseInt(show_time) : 0,
            });
        })
        .on('end', () => {
            if (timelineData.length === 0) {
                console.error('CSV 데이터가 없습니다.');
                return res.status(400).send('CSV 파일에 유효한 데이터가 없습니다.');
            }

            const placeholders = timelineData.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
            const values = timelineData.flatMap((item) => [
                item.date,
                item.time,
                item.title,
                item.body,
                item.image,
                item.link,
                item.show_time,
            ]);

            const query = `
                INSERT INTO timeline (date, time, title, body, image, link, show_time)
                VALUES ${placeholders}
            `;

            db.run(query, values, (err) => {
                if (err) {
                    console.error('CSV 데이터를 저장하는 중 오류:', err.message);
                    return res.status(500).send('CSV 데이터를 저장하는 중 오류가 발생했습니다.');
                }
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('파일 삭제 중 오류:', unlinkErr.message);
                    }
                });
                res.redirect('/admin');
            });
        })
        .on('error', (err) => {
            console.error('CSV 처리 중 오류:', err.message);
            res.status(500).send('CSV 처리 중 오류가 발생했습니다.');
        });
});

// 서버 실행
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

