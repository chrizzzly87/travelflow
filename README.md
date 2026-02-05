# TravelFlow - AI Itinerary Planner

TravelFlow is a modern, AI-powered travel itinerary builder designed to help you plan, visualize, and edit your perfect trip. 

## Features

-   **AI-Powered Generation**: Create detailed itineraries in seconds using Gemini 2.0 Flash. Just enter a destination and preferences.
-   **Interactive Map**: Visualize your route with Google Maps integration, showing city markers and travel paths.
-   **Drag & Drop Planning**: Reorder cities and activities easily with intuitive drag-and-drop functionality.
-   **Smart Timeline**: Visual timeline of your trip, with support for vertical and horizontal layouts.
-   **Activity Suggestions**: Get AI-powered suggestions for what to see, eat, and do in each location.
-   **Travel Logistics**: Automatically calculates travel days and suggests transport modes between cities.
-   **Print & Share**: Export your itinerary to a clean print view or share a read-only link with friends.

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm or yarn
-   **Google Gemini API Key**: [Get it here](https://aistudio.google.com/app/apikey)
-   **Google Maps API Key**: [Get it here](https://console.cloud.google.com/). Ensure "Maps JavaScript API" and "Places API" are enabled.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/travelflow.git
    cd travelflow
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment Variables:
    -   Copy `.env.example` to `.env.local`:
        ```bash
        cp .env.example .env.local
        ```
    -   Open `.env.local` and paste your API keys:
        ```env
        VITE_GEMINI_API_KEY=your_gemini_key_here
        VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
        ```

### Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

To create a production build:

```bash
npm run build
```

The output will be in the `dist` folder, ready to be deployed to Vercel, Netlify, or any static host.

## Technologies Used

-   **Frontend**: React, TypeScript, Vite
-   **Styling**: Tailwind CSS
-   **Maps**: Google Maps JavaScript API (Manual Integration for robustness)
-   **AI**: Google Generative AI SDK (Gemini)
-   **Icons**: Lucide React
-   **State/Storage**: LocalStorage & URL Hash Compression (lz-string) for serverless persistence.
