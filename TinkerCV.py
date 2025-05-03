import numpy as np
import cv2
from cvzone.HandTrackingModule import HandDetector
import time
from typing import List, Dict
import os

def load_image(path: str):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Could not load image from {path}")
    return img

class ImageState:
    def __init__(self, img, x, y):
        self.img = img
        self.ox = x
        self.oy = y
        self.w = img.shape[1]
        self.h = img.shape[0]
        self.scale = 0
        self.startDist = None
        self.selected = False
        self.original_img = img.copy()

class ImageManipulator:
    def __init__(self, frame_width: int, frame_height: int):
        self.frame_width = frame_width
        self.frame_height = frame_height
        self.images: List[ImageState] = []
        self.active_image_index = None
        self.second_selected_index = None
        
    def add_image(self, img: np.ndarray, x: int, y: int):
        """Add a new image to the manipulator"""
        self.images.append(ImageState(img, x, y))

    def find_selected_image(self, pointer_loc) -> int:
        """Return index of image under the pointer"""
        for i, img_state in enumerate(self.images):
            if (img_state.ox <= pointer_loc[0] <= img_state.ox + img_state.w and 
                img_state.oy <= pointer_loc[1] <= img_state.oy + img_state.h):
                return i
        return None

    def handle_zoom(self, lmList1, lmList2, img, detector):
        if self.active_image_index is None:
            return
        
        img_state = self.images[self.active_image_index]
        fing_dist, info3, img = detector.findDistance(lmList1[8][0:2], lmList2[8][0:2], img, color=(255,0,255), scale=5)
        
        if img_state.startDist is None:
            img_state.startDist = fing_dist
        
        img_state.scale = int((fing_dist - img_state.startDist) // 7)
        cx, cy = info3[4:]
        
        h1, w1, _ = img_state.original_img.shape
        newH, newW = ((h1 + img_state.scale)//7)*7, ((w1 + img_state.scale)//7)*7
        
        try:
            img_state.img = cv2.resize(img_state.original_img, (newW, newH))
            # Update position to maintain center during zoom
            img_state.ox = max(0, min(cx - newW // 2, self.frame_width - newW))
            img_state.oy = max(0, min(cy - newH // 2, self.frame_height - newH))
        except cv2.error:
            print("Error resizing image, scale too large or small")
            img_state.scale = 0

    def handle_pinch(self, lmList, img, info):
        pointer_loc = lmList[8][0:2]
        selected_index = self.find_selected_image(pointer_loc)
        
        if selected_index is not None:
            img_state = self.images[selected_index]
            cv2.circle(img, (info[4], info[5]), 15, (0, 255, 0), cv2.FILLED)
            
            # Update position based on pointer
            new_ox = pointer_loc[0] - img_state.w // 2
            new_oy = pointer_loc[1] - img_state.h // 2
            
            # Ensure position stays within frame boundaries
            img_state.ox = max(0, min(new_ox, self.frame_width - img_state.w))
            img_state.oy = max(0, min(new_oy, self.frame_height - img_state.h))
            
            if self.active_image_index != selected_index:
                self.active_image_index = selected_index

    def handle_hands(self, hands, img, detector):
        if not hands:
            self.active_image_index = None
            return

        lmList1 = hands[0]["lmList"]
        gap1, info1, img = detector.findDistance(lmList1[4][0:2], lmList1[8][0:2], img, color=(255, 0, 255), scale=5)

        if gap1 < 60:
            self.handle_pinch(lmList1, img, info1)

            if len(hands) == 2:
                lmList2 = hands[1]["lmList"]
                gap2, info2, _ = detector.findDistance(lmList2[4][0:2], lmList2[8][0:2], img, color=(255, 0, 255), scale=5)

                if gap2 < 60:
                    cv2.circle(img, (info2[4], info2[5]), 15, (0, 255, 0), cv2.FILLED)
                    self.handle_pinch(lmList2, img, info2)
                    self.handle_zoom(lmList1, lmList2, img, detector)
            else:
                for img_state in self.images:
                    img_state.startDist = None

    def overlay_images(self, img):
        # Overlay images in reverse order so earlier added images appear on top
        for img_state in reversed(self.images):
            h, w = img_state.img.shape[:2]
            
            # Ensure position is within frame boundaries
            img_state.ox = max(0, min(img_state.ox, self.frame_width - w))
            img_state.oy = max(0, min(img_state.oy, self.frame_height - h))
            
            # Create mask for transparent overlay
            if self.active_image_index is not None and self.images.index(img_state) == self.active_image_index:
                alpha = 1.0  # Active image fully opaque
            else:
                alpha = 0.7  # Inactive images slightly transparent
            
            # Overlay image with transparency
            overlay = img[img_state.oy:img_state.oy+h, img_state.ox:img_state.ox+w].copy()
            cv2.addWeighted(img_state.img, alpha, overlay, 1-alpha, 0, overlay)
            img[img_state.oy:img_state.oy+h, img_state.ox:img_state.ox+w] = overlay
            
            # Draw border around active image
            if self.active_image_index is not None and self.images.index(img_state) == self.active_image_index:
                cv2.rectangle(img, (img_state.ox, img_state.oy), 
                            (img_state.ox + w, img_state.oy + h), 
                            (0, 255, 0), 2)
        
        return img

def main():
    try:
        # Initialize camera
        capture = cv2.VideoCapture(0)
        if not capture.isOpened():
            raise IOError("Cannot open webcam")

        frame_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Initialize detector and manipulator
        detector = HandDetector(detectionCon=0.8)
        manipulator = ImageManipulator(frame_width, frame_height)

        # Load multiple images
        image_folder = "/Users/keshav/Documents/Projects/Tinker_CV/Images/ImagesPNG/"
        image_files = [f for f in os.listdir(image_folder) if f.endswith(('.png', '.jpg', '.jpeg'))]
        
        # Add images at different initial positions
        spacing = frame_width // (len(image_files) + 1)
        for i, image_file in enumerate(image_files):
            img = load_image(os.path.join(image_folder, image_file))
            x = spacing * (i + 1) - img.shape[1] // 2
            y = frame_height // 2 - img.shape[0] // 2
            manipulator.add_image(img, x, y)

        while True:
            success, img = capture.read()
            if not success:
                print("Failed to grab frame")
                break

            img = cv2.flip(img, 1)
            hands, img = detector.findHands(img, flipType=False)
            
            # Create white background
            white_overlay = np.ones((frame_height, frame_width, 3), dtype=np.uint8) * 255
            img = cv2.addWeighted(white_overlay, 1, img, 0, 0)

            if hands:
                manipulator.handle_hands(hands, img, detector)
                # Draw hand landmarks
                for hand in hands:
                    lmList = hand['lmList']
                    for lm in lmList:
                        cv2.circle(img, (lm[0], lm[1]), 10, (0, 0, 0), cv2.FILLED)

            img = manipulator.overlay_images(img)

            cv2.imshow("Image", img)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        capture.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()

## lab studies - for interactions with images using hand gestures for remote research 