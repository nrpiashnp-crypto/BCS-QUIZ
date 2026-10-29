import sys, cv2, numpy as np
src,dst=sys.argv[1],sys.argv[2]
im=cv2.imread(src,cv2.IMREAD_GRAYSCALE); h,w=im.shape
im=im[int(h*0.093):int(h*0.930),:]
mean=cv2.blur(im.astype(np.float32),(61,61))
th=np.minimum(150,mean-40)
out=np.where(im<th,0,255).astype(np.uint8)
cv2.imwrite(dst,out)
