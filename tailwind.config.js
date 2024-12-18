module.exports = {
  content: [
    "./views/**/*.ejs", // EJS 파일을 처리 대상에 포함
    "./public/**/*.js", // JS 파일 처리
  ],
  theme: {
    extend: {
      fontFamily: {
        gmarket: ['"GmarketSans"', 'sans-serif'], // Gmarket Sans 폰트
        noto: ['"Noto Sans KR"', 'sans-serif'], // Noto Sans 폰트
      },
    },
  },
  plugins: [],
};

