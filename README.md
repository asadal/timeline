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
이 상태에서 웹사이트를 아래로 스크롤하면 제목이 사라지는 시점에서 제목이 웹페이지 상단에 고정되게 해주세요. 고정되는 바의 제목 글자 크기는 지금보다 작게 해주세요. 또 제목을 누르면 화면 상단으로 이동하도록 해주세요. 또 웹사이트 제목 글자는 지금보다 크고 굵게 해주세요.
