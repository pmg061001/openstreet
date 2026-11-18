# 거리찾기

OpenStreetMap Nominatim으로 장소를 검색하고 OSRM 공개 자동차 경로 서비스로 두 장소 사이의 도로 거리를 계산하는 정적 웹앱입니다.

## Vercel 배포

1. 이 프로젝트를 GitHub 저장소에 올립니다.
2. Vercel에서 **Add New → Project**를 선택하고 저장소를 가져옵니다.
3. **Root Directory**를 `openstreet`로 설정해 배포합니다.

별도의 빌드 명령, Redis, API 키 또는 환경 변수는 필요하지 않습니다. 앱은 브라우저에서 Nominatim 및 OSRM 공개 API를 호출하므로 배포 후 인터넷 연결이 필요합니다. 공개 서비스의 이용 정책과 일시적인 요청 제한에 따라 검색이나 경로 조회가 지연될 수 있습니다.
