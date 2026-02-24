# Quick Start

This application is designed to help users label images following the semi-stuctured data format used in the [MetaDent Project](https://menxli.github.io/metadent/).
Specifically, it allows users to annotate images with a short description of the image content, as well as point-by-point text labels associated with segmented regions of the image.

The application runs in the browser and mainly requires an [LFSS](https://github.com/menxli/lfss) server backend to store and retrieve images and annotations.
**A hosted version of the frontend app is available at the [github pages](https://menxli.github.io/metadent-app/)**. Feel free to use it with your own LFSS server for private use.

In addition, the MetaDent App supports integration with auxillary AI services to streamline the labeling process.
You can develop your own custom service to generate initial labels or suggestions for the images.

- To set up your own backend server, please refer to the [Backend Setup](setup-backend.md).
- A simple guide to get started with the frontend app is provided at [App Usage](app-usage.md).

AI Service is optional, for details on how to develop a custom auxillary AI service, please refer to the [Auxillary AI Service Guide](aux-backend.md).
