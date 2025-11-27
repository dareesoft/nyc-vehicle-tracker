.PHONY: help dev build start stop logs clean

help:
	@echo "NYC Vehicle Surveillance System"
	@echo ""
	@echo "Commands:"
	@echo "  make dev      - Start development servers"
	@echo "  make build    - Build Docker images"
	@echo "  make start    - Start production containers"
	@echo "  make stop     - Stop containers"
	@echo "  make logs     - View container logs"
	@echo "  make clean    - Remove containers and volumes"
	@echo "  make scan     - Trigger metadata scan"

# Development
dev:
	@echo "Starting development servers..."
	@cd backend && uvicorn main:app --reload --port 8000 &
	@cd frontend && npm run dev

# Docker commands
build:
	docker-compose build

start:
	docker-compose up -d

stop:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

# Backend commands
scan:
	curl -X POST http://localhost:8000/api/scan/start

status:
	curl http://localhost:8000/api/scan/status | python3 -m json.tool

# Frontend commands
install-frontend:
	cd frontend && npm install

build-frontend:
	cd frontend && npm run build

# Backend commands
install-backend:
	cd backend && pip install -r requirements.txt

# Full setup
setup: install-backend install-frontend
	@echo "Setup complete!"

