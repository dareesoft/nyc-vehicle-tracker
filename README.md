# 🚗 NYC Vehicle Surveillance System

NYC 차량 감시 시스템 - 차량 카메라로 수집된 이미지 데이터를 지도에서 시각화하고, AI(YOLO)로 속도 제한 표지판을 검출하는 풀스택 웹 애플리케이션입니다.

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🗺️ **차량 경로 추적** | 2D/3D 맵에서 GPS 기반 경로 시각화 (MapLibre GL + Deck.gl) |
| 📷 **카메라 뷰어** | 경로를 따라 촬영된 이미지 재생 및 타임라인 |
| 🚦 **속도 표지판 감지** | YOLOv11x 모델로 속도 제한 표지판 탐지 |
| 💾 **메타데이터 캐싱** | EXIF 데이터에서 GPS/시간 정보 추출 및 SQLite 저장 |
| ⏰ **스케줄러** | 매일 자동 데이터 스캔 |
| 🔀 **멀티 트립 오버레이** | 여러 트립을 한 지도에 비교 표시 |
| 📱 **반응형 UI** | 모바일/데스크톱 자동 감지, 전용 레이아웃 |
| 🚗 **드라이빙 모드** | 자동 재생 + 헤딩업 방식 지도 회전 |
| 🔐 **접근 제어** | 커스텀 사이버펑크 테마 로그인 페이지 |

---

## 📱 모바일 지원

모바일 디바이스에서 최적화된 UI를 제공합니다.

### 레이아웃 비교

| 데스크톱 | 모바일 |
|----------|--------|
| 3컬럼 레이아웃 (사이드바 + 맵 + 패널) | 전체화면 맵 + 바텀시트 |
| 풀 HUD 오버레이 | 최소화된 컴팩트 HUD |
| 키보드 단축키 | 터치 제스처 |

### 모바일 UI 구조

```
┌─────────────────────────┐
│  Mini Header (축소형)    │
├─────────────────────────┤
│                         │
│    전체화면 지도         │
│    (컴팩트 HUD)          │
│                         │
├─────────────────────────┤
│  Timeline (재생 컨트롤)  │
├─────────────────────────┤
│  Tab Bar                │
│  [지도] [카메라] [정보]  │
└─────────────────────────┘
```

### 드라이빙 모드
- ▶️ 재생 버튼으로 자동 프레임 전환
- 속도 조절: 1×, 2×, 4×
- 헤딩업(Heading-Up) 모드: 진행 방향이 항상 위쪽

---



```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend
    participant A as Backend API

    B->>F: GET /
    F->>F: 토큰 확인 (localStorage)
    alt 토큰 없음/만료
        F-->>B: LoginPage 표시
        B->>B: ID/PW 입력
        B->>A: POST /api/auth/login
        A-->>B: {token, user, expiresAt}
        B->>B: localStorage 저장
        B->>B: "AUTHENTICATING..." 애니메이션
        B->>B: 부팅 시퀀스 표시
        F-->>B: 메인 앱 표시
    else 유효한 토큰
        B->>A: GET /api/auth/verify
        A-->>B: 200 OK
        F-->>B: 메인 앱 표시
    end
```

### API 엔드포인트
| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/auth/login` | 로그인 (ID/PW → 토큰 발급) |
| `GET` | `/api/auth/verify` | 토큰 검증 |
| `POST` | `/api/auth/logout` | 로그아웃 (토큰 무효화) |

### 관련 파일
| 파일 | 설명 |
|------|------|
| `frontend/src/pages/LoginPage.tsx` | 로그인 UI + Matrix Rain 배경 |
| `frontend/src/hooks/useAuth.tsx` | 인증 상태 관리 (Context API) |
| `frontend/src/components/BootSequence.tsx` | 부팅 시퀀스 애니메이션 |
| `frontend/src/components/LogoutConfirmModal.tsx` | 로그아웃 확인 모달 |
| `backend/main.py` | 인증 API 엔드포인트 |

---

## 🏗️ 시스템 아키텍처

### 1. 전체 시스템 아키텍처

```mermaid
flowchart LR
    subgraph Client["🧑‍💻 Client"]
        BROWSER["Web Browser<br/>(React SPA)"]
    end

    subgraph Docker["🐳 Docker"]
        subgraph NGINX["🌐 Nginx Reverse Proxy :80"]
            AUTH["🔐 Basic Auth<br/>(.htpasswd)"]
            RP["Routing<br/>/ → frontend<br/>/api → backend"]
        end

        subgraph FRONTEND["🖼️ Frontend :3001"]
            REACT["React 18 + TypeScript<br/>Vite + Tailwind CSS"]
        end

        subgraph BACKEND["⚙️ Backend :8000"]
            FASTAPI["FastAPI<br/>Python 3.11"]
        end
    end

    subgraph DATA["💾 Data Layer"]
        DB[("SQLite<br/>metadata_cache.db")]
        FS[("File System<br/>/mnt/sata_2025/NYC/")]
        YOLO["🤖 YOLO Weights<br/>speed_sign_detector.pt"]
    end

    BROWSER -->|"ID/PW"| AUTH
    AUTH --> RP
    RP --> REACT
    RP --> FASTAPI
    FASTAPI --> DB
    FASTAPI --> FS
    FASTAPI --> YOLO
```

### 2. 상세 아키텍처 (컴포넌트 레벨)

```mermaid
flowchart TB
    subgraph Client["🧑‍💻 Client"]
        BROWSER["Web Browser"]
    end

    subgraph NGINX["🌐 Nginx Reverse Proxy"]
        RP["nginx<br/>- :80 → frontend :3000<br/>- /api → backend :8000"]
    end

    subgraph FRONTEND["🖼️ Frontend (React + Vite)"]
        APP["App.tsx"]
        
        subgraph COMPONENTS["UI Components"]
            HEADER["Header"]
            SIDEBAR["Sidebar<br/>(디바이스/트립 선택)"]
            MAPVIEW["MapView<br/>(2D/3D 토글)"]
            MAP2D["Map2D<br/>(MapLibre GL)"]
            MAP3D["Map3D<br/>(Deck.gl)"]
            CAMVIEW["CameraViewer<br/>(이미지 뷰어)"]
            TIMELINE["Timeline<br/>(재생 타임라인)"]
            INFOP["InfoPanel<br/>(텔레메트리)"]
            DETP["DetectionPanel<br/>(YOLO 결과)"]
        end

        subgraph STATE["State Management"]
            ZUSTAND["Zustand<br/>tripStore.ts"]
            RQ["React Query<br/>(API 캐싱)"]
            HOOKS["Custom Hooks"]
        end
    end

    subgraph BACKEND["⚙️ Backend (FastAPI)"]
        MAIN["main.py<br/>REST API"]

        subgraph API["API Endpoints"]
            EP1["GET /api/devices"]
            EP2["GET /api/trips/{id}"]
            EP3["GET /api/trip/{id}/{date}/3d"]
            EP4["GET /api/detections/..."]
            EP5["POST /api/scan/start"]
        end

        subgraph SERVICES["Domain Services"]
            META["MetadataExtractor<br/>EXIF 파싱"]
            TRIPB["TripBuilder<br/>GeoJSON 생성"]
            SIGNDET["SignDetector<br/>YOLO v11x"]
            SCHED["Scheduler<br/>매일 22:00 KST"]
        end
    end

    subgraph DATA["💾 Data Layer"]
        DB[("SQLite<br/>- images<br/>- detections<br/>- notifications")]
        FS[("Image Files<br/>/mnt/sata_2025/NYC/")]
        WEIGHTS["YOLO Weights"]
    end

    BROWSER --> RP
    RP --> APP
    RP --> MAIN
    APP --> COMPONENTS
    APP --> STATE
    STATE --> API
    API --> SERVICES
    META --> DB
    META --> FS
    TRIPB --> DB
    SIGNDET --> DB
    SIGNDET --> FS
    SIGNDET --> WEIGHTS
    SCHED --> META
    SCHED --> SIGNDET
```

---

## ⚙️ 백엔드 아키텍처

```mermaid
flowchart TB
    subgraph FastAPI["⚙️ FastAPI Backend (main.py)"]
        ROUTER["APIRouter<br/>/api/..."]
        
        ROUTER --> DEV_EP["📱 Devices / Trips<br/>- GET /devices<br/>- GET /trips/{device_id}<br/>- GET /trip/{id}/{date}"]
        ROUTER --> GEO_EP["🗺️ Geo / 3D Route<br/>- GET /trip/{id}/{date}/3d<br/>- POST /combined-routes"]
        ROUTER --> IMG_EP["🖼️ Image<br/>- GET /image/...<br/>- GET /thumbnail/..."]
        ROUTER --> DET_EP["🔍 Detections<br/>- GET /detections/{id}/{date}<br/>- GET /detections/stats"]
        ROUTER --> SCAN_EP["🔄 Scan<br/>- POST /scan/start<br/>- GET /scan/status"]
    end

    subgraph Services["🧠 Domain Services"]
        META["MetadataExtractor<br/>(metadata_extractor.py)<br/>━━━━━━━━━━━━━━<br/>• EXIF 파싱<br/>• GPS/시간 추출<br/>• SQLite 캐싱"]
        TRIPB["TripBuilder<br/>(trip_builder.py)<br/>━━━━━━━━━━━━━━<br/>• GeoJSON 경로 생성<br/>• 3D 경로 데이터<br/>• 트립 통계 계산"]
        SIGN["SignDetector<br/>(sign_detector.py)<br/>━━━━━━━━━━━━━━<br/>• YOLO v11x 추론<br/>• 배치 처리<br/>• bbox/score 저장"]
        SCHED["Scheduler<br/>(scheduler.py)<br/>━━━━━━━━━━━━━━<br/>• APScheduler<br/>• 매일 22:00 KST<br/>• 자동 스캔 실행"]
    end

    subgraph Storage["💾 Storage"]
        DB[("SQLite<br/>metadata_cache.db<br/>━━━━━━━━━━━━━━<br/>• images<br/>• detections<br/>• notifications")]
        IMGFS[("Image Filesystem<br/>/mnt/sata_2025/NYC/<br/>━━━━━━━━━━━━━━<br/>• 101/{device}/{date}/<br/>• thumbnails/")]
        WEIGHTS["🤖 YOLO Weights<br/>speed_sign_detector.pt"]
    end

    SCAN_EP --> META
    SCAN_EP --> SIGN
    DEV_EP --> META
    GEO_EP --> TRIPB
    IMG_EP --> IMGFS
    DET_EP --> DB
    
    META --> DB
    META --> IMGFS
    TRIPB --> DB
    SIGN --> DB
    SIGN --> IMGFS
    SIGN --> WEIGHTS
    SCHED --> META
    SCHED --> SIGN
```

---

## 🖼️ 프론트엔드 아키텍처

```mermaid
flowchart TB
    subgraph ReactApp["🖼️ React Application"]
        MAIN["main.tsx<br/>ReactDOM.createRoot<br/>+ AuthProvider"]
        MAIN --> APP["App.tsx<br/>인증 체크 + 반응형 분기"]

        subgraph Auth["🔐 Authentication"]
            LOGIN["LoginPage.tsx<br/>━━━━━━━━━━<br/>• Matrix Rain 배경<br/>• 글리치 효과<br/>• 타이핑 애니메이션"]
            BOOT["BootSequence.tsx<br/>━━━━━━━━━━<br/>• 부팅 애니메이션"]
            LOGOUT["LogoutConfirmModal.tsx"]
        end

        subgraph Layouts["📐 Responsive Layouts"]
            DESKTOP["DesktopLayout.tsx<br/>━━━━━━━━━━<br/>• 3컬럼 레이아웃<br/>• 풀 HUD"]
            MOBILE["MobileLayout.tsx<br/>━━━━━━━━━━<br/>• 전체화면 맵<br/>• 바텀시트<br/>• 탭 네비게이션"]
        end

        subgraph MapComponents["🗺️ Map Components"]
            MAP2D["Map2D.tsx<br/>MapLibre GL"]
            MAP3D["Map3D.tsx<br/>Deck.gl"]
        end

        subgraph MobileComponents["📱 Mobile Components"]
            MH["MobileHeader.tsx"]
            BS["BottomSheet.tsx"]
            TB["TabBar.tsx"]
            MT["MobileTimeline.tsx"]
        end

        subgraph Panels["📊 Info Panels"]
            CAM["CameraViewer.tsx"]
            INFO["InfoPanel.tsx"]
            DET["DetectionPanel.tsx"]
        end

        subgraph StateManagement["🔄 State Management"]
            ZS["Zustand tripStore.ts"]
            RQ["React Query"]
            AUTH["useAuth.tsx<br/>━━━━━━━━━━<br/>• AuthContext<br/>• 토큰 관리"]
        end
    end

    APP -->|"!isAuthenticated"| Auth
    APP -->|"isAuthenticated + isMobile"| MOBILE
    APP -->|"isAuthenticated + !isMobile"| DESKTOP
    LOGIN --> BOOT
    DESKTOP --> MapComponents
    MOBILE --> MapComponents
    MOBILE --> MobileComponents
    DESKTOP --> Panels
    APP --> StateManagement
    StateManagement -->|"HTTP"| API["FastAPI /api/*"]
```

---

## 📁 디렉토리 구조

```
nyc-vehicle-tracker/
├── 📂 backend/
│   ├── main.py                    # FastAPI 진입점
│   ├── requirements.txt           # Python 의존성
│   ├── Dockerfile
│   ├── 📂 data/
│   │   └── metadata_cache.db      # SQLite 캐시
│   ├── 📂 models/
│   │   └── speed_sign_detector.pt # YOLO 모델
│   └── 📂 services/
│       ├── metadata_extractor.py  # EXIF 파싱
│       ├── trip_builder.py        # GeoJSON 생성
│       ├── sign_detector.py       # YOLO 탐지
│       └── scheduler.py           # 일일 스캔
│
├── 📂 frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── 📂 src/
│       ├── App.tsx                # 인증 + 반응형 분기
│       ├── main.tsx               # 진입점 + AuthProvider
│       ├── 📂 pages/
│       │   └── LoginPage.tsx      # 커스텀 로그인 + Matrix Rain
│       ├── 📂 layouts/
│       │   ├── DesktopLayout.tsx  # 데스크톱 3컬럼
│       │   └── MobileLayout.tsx   # 모바일 전체화면
│       ├── 📂 components/
│       │   ├── Header.tsx
│       │   ├── Sidebar.tsx
│       │   ├── MapView.tsx
│       │   ├── Map2D.tsx          # 반응형 HUD
│       │   ├── Map3D.tsx          # 반응형 HUD
│       │   ├── CameraViewer.tsx
│       │   ├── Timeline.tsx
│       │   ├── InfoPanel.tsx
│       │   ├── DetectionPanel.tsx
│       │   ├── ErrorBoundary.tsx  # 에러 처리
│       │   ├── BootSequence.tsx   # 부팅 애니메이션
│       │   ├── LogoutConfirmModal.tsx  # 로그아웃 확인
│       │   ├── 📂 mobile/         # 모바일 전용
│       │   │   ├── MobileHeader.tsx
│       │   │   ├── BottomSheet.tsx
│       │   │   ├── TabBar.tsx
│       │   │   └── MobileTimeline.tsx
│       │   └── 📂 ui/             # UI 컴포넌트
│       ├── 📂 stores/
│       │   └── tripStore.ts       # Zustand
│       ├── 📂 hooks/
│       │   ├── useTrip.ts
│       │   ├── useAuth.tsx        # 인증 Context + Hook
│       │   ├── useMediaQuery.ts   # 반응형 감지
│       │   ├── useAnimations.ts
│       │   └── useImagePreloader.ts
│       ├── 📂 types/
│       │   └── index.ts           # 공통 타입
│       └── 📂 styles/
│           ├── index.css
│           └── cyberpunk.css
│
├── 📂 nginx/
│   ├── nginx.conf             # Nginx 설정 + Basic Auth
│   ├── .htpasswd              # 사용자 비밀번호
│   └── Dockerfile             # Nginx 이미지
│
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 🚀 Quick Start

### 개발 모드

```bash
# 의존성 설치
make setup

# 개발 서버 실행
make dev
```

### Docker 배포

```bash
# 빌드
make build

# 실행
make start

# 로그 확인
make logs

# 중지
make stop
```

### 수동 실행

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🛠️ 기술 스택

### Backend
| 기술 | 용도 |
|------|------|
| **Python 3.11** | 런타임 |
| **FastAPI** | REST API 프레임워크 |
| **SQLite** | 메타데이터 캐싱 |
| **Pillow** | EXIF 데이터 추출 |
| **PyTorch** | 딥러닝 런타임 |
| **Ultralytics** | YOLO v11x 추론 |
| **APScheduler** | 일일 스케줄링 |

### Frontend
| 기술 | 용도 |
|------|------|
| **React 18** | UI 프레임워크 |
| **TypeScript** | 타입 안전성 |
| **Vite** | 빌드 도구 |
| **Tailwind CSS** | 스타일링 |
| **MapLibre GL** | 2D 지도 |
| **Deck.gl** | 3D 시각화 |
| **Zustand** | 상태 관리 |
| **TanStack Query** | 서버 상태 관리 |

### Infrastructure
| 기술 | 용도 |
|------|------|
| **Docker** | 컨테이너화 |
| **Docker Compose** | 오케스트레이션 |
| **Nginx** | 리버스 프록시 |

---

## 📡 API Endpoints

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/auth/login` | 로그인 |
| `GET` | `/api/auth/verify` | 토큰 검증 |
| `POST` | `/api/auth/logout` | 로그아웃 |
| `GET` | `/api/health` | 헬스 체크 |
| `GET` | `/api/devices` | 디바이스 목록 |
| `GET` | `/api/trips/{device_id}` | 트립 목록 |
| `GET` | `/api/trip/{device_id}/{date}` | 트립 상세 |
| `GET` | `/api/trip/{device_id}/{date}/3d` | 3D 경로 데이터 |
| `GET` | `/api/trip/{device_id}/{date}/geojson` | GeoJSON 경로 |
| `GET` | `/api/image/...` | 이미지 서빙 |
| `GET` | `/api/thumbnail/...` | 썸네일 서빙 |
| `GET` | `/api/detections/{device_id}/{date}` | YOLO 탐지 결과 |
| `POST` | `/api/scan/start` | 메타데이터 스캔 시작 |
| `GET` | `/api/scan/status` | 스캔 상태 |
| `POST` | `/api/combined-routes` | 멀티 트립 오버레이 |

---

## 📊 데이터베이스 스키마

```mermaid
erDiagram
    images {
        int id PK
        string file_path UK
        string device_id
        string camera_type
        float latitude
        float longitude
        string timestamp
        int link_id
        bool forward
        int sequence
        bool detected
    }

    detections {
        int id PK
        int image_id FK
        string class_name
        float confidence
        float bbox_x1
        float bbox_y1
        float bbox_x2
        float bbox_y2
    }

    notifications {
        int id PK
        string type
        string device_id
        string date
        string message
        int count
        bool read
    }

    images ||--o{ detections : "has"
```

---

## 📜 License

MIT License

---

## 👥 Contributors

- **Daree** - Initial development

