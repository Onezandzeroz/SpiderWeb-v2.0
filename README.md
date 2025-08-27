# SpiderWeb v2.0

**SpiderWeb v2.0** is an advanced LLM-controlled headless backend framework designed to seamlessly process and distribute content across multiple frontend systems through intelligent email interpretation and automated publishing workflows.

## Overview

SpiderWeb v2.0 serves as a powerful middleware solution that transforms email-based content creation into automated publishing workflows across various frontend platforms. The framework leverages Large Language Model (LLM) capabilities to interpret email content, classify it, and automatically transform and publish it to connected frontend systems.

### Key Features

- **Intelligent Email Processing**: Automatically interprets incoming emails, extracts content, and classifies by type and intent
- **Multi-Frontend Support**: Connect to and manage multiple frontend systems with different authentication methods
- **LLM-Powered Transformation**: Uses AI to transform content according to target frontend schemas
- **Real-time Monitoring**: Comprehensive dashboard for system health, performance metrics, and error tracking
- **Real-time Communication**: Built-in Socket.IO support for live updates and notifications
- **Robust Error Handling**: Comprehensive error management with automatic recovery mechanisms

## Features

### Core Capabilities

1. **Email Interpretation Engine**
   - Content classification (articles, products, updates, announcements)
   - Intent detection (immediate, scheduled, draft)
   - Target frontend identification
   - Attachment processing and media handling

2. **Frontend Connection Management**
   - Support for OAuth2, API Key, and JWT authentication
   - Dynamic schema discovery and validation
   - Connection health monitoring
   - Automatic reconnection and failover

3. **Content Transformation Pipeline**
   - Schema-based content transformation
   - Media processing and optimization
   - Field mapping and validation
   - Multi-format support

4. **Publishing Execution**
   - Automated content publishing
   - Batch processing capabilities
   - Retry mechanisms and error handling
   - Publishing status tracking

5. **Monitoring & Analytics**
   - Real-time system health dashboard
   - Performance metrics and statistics
   - Error logging and analysis
   - Connection status monitoring

## Technology Stack

### Backend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Database**: Prisma ORM with SQLite
- **Real-time**: Socket.IO
- **AI Integration**: z-ai-web-dev-sdk
- **Authentication**: NextAuth.js v4

### Frontend
- **UI Framework**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui
- **Icons**: Lucide React
- **State Management**: Zustand + TanStack Query
- **Charts**: Recharts

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- SQLite (included with Prisma)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Onezandzeroz/SpiderWeb-v2.0.git
   cd SpiderWeb-v2.0
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# AI SDK (optional)
Z_AI_API_KEY="your-z-ai-api-key"

# Email Processing (optional)
EMAIL_SERVICE_API_KEY="your-email-service-key"
EMAIL_SERVICE_ENDPOINT="https://api.email-service.com"

# Frontend Connections (example)
FRONTEND_CONNECTIONS='[
  {
    "name": "Main Website",
    "api_endpoint": "https://api.example.com",
    "auth_type": "oauth2",
    "credentials": "encrypted-credentials-here"
  }
]'
```

## Usage

### Basic Workflow

1. **Configure Frontend Connections**
   - Navigate to the dashboard
   - Add your frontend systems in the "Connections" tab
   - Provide API endpoints and authentication details

2. **Send Content Emails**
   - Email content to the configured address
   - Include specific keywords for content type and targeting
   - Attach media files if needed

3. **Monitor Processing**
   - View real-time processing status in the dashboard
   - Track errors and success rates
   - Monitor system health and performance

### Email Format Examples

#### Blog Post
```
Subject: New Blog Post: Understanding AI Frameworks

Body:
This is a comprehensive guide about AI frameworks...

#blog #ai #tutorial
category: technology
priority: high

publish now
```

#### Product Update
```
Subject: Product Update: Enhanced Features

Body:
We're excited to announce new features...

#product #update #features
category: product
featured: true

Target: main site, developer portal
```

### API Endpoints

#### Health Check
```bash
GET /api/health
```

#### Framework Status
```bash
GET /api/framework/status
```

#### System Health
```bash
GET /api/framework/health
```

#### Connection Management
```bash
GET /api/framework/connections
POST /api/framework/connections
PUT /api/framework/connections/:id
DELETE /api/framework/connections/:id
```

#### Error Logs
```bash
GET /api/framework/errors
POST /api/framework/errors/:id/resolve
```

## Configuration

### Database Schema

The framework uses Prisma with SQLite. Key models include:

- **FrontendConnection**: Stores frontend system configurations
- **ProcessedContent**: Tracks processed email content
- **SystemError**: Logs system errors and issues
- **ProcessingMetrics**: Stores performance and usage statistics

### Customization

#### Adding New Frontend Types

1. Define the schema in `src/framework/types/`
2. Implement connection logic in `src/framework/services/frontend-connection.ts`
3. Add transformation rules in `src/framework/services/content-transformation.ts`
4. Update the dashboard to display the new connection type

#### Custom Email Processing

Extend the email interpretation service:

```typescript
// src/framework/services/custom-email-processor.ts
export class CustomEmailProcessor extends EmailInterpretationService {
  protected classifyContentType(email: EmailData): string {
    // Custom classification logic
    return 'custom_type';
  }
}
```

## Monitoring & Analytics

### Dashboard Features

- **System Status**: Real-time health monitoring
- **Performance Metrics**: CPU, memory, and response times
- **Error Tracking**: Error logs with severity levels
- **Connection Management**: Active connections and status
- **Processing Statistics**: Success rates and throughput

### Real-time Updates

The framework uses Socket.IO for real-time updates:

```typescript
// Listen for processing updates
socket.on('processing_update', (data) => {
  console.log('Processing update:', data);
});

// Listen for error notifications
socket.on('error_alert', (error) => {
  console.error('System error:', error);
});
```

## Development

### Running Tests

```bash
# Run linting
npm run lint

# Run type checking
npx tsc --noEmit
```

### Database Management

```bash
# Push schema changes
npm run db:push

# Generate Prisma client
npm run db:generate

# Reset database
npm run db:reset

# Open Prisma Studio
npx prisma studio
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.