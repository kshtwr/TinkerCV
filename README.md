# TinkerCV
A computer vision application that enables gesture-based manipulation of images using hand tracking. This project allows users to interact with digital images using natural hand movements, providing features like pinch-to-move and zoom capabilities.

Video Demo: [youtu.be/dN6GUZEtUSs](https://youtu.be/dN6GUZEtUSs)

## Features

- Real-time hand tracking and gesture recognition
- Image manipulation capabilities:
  - Pinch gesture for moving images
  - Two-finger gesture for zooming
- Transparent background overlay
- Visual feedback for hand landmarks
- Smooth image scaling and positioning

## Prerequisites

```
numpy
opencv-python (cv2)
cvzone
```

## Installation

1. Clone this repository
2. Install the required dependencies:
   ```bash
   pip install numpy opencv-python cvzone
   ```
3. Update the image path in `main()` to point to your desired image:
   ```python
   img1 = load_image("path/to/your/image.png")
   ```

## Usage

Run the main script to start the application:
```bash
python main.py
```

### Gesture Controls

- **Single Hand Pinch**: Move your thumb and index finger close together (< 60 pixels apart) to grab and move the image
- **Two Hand Pinch + Zoom**: Use both hands with pinch gestures to zoom in/out of the image

## Code Structure

- `ImageManipulator`: Main class handling image transformations and gesture processing
  - `handle_zoom()`: Processes zoom gestures
  - `handle_pinch()`: Processes pinch gestures
  - `handle_hands()`: Main gesture processing pipeline
  - `overlay_image()`: Handles image overlay on the camera feed

## Technical Details

- Uses OpenCV for image processing and webcam capture
- Implements cvzone's HandDetector for hand landmark detection
- Supports dynamic image scaling while maintaining aspect ratio
- Includes boundary checking to keep manipulated images within frame
- Implements a white overlay for better visibility

## Limitations

- Requires good lighting conditions for optimal hand detection
- Currently supports only one overlay image at a time
- Hands must be within the frame at all times
