
# Backend Setup

The MetaDent App is entirely frontend-based and does not include a backend server. 
It requires [LFSS](https://github.com/menxli/lfss) (Lite File Storage Service) for managing file uploads and storage.

The LFSS is essentially a lightweight file storage server that provides RESTful APIs for uploading, downloading, and managing files. It act like a simplified version of AWS S3 or similar services.

:::info
This guide assumes we are running the LFSS server locally for testing purposes.   
You can also deploy LFSS on a remote server or cloud service for production use, just change the server address accordingly. 
:::

## LFSS Server Setup

To set up LFSS for use with the MetaDent App, follow these steps on the server where you want to host:

Install LFSS:
```sh
pip install 'lfss[all]'
```

Add your first user:
```sh
lfss-user add <username> --admin --max-storage 1T
```
**This will result in a hashed password being generated. Make sure to save it somewhere safe.**

Run the server:
```sh
lfss-serve
```
By default, the server will run on port 8000. You can change this by providing the `--port` option.

The server should now be running and accessible at `http://localhost:8000`. 
Our server setup is complete! Simple :)

## Prepare Files for Labeling

The MetaDent App requires a specific directory structure for the images to be labeled. You need to create a directory for your project and upload your images there. 
The structure should look like this:

```
/your-project/
    /images/
        image1.jpg
        image2.png
        ...
    /metadata/
        /image1/
            info.json
            [Labeled files will be stored here]
        /image2/
            info.json
            [Labeled files will be stored here]
        ...
```

The info files should be JSON files containing metadata about each image. Essential fields include:
- `filename`: The name of the image file.
- `path`: A field indicating the path or category of the image.
- `width`: The width of the image in pixels.
- `height`: The height of the image in pixels.

:::info
- The name for the main project directory, image directory, and metadata directory can be customized as needed. 
Need to be specified when configuring the MetaDent App.
- The name for each image file can be anything, as long as it is unique within the image directory. But please be sure the name of each metadata subdirectory (e.g., `image1`, `image2`) should match the corresponding image filename without the extension.  
:::

You can first create this structure locally and then upload it to the LFSS server using the LFSS CLI: 
```sh
# first setup LFSS CLI with your server info
export LFSS_ENDPOINT=http://localhost:8000
export LFSS_TOKEN=<your-generated-token>

# then upload your project directory, using -j for parallel uploads
lfss up local/project/path/ <username>/your-project/ -j 4
```

Now we've completed the backend setup for the MetaDent App! You can now configure the app to connect to your LFSS server and start labeling images. 🙌