export async function composeVerticalImages(image1File, image2File) {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const loadImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = reject;

      img.src = URL.createObjectURL(file);
    });
  };

  const [img1, img2] = await Promise.all([
    loadImage(image1File),
    loadImage(image2File),
  ]);

  const HALF_HEIGHT = HEIGHT / 2;

  // ảnh trên
  drawImageCover(ctx, img1, {
    x: 0,
    y: 0,
    width: WIDTH,
    height: HALF_HEIGHT,
  });

  // ảnh dưới
  drawImageCover(ctx, img2, {
    x: 0,
    y: HALF_HEIGHT,
    width: WIDTH,
    height: HALF_HEIGHT,
  });

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      1
    );
  });
}

function drawImageCover(ctx, img, area) {
  const { x, y, width, height } = area;

  const imgRatio = img.width / img.height;
  const areaRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  // crop giống CSS object-fit: cover
  if (imgRatio > areaRatio) {
    // ảnh quá ngang -> crop 2 bên
    sw = img.height * areaRatio;
    sx = (img.width - sw) / 2;
  } else {
    // ảnh quá dọc -> crop trên dưới
    sh = img.width / areaRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    x,
    y,
    width,
    height
  );
}