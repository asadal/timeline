# asadal-Timeline 

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

## PostgresQL 설치
### Linux
```
sudo apt install postgresql postgresql-contrib
```
### MacOS
```
brew install postgresql
sudo services start postgresql
```

## 필요한 패키지 설치
```
npm install express sqlite3 body-parser ejs multer csv-parser pg moment-timezone dotenv
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

## Postgres DB 설정

### PostgreSQL 사용자로 전환 (Linux/macOS)
```
sudo -i -u postgres
```

### psql 쉘에 접속
```
psql
```

### 새 데이터베이스 생성
```
CREATE DATABASE timeline_db;
```

### 새 사용자 생성 및 권한 부여
```
CREATE USER timeline_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE timeline_db TO timeline_user;
```

### psql 쉘 종료
```
\q
```

### 시스템 사용자로 돌아가기 (Linux/macOS)
```
exit
```

### 백업 db 넣기
```
psql -U timeline_user -d timeline -f /Users/hanimedialab/Downloads/timeline_data.sql
```

### timeline_db 접속
```
psql -U timeline_user -d timeline_db
```

### timeline 테이블 읽기
```
SELECT * FROM timeline;
```
