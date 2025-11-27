# 🚗 NYC Vehicle Surveillance System

NYC 차량 감시 시스템 - 차량 카메라로 수집된 이미지 데이터를 지도에서 시각화하고, AI(YOLO)로 속도 제한 표지판을 검출하는 풀스택 웹 애플리케이션입니다.

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🗺️ **차량 경로 추적** | 2D/3D 맵에서 GPS 기반 경로 시각화 (MapLibre GL + Deck.gl) |
| 📷 **카메라 뷰어** | 경로를 따라 촬영된 이미지 재생 및 타임라인 |
| 🚦 **속도 표지판 감지** | YOLOv11x 모델로 속도 제한 표지판 탐지 |
| 💾 **메타데이터 캐싱** | EXIF 데이터에서 GPS/시간 정보 추출 및 SQLite 저장 |
| ⏰ **스케줄러** | 매일 밤 10시(KST) 자동 데이터 스캔 |
| 🔀 **멀티 트립 오버레이** | 여러 트립을 한 지도에 비교 표시 |

---

## 🏗️ 시스템 아키텍처

### 1. 전체 시스템 아키텍처

```mermaid
flowchart LR
    subgraph Client["🧑‍💻 Client"]
        BROWSER["Web Browser<br/>(React SPA)"]
    end

    subgraph Docker["🐳 Docker Compose"]
        subgraph NGINX["🌐 Nginx Reverse Proxy"]
            RP["nginx<br/>:80 → frontend<br/>/api → backend"]
        end

        subgraph FRONTEND["🖼️ Frontend Container :3000"]
            REACT["React 18 + TypeScript<br/>Vite + Tailwind CSS"]
        end

        subgraph BACKEND["⚙️ Backend Container :8000"]
            FASTAPI["FastAPI<br/>Python 3.11"]
        end
    end

    subgraph DATA["💾 Data Layer"]
        DB[("SQLite<br/>metadata_cache.db")]
        FS[("File System<br/>/mnt/sata_2025/NYC/")]
        YOLO["🤖 YOLO Weights<br/>speed_sign_detector.pt"]
    end

    BROWSER --> RP
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
        MAIN["main.tsx<br/>ReactDOM.createRoot"]
        MAIN --> APP["App.tsx<br/>메인 레이아웃"]

        subgraph Layout["📐 Layout Structure"]
            direction LR
            HEADER["Header.tsx<br/>상단 헤더"]
            SIDEBAR["Sidebar.tsx<br/>좌측 패널"]
            CENTER["MapView.tsx<br/>중앙 지도"]
            RIGHT["InfoPanel.tsx<br/>우측 패널"]
            BOTTOM["Timeline.tsx<br/>하단 타임라인"]
        end

        subgraph MapComponents["🗺️ Map Components"]
            MAP2D["Map2D.tsx<br/>MapLibre GL<br/>━━━━━━━━━━<br/>• 2D 지도<br/>• GeoJSON 레이어"]
            MAP3D["Map3D.tsx<br/>Deck.gl<br/>━━━━━━━━━━<br/>• 3D 지도<br/>• PathLayer<br/>• IconLayer"]
        end

        subgraph Panels["📊 Info Panels"]
            CAM["CameraViewer.tsx<br/>━━━━━━━━━━<br/>• 이미지 표시<br/>• 전체화면"]
            INFO["InfoPanel.tsx<br/>━━━━━━━━━━<br/>• 텔레메트리<br/>• GPS 좌표"]
            DET["DetectionPanel.tsx<br/>━━━━━━━━━━<br/>• YOLO 결과<br/>• bbox 오버레이"]
        end

        subgraph StateManagement["🔄 State Management"]
            ZS["Zustand<br/>tripStore.ts<br/>━━━━━━━━━━<br/>• selectedDevice<br/>• selectedTrip<br/>• currentIndex<br/>• viewMode"]
            RQ["React Query<br/>━━━━━━━━━━<br/>• API 데이터 캐싱<br/>• 자동 리페치"]
        end

        subgraph CustomHooks["🪝 Custom Hooks"]
            H1["useTrip.ts<br/>API 호출"]
            H2["useAnimations.ts<br/>애니메이션"]
            H3["useImagePreloader.ts<br/>이미지 프리로드"]
        end
    end

    APP --> Layout
    CENTER --> MapComponents
    RIGHT --> Panels
    APP --> StateManagement
    StateManagement --> CustomHooks
    CustomHooks -->|"HTTP"| API["FastAPI /api/*"]
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
│       ├── App.tsx                # 메인 앱
│       ├── main.tsx               # 진입점
│       ├── 📂 components/
│       │   ├── Header.tsx
│       │   ├── Sidebar.tsx
│       │   ├── MapView.tsx
│       │   ├── Map2D.tsx
│       │   ├── Map3D.tsx
│       │   ├── CameraViewer.tsx
│       │   ├── Timeline.tsx
│       │   ├── InfoPanel.tsx
│       │   ├── DetectionPanel.tsx
│       │   └── 📂 ui/             # UI 컴포넌트
│       ├── 📂 stores/
│       │   └── tripStore.ts       # Zustand
│       ├── 📂 hooks/
│       │   ├── useTrip.ts
│       │   ├── useAnimations.ts
│       │   └── useImagePreloader.ts
│       └── 📂 styles/
│           ├── index.css
│           └── cyberpunk.css
│
├── 📂 nginx/
│   └── nginx.conf
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

