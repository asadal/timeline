# asadal-timeline

## node.js 설치
```
sudo apt-get install nodejs
```

## 프로젝트 폴더 생성 및 초기화
```
mkdir timeline
cd timeline
npm init -y
```

## 필요한 패키지 설치
```
npm install express sqlite3 body-parser ejs multer csv-parser
```

## 폴더 구조 설정
```
timeline-admin/
├── public/
│   ├── images/
│   └── css/
│   └── fonts/
├── views/
│   ├── admin.ejs
│   └── index.ejs
│   └── edit.ejs
├── db/
│   └── timeline.db
├── server.js
└── package.json
```

## 서버 실행
```
sudo node server.js
```

