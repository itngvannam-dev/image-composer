export async function composeVerticalImages(image1File, image2File) {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const loadImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => resolve(img);

      img.src = URL.createObjectURL(file);
    });
  };

  const img1 = await loadImage(image1File);
  const img2 = await loadImage(image2File);

  drawCoverImage(ctx, img1, 0, 0, WIDTH, HEIGHT / 2);

  drawCoverImage(ctx, img2, 0, HEIGHT / 2, WIDTH, HEIGHT / 2);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/jpeg", 0.95);
  });
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let drawWidth;
  let drawHeight;

  if (imgRatio > boxRatio) {
    drawHeight = h;
    drawWidth = h * imgRatio;
  } else {
    drawWidth = w;
    drawHeight = w / imgRatio;
  }

  const offsetX = x + (w - drawWidth) / 2;
  const offsetY = y + (h - drawHeight) / 2;

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}