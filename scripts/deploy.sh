#!/bin/bash

# AI Interview Maker 2.0 - Deployment Script
# This script helps deploy the application to various environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build backend
build_backend() {
    print_info "Building backend..."
    cd backend
    npm install
    npm run build
    cd ..
    print_success "Backend built successfully"
}

# Build frontend
build_frontend() {
    print_info "Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
    print_success "Frontend built successfully"
}

# Deploy to Vercel
deploy_vercel() {
    print_info "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI is not installed. Install with: npm install -g vercel"
        exit 1
    fi
    
    # Deploy backend
    print_info "Deploying backend to Vercel..."
    cd backend
    vercel --prod
    cd ..
    print_success "Backend deployed to Vercel"
    
    # Deploy frontend
    print_info "Deploying frontend to Vercel..."
    cd frontend
    vercel --prod
    cd ..
    print_success "Frontend deployed to Vercel"
}

# Deploy with Docker
deploy_docker() {
    print_info "Deploying with Docker..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create it from .env.example"
        exit 1
    fi
    
    # Build and start containers
    docker-compose down
    docker-compose build
    docker-compose up -d
    
    print_success "Application deployed with Docker"
    print_info "Backend: http://localhost:3000"
    print_info "Frontend: http://localhost:80"
}

# Run tests
run_tests() {
    print_info "Running tests..."
    
    # Backend tests
    print_info "Running backend tests..."
    cd backend
    npm test
    cd ..
    print_success "Backend tests passed"
    
    # Frontend build test
    print_info "Testing frontend build..."
    cd frontend
    npm run build
    cd ..
    print_success "Frontend build test passed"
}

# Main menu
show_menu() {
    echo ""
    echo "=================================="
    echo "AI Interview Maker 2.0 Deployment"
    echo "=================================="
    echo ""
    echo "1. Build All"
    echo "2. Run Tests"
    echo "3. Deploy to Vercel"
    echo "4. Deploy with Docker"
    echo "5. Full Pipeline (Test + Build + Deploy to Vercel)"
    echo "6. Exit"
    echo ""
}

# Main script
main() {
    check_prerequisites
    
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Select an option: " choice
            
            case $choice in
                1)
                    build_backend
                    build_frontend
                    ;;
                2)
                    run_tests
                    ;;
                3)
                    deploy_vercel
                    ;;
                4)
                    deploy_docker
                    ;;
                5)
                    run_tests
                    build_backend
                    build_frontend
                    deploy_vercel
                    ;;
                6)
                    print_info "Exiting..."
                    exit 0
                    ;;
                *)
                    print_error "Invalid option"
                    ;;
            esac
        done
    else
        # Command line mode
        case $1 in
            build)
                build_backend
                build_frontend
                ;;
            test)
                run_tests
                ;;
            vercel)
                deploy_vercel
                ;;
            docker)
                deploy_docker
                ;;
            full)
                run_tests
                build_backend
                build_frontend
                deploy_vercel
                ;;
            *)
                echo "Usage: $0 {build|test|vercel|docker|full}"
                exit 1
                ;;
        esac
    fi
}

# Run main function
main "$@"
