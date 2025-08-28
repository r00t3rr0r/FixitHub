# FixitHub

FixitHub is a comprehensive device repair platform designed to streamline the repair process for customers, staff members, and administrators. It offers a user-friendly interface for ordering repairs, tracking progress, managing inventory, and handling all aspects of the repair business workflow. The app includes web shop functionality, shopping cart features, add-on service management, a knowledge base, business analytics, a content management system with blog capabilities, and SEO optimization tools.

## Overview

FixitHub is a full-stack application with both a frontend and a backend, organized as follows:

- **Frontend**: Developed using ReactJS and hosted in the `client/` directory. It utilizes Vite for development, the Shadcn UI component library, and Tailwind CSS for styling. The frontend handles routing through `react-router-dom` and makes API requests to endpoints prefixed with `/api/`.
- **Backend**: Implemented with Express.js hosted in the `server/` directory. It exposes REST API endpoints and uses MongoDB for database services via Mongoose. The backend handles user authentication and authorization using JWT tokens, with specific routes for login, registration, and more.

The two parts of the project—frontend and backend—run concurrently through a single command using the `concurrently` tool.

## Features

### User Roles & Access Levels

- **Customer**: 
  - Place and track repair orders
  - Access personal dashboard and order history
  - Communicate with staff
  - Browse and purchase from the web shop
  - Add special services to orders
  - Rate and review repair experiences
  - Read blog articles and browse content

- **Staff/Agent**:
  - Manage assigned repair orders
  - Update order statuses and communicate with customers
  - Track work hours and tasks
  - Manage knowledge base articles
  - Create and edit blog content
  - Manage add-on services

- **Admin**:
  - Comprehensive management capabilities
  - Manage users, inventory, services 
  - Access advanced reporting and analytics
  - Full control over web shop settings, and add-on services
  - Full content management and SEO optimization tools

## Getting started

### Requirements

Before setting up the project, ensure you have the following installed:

- Node.js (version 14.x or later)
- NPM (version 6.x or later)
- MongoDB (for the backend database)

### Quickstart

1. **Clone the repository**:
   ```sh
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Populate the `.env` file**: 
   Create a `.env` file in the `server/` directory with the following environment variables:
   ```sh
   PORT=3000
   MONGODB_URI=<Your MongoDB URI>
   JWT_SECRET=<Your JWT secret>
   ```

4. **Start the project**:
   ```sh
   npm run start
   ```
   This command starts both the frontend and backend concurrently.

5. **Access the application**:
   - **Frontend**: Visit `http://localhost:5173` 
   - **Backend**: The API server runs at `http://localhost:3000`

### License

The project is proprietary (not open source).  
© 2024. All rights reserved.
