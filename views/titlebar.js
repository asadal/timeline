<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= settings.site_title %></title>
    <!-- Gmarket Sans 폰트 로드 -->
    <link rel="stylesheet" href="/css/styles.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="/views/description.js"></script>
    <script src="/views/titlebar.js"></script>
</head>
<body class="bg-white transition-colors duration-300">

    <!-- 상단 고정 제목 바 -->
    <div id="sticky-header" class="sticky-header h-10 sm:h-10 md:h-12">
        <div class="fixed top-0 left-0 w-full h-10 sm:h-10 md:h-12 bg-gray-200 bg-opacity-10 z-10 cursor-pointer">
            <div id="progress-bar-fill" class="h-full h-10 sm:h-10 md:h-12 bg-gray-400 bg-opacity-30 transition-all duration-300 ease-out"></div>
        </div>
        <a href="javascript:void(0);" class="font-gmarket text-base sm:text-lg md:text-xl text-center" id="sticky-header-link">
            <%= settings.site_title %> <!-- 웹사이트 제목 -->
        </a>
    </div>
    
    <!-- 웹사이트 제목 및 설명 -->
    <div id="top" class="max-w-[800px] mx-auto px-4 mt-12">
        <div class="text-center mb-4">
            <!-- 웹사이트 제목을 반응형으로 표시 -->
            <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 font-gmarket">
                <%= settings.site_title %>
            </h1>
            
            <!-- 설명 부분 -->
            <div class="mt-8 mb-8 flex flex-col items-center justify-center">
                <div id="description-box" class="description-box border p-4 bg-gray-50 rounded-md">
                    <span id="site-description" class="block text-lg text-gray-600 font-noto md:text-base visible-description site-description">
                        <%- settings.site_description %>
                    </span>
                </div>
                <!-- 화살표 버튼 -->
                <button id="toggle-description" class="toggle-button text-gray-600 mt-2 focus:outline-none">
                    ︿
                </button>
            </div>
        </div>

        <!-- 타임라인 목록 -->
        <div class="page-content">
            <ol class="relative border-l border-gray-300">
                <% timeline.forEach(function(item) { %>
                    <li class="mb-10 ml-6">
                        <div class="absolute w-3 h-3 bg-gray-300 rounded-full mt-1.5 -left-1.5 border border-white"></div>
                        <time class="mb-1 text-sm font-normal leading-none text-gray-400 font-noto">
                            <% if (item.show_time) { %>
                                <%= item.formattedDate %> <%= item.formattedTime %>
                            <% } else { %>
                                <%= item.formattedDate %>
                            <% } %>
                        </time>
                        <h3 class="text-xl sm:text-xl md:text-2xl font-semibold text-gray-900 font-gmarket">
                            <%= item.title %>
                        </h3>

                        <p class="mb-4 text-lg font-normal text-gray-500 font-noto"><%= item.body %></p>
                        <% if (item.image) { %>
                            <% if (item.image.includes('youtube.com') || item.image.includes('youtu.be')) { %>
                                <!-- 유튜브 동영상 URL이면 iframe으로 임베딩 -->
                                <iframe width="560" height="315" src="https://www.youtube.com/embed/<%= item.image.split('v=')[1] %>" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="mb-4 w-full max-w-[500px]"></iframe>
                            <% } else { %>
                                <!-- 일반 이미지 처리 -->
                                <img src="<%= item.image %>" alt="타임라인 이미지" class="mb-4 w-full max-w-[500px]">
                            <% } %>
                        <% } %>

                        <% if (item.link) { %>
                            <a href="<%= item.link %>" target="_blank" class="inline-flex items-center px-4 py-2 text-teal-600 border border-teal-600 rounded-md text-sm font-medium hover:bg-teal-600 hover:text-white focus:ring-2 focus:ring-teal-600 focus:outline-none transition-colors duration-200 font-noto">
                            더 알아보기
                            <svg class="w-3 h-3 ml-2 transform transition-transform duration-300" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                            </svg>
                        </a>
                        <% } %>
                    </li>
                <% }); %>
            </ol>
        </div>
    </div>

    <!-- 'Top' 버튼 -->
    <button id="top-button" class="scroll-button top-button" onclick="window.scrollTo(0, 0)">
        ∧
    </button>

    <!-- 'Bottom' 버튼 -->
    <button id="bottom-button" class="scroll-button bottom-button" onclick="window.scrollTo(0, document.body.scrollHeight)">
        ∨
    </button>
</body>
</html>

