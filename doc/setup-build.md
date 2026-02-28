---
outline: [2, 3]
---

# Setup & Build

You typically don't need to build the app from source,
as a hosted version is available at the [github pages](https://menxli.github.io/metadent-app/).

We also periodically release built versions of the app at the [releases page](https://github.com/menxli/metadent-app/releases).

## Prepare Node.js Environment

Make sure you have Node.js installed (version 22 or higher is recommended).
You should follow the official Node.js installation guide for your operating system: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)

## Clone the repository

```sh
git clone https://github.com/menxli/metadent-app
cd metadent-app
```

## Install dependencies

```sh
npm install
```

## Build for Production

```sh
./build.sh
```

The resultant production-ready files will be located in the `metadent-app/` directory,
which you can deploy to any static file hosting service (e.g., GitHub Pages, Netlify, Vercel, or your own server).
