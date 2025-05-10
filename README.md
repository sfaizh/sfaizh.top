# Frontend for blogs

Consumes services in [sfaizh-api](https://github.com/sfaizh/sfaizh-api)

A responsive frontend blog and portfolio website built with React. Showcases posts, banners, and personal branding.

## Features

- Built with React
- Responsive UI with banners and icons
- SEO-friendly setup (manifest, robots.txt, favicons)
- Custom blog and banner imagery

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sfaizh/sfaizh.top
   cd sfaizh.top-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

   This will launch the app at:
   ```
   http://localhost:3000
   ```

### Build for Production

To create an optimized production build:

```bash
npm run build
```

This will output files to the `build/` directory, ready for deployment.

## Project Structure

```
sfaizh.top-main/
├── public/
│   ├── index.html             # Entry HTML
│   ├── manifest.json          # PWA config
│   ├── robots.txt             # SEO control
│   ├── favicon*.png           # Icons
│   └── img/                   # Banner and branding images
├── src/                       # React source code
├── package.json               # Project metadata and scripts
└── README.md                  # Project info
```
