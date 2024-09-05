import numpy as np
import cv2
from cvzone.HandTrackingModule import HandDetector
import time
# import autopy
import pyautogui


capture = cv2.VideoCapture(0)
capture.set(3,1280)
capture.set(4,720)

detector = HandDetector(detectionCon = 0.8)

img1 = cv2.imread("/Users/keshav/Documents/Projects/Tinker_CV/Images/ImagesJPG/1.jpg")
ox,oy = 500,200
cx,cy = 500,500
startDist = None
scale = 0

'''def pinch_status(lmList):
    gap, info, _= detector.findDistance(lmList[4][0:2], lmList[8][0:2], img, color = (255, 0 , 255), scale = 5)
    if gap < 45:
        return True 
    else:
        return False'''


while True:

    # initializations
    pinch1 = False
    pinch2 = False
    pointer1_bound = False
    pointer2_bound = False
    

    success, img = capture.read()
    img  = cv2.flip(img, 1)
    hands, img = detector.findHands(img, flipType=False)
    h, w, _ = img1.shape
    startX, startY = ox, oy
    endX, endY = ox + w, oy + h
    img[startY:endY, startX:endX] = img1

    print("pre-condition: ", startY, endY, startX, endX)


    if hands:
        lmList1 = hands[0]["lmList"]               # List of 21 landmarks points
        #print(len(hands))
        gap1, info1, img = detector.findDistance(lmList1[4][0:2], lmList1[8][0:2], img, color = (255, 0 , 255), scale = 5)
        #print(gap1)

        # checking if a 'pinch' gesture was made
        if gap1 < 45:
            pinch1 = True
            cv2.circle(img, (info1[4],info1[5]), 15, (0, 255, 0), cv2.FILLED)
            pointer1Loc = lmList1[8][0:2]
            
            # checking if the 'pinch' gesture was within the bounds of the image
            if ox < pointer1Loc[0] < ox + w and oy < pointer1Loc[1] < oy + h:
                pointer1_bound = True
                ox, oy = pointer1Loc[0] - w // 2, pointer1Loc[1] - h // 2
            
            if len(hands) == 1:
                endY = oy + h
                endX = ox + w
                print("move condition: ", startY, endY, startX, endX)


        if len(hands) == 2:
            lmList2 = hands[1]["lmList"]
            gap2, info2, img2 = detector.findDistance(lmList2[4][0:2], lmList2[8][0:2], img, color = (255, 0 , 255), scale = 5)

            if gap2 < 45:
                pinch2 = True 
                cv2.circle(img, (info2[4],info2[5]), 15, (0, 255, 0), cv2.FILLED)
                pointer2Loc = lmList2[8][0:2]                 

                if ox < pointer2Loc[0] < ox + w and oy < pointer2Loc[1] < oy + h:
                    pointer2_bound = True
                    ox, oy = pointer2Loc[0] - w // 2, pointer2Loc[1] - h // 2

            # coding the Zoom feature
            if pinch1 and pinch2:

                if startDist is None:
                    fing_dist, info3, img = detector.findDistance(lmList1[8][0:2], lmList2[8][0:2], img, color = (255,0,255), scale = 5)
                    startDist = fing_dist
                
                fing_dist, info3, img = detector.findDistance(lmList1[8][0:2], lmList2[8][0:2], img, color = (255,0,255), scale = 5)
                scale = int((fing_dist - startDist) // 7)
                #print(fing_dist, startDist, scale)

                cx, cy = info3[4:]
                print(cx, cy)
                h1,w1,_ = img1.shape
                newH, newW = ((h1 + scale)//7)*7, ((w1 + scale)//7)*7           #ensuring that there is no array list size error while rescaling
                startX, endX = cx, cx + w1
                startY, endY = cy, cy + h1
                print("zoom condition: ", startY, endY, startX, endX)
                img1 = cv2.resize(img1, (newW, newH))
                    

        else:
            startDist = None

    # issues 4th sept: 
        # the image cannot be placed in the middle while zooming, need to find a solution
        # the image is losing resolution during the zooming process

    
    # a zoom feature
    
    cv2.imshow("Image", img)
    cv2.waitKey(1)