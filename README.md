# 💬 WaveChat Enterprise

WaveChat Enterprise is a highly scalable, real-time workspace collaboration and chat application designed for modern teams. Built with a monorepo structure, it provides robust communication services and clean architecture.

## 🚀 Key Features
- **Monorepo Architecture**: Clean separation of apps and reusable packages.
- **Real-time Messaging**: Low-latency chat delivery powered by WebSockets.
- **Docker Ready**: Easy containerized deployment setup with Docker Compose.
- **Developer Friendly**: Fully typed with TypeScript for reliable development.

## 🛠️ Tech Stack
- **Frontend/Backend**: TypeScript, Node.js
- **Database**: MongoDB & Redis (Configured via Docker)
- **Containerization**: Docker, Docker Compose

## 💻 Local Setup & Installation

Follow these steps to run the project locally on your machine:

### Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org) (v18+ recommended)
- [Docker & Docker Desktop](https://docker.com)

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com
   cd Wave-Chat-Enterprise/WaveChat-Enterprise-main
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Copy the `.env.example` file and create a new `.env` file in the root directory.
   - Update your database strings and tokens inside `.env`.

4. **Spin up Infrastructure (Database/Cache):**
   ```bash
   docker-compose up -d
   ```

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```

## 👥 Contributors
- **Harshit Shukla** ([@harshit2556shukla](https://github.com))

## 📄 License
This project is licensed under the MIT License.
