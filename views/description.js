        document.addEventListener('DOMContentLoaded', function () {
            // 설명 박스 접기/펼치기
            const toggleButton = document.getElementById('toggle-description');
            const siteDescription = document.getElementById('site-description');

            toggleButton.textContent = '︿'; // 초기 버튼 텍스트 설정

            toggleButton.addEventListener('click', function () {
                if (siteDescription.classList.contains('visible-description')) {
                    siteDescription.classList.remove('visible-description');
                    siteDescription.classList.add('hidden-description');
                    toggleButton.textContent = '﹀';
                } else {
                    siteDescription.classList.remove('hidden-description');
                    siteDescription.classList.add('visible-description');
                    toggleButton.textContent = '︿';
                }
            });
