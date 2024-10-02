import numpy as np
import cv2
from cvzone.HandTrackingModule import HandDetector
import time
# import pyautogui
## using smart tab -> for greater gesture control
## using a normal pencil/pen as a smart pen based on CV 

def load_image(path):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Could not load image from {path}")
    return img

class ImageManipulator:
    def __init__(self, frame_width, frame_height):
        self.startDist = None
        self.scale = 0
        self.cx = 500
        self.cy = 500
        self.ox = 500
        self.oy = 200
        self.frame_width = frame_width
        self.frame_height = frame_height
    

    def handle_zoom(self, lmList1, lmList2, img, img1, detector):
        fing_dist, info3, img = detector.findDistance(lmList1[8][0:2], lmList2[8][0:2], img, color=(255,0,255), scale=5)
        
        if self.startDist is None:
            self.startDist = fing_dist
        
        self.scale = int((fing_dist - self.startDist) // 7)
        self.cx, self.cy = info3[4:]
        
        h1, w1, _ = img1.shape
        newH, newW = ((h1 + self.scale)//7)*7, ((w1 + self.scale)//7)*7
        #print_image(img1, newH, newW)
        try:
            img1_resized = cv2.resize(img1, (newW, newH))  
        except cv2.error:
            print("Error resizing image, scale too large or small")
            self.scale = 0
            return img1

        # Update ox and oy to center the image based on zoom
        self.ox = max(0, min(self.cx - newW // 2, self.frame_width - newW))
        self.oy = max(0, min(self.cy - newH // 2, self.frame_height - newH))

        return img1_resized

    def handle_pinch(self, lmList1, img, info1):
        cv2.circle(img, (info1[4], info1[5]), 15, (0, 255, 0), cv2.FILLED)
        pointer1Loc = lmList1[8][0:2]
        
        if self.ox <= pointer1Loc[0] <= self.ox + self.w and self.oy <= pointer1Loc[1] <= self.oy + self.h:
            new_ox = pointer1Loc[0] - self.w // 2
            new_oy = pointer1Loc[1] - self.h // 2

            # Ensure ox and oy stay within frame boundaries
            self.ox = max(0, min(new_ox, self.frame_width - self.w))
            self.oy = max(0, min(new_oy, self.frame_height - self.h))
        else:
            pass
    def handle_hands(self, hands, img, img1, detector):
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
                    img1 = self.handle_zoom(lmList1, lmList2, img, img1, detector)
            else:
                self.startDist = None

        return img1

    def overlay_image(self, img, img1):
        h, w = img1.shape[:2]
        self.h, self.w = h, w  # Update the current image dimensions
        
        # Ensure ox and oy are within frame boundaries
        self.ox = max(0, min(self.ox, self.frame_width - w))
        self.oy = max(0, min(self.oy, self.frame_height - h))
        img[self.oy:self.oy+h, self.ox:self.ox+w] = img1

        return img

        
        # Calculate the portion of img1 that fits within the frame
        '''
        x_start = max(0, -self.ox)
        y_start = max(0, -self.oy)
        x_end = min(w, self.frame_width - self.ox)
        y_end = min(h, self.frame_height - self.oy)
        
        # Calculate where to place the image on the frame
        frame_x = max(0, self.ox)
        frame_y = max(0, self.oy)'''
        
        # Overlay the visible portion of img1 onto img
        #img[self.oy:self.oy+(y_end-y_start), self.ox:self.ox+(x_end-x_start)] = img1[y_start:y_end, x_start:x_end]
        
        
def main():
    try:
        capture = cv2.VideoCapture(0)
        if not capture.isOpened():
            raise IOError("Cannot open webcam")

        frame_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        detector = HandDetector(detectionCon=0.8)
        manipulator = ImageManipulator(frame_width, frame_height)

        img1 = load_image("/Users/keshav/Documents/Projects/Tinker_CV/Images/ImagesPNG/1.png")

        while True:
            success, img = capture.read()
            if not success:
                print("Failed to grab frame")
                break

            img = cv2.flip(img, 1)
            hands, img = detector.findHands(img, flipType=False)
            
            white_overlay = np.ones((frame_height, frame_width, 3), dtype=np.uint8) * 255
            alpha = 1  # Set the transparency factor (0 = fully transparent, 1 = fully opaque)
            img = cv2.addWeighted(white_overlay, alpha, img, 1 - alpha, 0)
            

            if hands:
                img1 = manipulator.handle_hands(hands, img, img1, detector)
                for hand in hands:
                    lmList = hand['lmList']  # Landmark list for the hand
                    for lm in lmList:
                        cv2.circle(img, (lm[0], lm[1]), 10, (0, 0, 0), cv2.FILLED)


            
            img = manipulator.overlay_image(img, img1)

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


## SVG image format
## vector-based scaling
    ## XXXXXXX cv2.resize XXXXXXXXX
## don't use 7, use the CAP PROP lib -> ratios
## try PNG


## try making the rescaling/zooming more stable so that it doesn't keep zooming without major movements
