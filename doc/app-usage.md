# App Usage Guide

This section provides a brief guide on using the MetaDent App frontend.

## Connect to a Backend
At the login screen, enter the URL of your LFSS server along with your access token. 
If the connection is successful, you will be redirected to the main labeling interface.  
![login-screen](https://metadent.limengxun.com:8000/doc/images/login.jpg)
If you are testing locally, the URL should be something like `http://localhost:8000`.

At first the labeling interface may appear empty. This is because we have not yet configured the data path for the app.
To configure the data path, click on the settings button at the top right corner of the screen.  
![configure-path](https://metadent.limengxun.com:8000/doc/images/configure-path.jpg)

- You may need to refresh the page after changing the path settings to take effect.
- More about the path settings can be found in the [Backend configuration](setup-backend.md#prepare-files-for-labeling) section.

## Label Images
The main labeling interface is simple and intuitive. On the left side is the image viewer, where you can see the thumbnail of images to be labeled. 
On the right side is the labeling panel, where you can check image information, view image in detail, and add descriptions and point-by-point labels for the image.

![labeling-interface](https://metadent.limengxun.com:8000/doc/images/main-app.jpg)

- To **view overall label status**, look at the left side of the screen, the image viewer. There is a status indicator at the bottom of each image, 
current status can be one of the following:
  - <b>Unlabeled</b>: No labels have been added to the image yet.
  - <b>Labeled</b>: labels have been added and completed.
  - <b>Locked</b>: Someone else is currently working on this image.
  - <b>Skipped</b>: The image has been marked as skipped (not relevant, size too small, etc.).
- To **add an overall description**, simply type in the text area under image. There is a gray button at the right bottom corner of the text area, 
which can be clicked to auto-generate a description using AI (settings for AI generation can be configured in the settings panel).
- To **create a new point-by-point label**, click on the "+" button near the bottom of the labeling panel. This will add a new label entry (or you can simply press Enter key when focused on the last label entry). Type in the text input to specify the label content. 
- To **associate a label with a region in the image**, first select the label entry in the labeling panel (this turns it light-cyan), then draw with your mouse on the image viewer. Multiple regions can be drawn for each label. 
- To **hide/show regions associated with a label**, click on the eye icon at the top right corner of the image. This will toggle the visibility of all regions.
- To **change the color of a label**, click on the color block next to the label entry. This will randomly change the color used to highlight the associated regions in the image.
- To **mark a label as uncertain**, click on the check icon next to the color block. This will make the check icon becomes question mark icon, indicating uncertainty.
- To **remove a label entry**, click on the trash can icon at the right side of the label entry.
- To **remove all regions associated with a label**, click on the brush icon at the right side of the label entry.
- To **go to the next image**, click on the "Save & Next" button (or "Next" button if no changes are made) at the bottom of the labeling panel. 
This will save the current labels and load the next image for labeling. The 'Next' behavior can be configured in the settings panel (whether to skip labeled images or not).
- To **skip the current image**, click on the "Skip & Next" button at the bottom of the labeling panel. This will mark the image as skipped, prompt for reason, and load the next image.

<style scoped>
    strong {
        color: #1E40AF;
    }
</style>